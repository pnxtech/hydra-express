/*eslint-disable no-unused-vars */
/**
* HydraExpress Module
* @description A module that binds Hydra and ExpressJS. This simplifies building API enabled microservices.
* @author Carlos Justiniano
*/
'use strict';

const Promise = require('bluebird');
Promise.series = (iterable, action) => {
  return Promise.mapSeries(
    iterable.map(action),
    (value, index, length) => value || iterable[index].name || null
  );
};

const ServerResponse = require('fwsp-server-response');
let serverResponse = new ServerResponse();

const bodyParser = require('body-parser');
const cluster = require('cluster');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const http = require('http');
const moment = require('moment');
const os = require('os');
const path = require('path');
const responseTime = require('response-time');
const Utils = require('fwsp-jsutils');
const jwtAuth = require('fwsp-jwt-auth');
const hydra = require('fwsp-hydra');

const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_SERVER_ERROR = 500;

let app = express();

let defaultLogger = () => {
  let dump = (level, obj) => {
    console.log(level.toUpperCase());
    console.dir(obj, {colors: true, depth: null});
  };
  return {
    fatal: obj => dump('FATAL', obj),
    error: obj => dump('ERROR', obj),
    debug: obj => dump('DEBUG', obj),
    info: obj => dump('INFO', obj)
  };
};

/**
* @name HydraExpress
* @summary HydraExpress class
*/
class HydraExpress {
  constructor() {
    this.config = null;
    this.server = null;
    this.appLogger = defaultLogger();
    this.registeredPlugins = [];
  }

  /**
   * @name use
   * @summary Adds plugins to Hydra
   * @param {...object} plugins - plugins to register
   * @return {object} - Promise which will resolve when all plugins are registered
   */
  use(...plugins) {
    return Promise.series(plugins, plugin => this._registerPlugin(plugin));
  }

  /**
   * @name _registerPlugin
   * @summary Registers a plugin with Hydra
   * @param {object} plugin - HydraPlugin to use
   * @return {object} Promise or value
   */
  _registerPlugin(plugin) {
    this.registeredPlugins.push(plugin);
    return plugin.setHydraExpress(this);
  }

  /**
  * @name validateConfig
  * @summary Validates a configuration object to ensure all required fields are present
  * @private
  * @param {object} config - config object
  * @return {array} array - of missing fields or empty array
  */
  validateConfig(config) {
    let missingFields = [];
    let requiredMembers = {
      'hydra': {
        'serviceName': '',
        'serviceDescription': ''
      },
      'version': '',
      'registerRoutesCallback': ''
    };

    Object.keys(requiredMembers).forEach((key) => {
      let type = typeof requiredMembers[key];
      if (type === 'string') {
        if (config[key] === undefined) {
          missingFields.push(key);
        }
      } else if (type === 'object') {
        if (config[key] === undefined) {
          missingFields.push(key);
        } else {
          Object.keys(requiredMembers[key]).forEach((key2) => {
            if (config[key][key2] === undefined) {
              missingFields.push(`${key}.${key2}`);
            }
          });
        }
      }
    });

    return missingFields;
  }

  /**
  * @name init
  * @summary Initialize HydraExpress using a configuration object.
  * @private
  * @throws Throws an Error() if config is found to be invalid
  * @param {object} config - configuration as described in the projects readme
  * @return {object} Promise - promise resolving to hydraexpress ready or failure
  */
  init(config) {
    return new Promise((resolve, reject) => {
      if (!config.hydra) {
        reject(new Error('Config missing hydra block'));
        return;
      }

      if (!config.hydra.redis) {
        reject(new Error('Config missing redis block'));
        return;
      }

      config.hydra.serviceIP = config.hydra.serviceIP || '';
      config.hydra.servicePort = config.hydra.servicePort || 0;
      config.hydra.serviceType = config.hydra.serviceType || '';

      let missingFields = this.validateConfig(config);
      if (missingFields.length) {
        reject(new Error(`Config missing fields: ${missingFields.join(' ')}`));
      } else if (!config.version) {
        reject(new Error('Config missing version parameter'));
      } else if (!config.registerRoutesCallback) {
        reject(new Error('Config missing registerRoutesCallback parameter'));
      } else {
        config.hydra.serviceVersion = config.version;
        this.config = config;
        this.config.environment = this.config.environment || 'development';
        this.registerRoutesCallback = config.registerRoutesCallback;
        /**
        * Start the log event Listener as soon as possible in order to
        * receive redis initialization errors.
        *
        * @param {string} entry - log entry
        */
        hydra.on('log', (entry) => {
          this.log(entry.type, entry.message);
        });
        return Promise.series(this.registeredPlugins, plugin => plugin.setConfig(config))
          .then((...results) => {
            if (config.jwtPublicCert) {
              return jwtAuth.loadCerts(null, config.jwtPublicCert)
                .catch(err => reject(new Error('Can\'t load public cert')));
            }
          })
          .then(() => this.start(resolve, reject))
          .catch(err => this.log('error', err.toString()));
      }
    });
  }

  /**
  * @name _shutdown
  * @summary Shutdown hydra-express safely.
  */
  _shutdown() {
    this.server.close(() => {
      this.log('error', 'Service is shutting down.');
      hydra.shutdown();
    });
  }

  /**
  * @name getExpress
  * @summary Retrieve the ExpressJS object
  * @return {object} express - ExpressJS object
  */
  getExpress() {
    return express;
  }

  /**
  * @name getExpressApp
  * @summary Retrieve the ExpressJS app object
  * @return {object} app - express app object
  */
  getExpressApp() {
    return app;
  }

  /**
  * @name getHydra
  * @summary Retrieve the Hydra object
  * @private
  * @return {object} hydra - Hydra object
  */
  getHydra() {
    return hydra;
  }

  /**
   * @name log
   * @summary logs a message
   * @private
   * @param {string} type - type of message: 'info', 'start', 'error'
   * @param {string} message - message to log
   */
  log(type, message) {
    let suppressLogEmit = true;
    switch (type) {
      case 'fatal':
        this.appLogger.fatal({
          event: type,
          message
        });
        hydra.sendToHealthLog('fatal', message, suppressLogEmit);
        break;
      case 'error':
        this.appLogger.error({
          event: type,
          message
        });
        hydra.sendToHealthLog('fatal', message, suppressLogEmit);
        break;
      case 'debug':
        this.appLogger.debug({
          event: type,
          message
        });
        break;
      default:
        this.appLogger.info({
          event: type,
          message
        });
        break;
    }
  }

  /**
  * @name start
  * @summary Starts the HydraExpress server
  * @param {function} resolve - promise resolve
  * @param {function} reject - promise reject
  * @private
  */
  start(resolve, reject) {
    if (!this.config.cluster || this.config.cluster !== true) {
      let serviceInfo;
      hydra.init(this.config.hydra)
        .then(() => {
          return hydra.registerService();
        })
        .then(_serviceInfo => {
          serviceInfo = _serviceInfo;
          this.log('start', `${this.config.hydra.serviceName} (v.${this.config.version}) server listening on port ${this.config.hydra.servicePort}`);
          this.log('info', `Using environment: ${this.config.environment}`);
          this.initWorker();
          return Promise.series(this.registeredPlugins, plugin => plugin.onServiceReady());
        })
        .then((...results) => {
          return Promise.delay(2000);
        })
        .then(() => resolve(serviceInfo))
        .catch(err => this.log('error', err.toString()));
    } else {
      if (cluster.isMaster) {
        const numWorkers = this.config.processes || os.cpus().length;

        console.log(`${this.config.hydra.serviceName} (v.${this.config.version})`);
        console.log(`Using environment: ${this.config.environment}`);
        console.log('info', `Master cluster setting up ${numWorkers} workers...`);

        for (let i = 0; i < numWorkers; i++) {
          cluster.fork();
        }

        /**
         * @param {object} worker - worker process object
         */
        cluster.on('online', (worker) => {
          this.log('info', `Worker ${worker.process.pid} is online`);
        });

        /**
         * @param {object} worker - worker process object
         * @param {number} code - process exit code
         * @param {number} signal - signal that caused the process shutdown
         */
        cluster.on('exit', (worker, code, signal) => {
          this.log('error', `Worker ${worker.process.pid} died with code ${code}, and signal: ${signal}`);
          this.log('info', 'Starting a new worker');
          cluster.fork();
        });

        resolve({});
      } else {
        hydra.init(this.config.hydra)
          .then(() => {
            return hydra.registerService();
          })
          .then((serviceInfo) => {
            this.initWorker();
            Promise.delay(2000).then(() => {
              resolve({
                serviceName: this.config.hydra.serviceName,
                serviceIP: this.config.hydra.serviceIP,
                servicePort: this.config.hydra.servicePort
              });
            });
          });
      }
    }
  }

  /**
   * @name initWorker
   * @summary Initialize a worker process
   * @private
   */
  initWorker() {
    app.use(cors());
    app.use(responseTime());

    /**
    * @description Stamp every request with the process id that handled it.
    * @param {object} req - express request object
    * @param {object} res - express response object
    * @param {function} next - express next handler
    */
    app.use((req, res, next) => {
      res.set('X-Process-Id', process.pid);
      next();
    });

    /**
    * @description Fatal error handler.
    * @param {function} err - error handler function
    */
    process.on('uncaughtException', (err) => {
      let stack = err.stack;

      delete err.__cached_trace__;
      delete err.__previous__;
      delete err.domain;

      this.log('fatal', Utils.safeJSONStringify({
        event: 'error',
        error: err.name,
        stack: stack
      }));
      process.exit(1);
    });

    /**
    * Security.
    */
    const ninetyDaysInMilliseconds = moment.duration(90, 'days').asMilliseconds();
    app.use(helmet());
    app.use(helmet.hidePoweredBy({setTo: `${this.config.hydra.serviceName}/${this.config.version}`}));
    app.use(helmet.hsts({maxAge: ninetyDaysInMilliseconds}));

    app.use(bodyParser.urlencoded({extended: false}));
    app.use(bodyParser.json());

    this.config.appPath = path.join('./', 'public');
    app.use('/', express.static(this.config.appPath));

    app.set('port', this.config.servicePort);

    if (this.config.environment !== 'development') {
      this.config.maxSockets = this.config.maxSockets || 500;
      if (this.config.maxSockets) {
        // increase max socket when used outside of development
        http.globalAgent.maxSockets = this.config.maxSockets;
      }
    }

    this.server = http.createServer(app);

    /**
     * @param {object} error - error object
     * @description on handler for errors.
     */
    this.server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      let bind = (typeof port === 'string') ? `Pipe ${this.config.hydra.servicePort}` : `Port ${this.config.hydra.servicePort}`;
      switch (error.code) {
        case 'EACCES':
          this.log('error', `${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          this.log('error', `${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    /**
    * On SIGTERM perform graceful shutdown.
    */
    process.on('SIGTERM', () => {
      this.log('error', `Process ${process.pid} recieved SIGTERM - attempting graceful shutdown`);
      this.server.close(() => {
        process.exit(0);
      });
    });

    /**
     * @description listen handler for server.
     */
    this.server.listen(this.config.hydra.servicePort, () => {
      this.registerRoutesCallback && this.registerRoutesCallback();

      app.get(`/_config/${this.config.hydra.serviceName}`, (req, res) => {
        this.sendResponse(HTTP_OK, res, {result: this.config});
      });
      hydra.registerRoutes([`[GET]/_config/${this.config.hydra.serviceName}`]);

      app.use('/*', (req, res) => {
        res.sendFile(path.resolve(this.config.appPath + '/index.html'));
      });

      /**
      * Post middleware init. Make sure to do this last.
      */

      /**
      * @param {object} req - express request object
      * @param {object} res - express response object
      * @param {function} next - express next handler
      */
      app.use((req, res, next) => {
        let err = new Error('Not Found');
        err.status = HTTP_NOT_FOUND;
        next(err);
      });

      /**
      * @param {object} err - express err object
      * @param {object} req - express request object
      * @param {object} res - express response object
      * @param {function} next - express next handler
      */
      app.use((err, req, res, next) => {
        let errCode = err.status || HTTP_SERVER_ERROR;
        if (err.status !== HTTP_NOT_FOUND) {
          this.appLogger.fatal({
            event: 'error',
            error: err.name,
            stack: err.stack
          });
        }
        res.status(errCode).json({
          code: errCode
        });
      });
    });
  }

  /**
  * @name _registerRoutes
  * @summary Register API routes.
  * @private
  * @param {object} routes - object with key/value pairs of routeBase: express api object
  */
  _registerRoutes(routes) {
    let routesList = [];
    Object.keys(routes).forEach((routePath) => {
      routes[routePath].stack.forEach((route) => {
        let routeInfo = route.route;
        // Skip router-level middleware, which will show up in the routes stack,
        // but with an undefined route property
        if (routeInfo === undefined) {
          return;
        }
        Object.keys(routeInfo.methods).forEach((method) => {
          routesList.push(`[${method}]${routePath}${routeInfo.path}`);
        });
      });
      app.use(routePath, routes[routePath]);
    });
    if (routesList.length > 0) {
      hydra.registerRoutes(routesList);
    }
  }

  /**
   * @name sendResponse
   * @summary Send a server response to caller.
   * @param {number} httpCode - HTTP response code
   * @param {object} res - Node HTTP response object
   * @param {object} data - An object to send
   */
  _sendResponse(httpCode, res, data) {
    serverResponse.sendResponse(httpCode, res, data);
  }

  /**
  * @name _validateJwtToken
  * @summary Express middleware to validate a JWT sent via the req.authorization header
  * @return {function} Middleware function
  */
  _validateJwtToken() {
    return (req, res, next) => {
      let authHeader = req.headers.authorization;
      if (!authHeader) {
        this.sendResponse(HTTP_UNAUTHORIZED, res, {
          result: {
            reason: 'Invalid token'
          }
        });
      } else {
        let token = authHeader.split(' ')[1];
        if (token) {
          return jwtAuth.verifyToken(token)
            .then(decoded => {
              req.authToken = decoded;
              next();
            })
            .catch((err) => {
              this.sendResponse(HTTP_UNAUTHORIZED, res, {
                result: {
                  reason: err.message
                }
              });
            });
        } else {
          this.sendResponse(HTTP_UNAUTHORIZED, res, {
            result: {
              reason: 'Invalid token'
            }
          });
        }
      }
    };
  }
}

/* ************************************************************************************************ */
/* ************************************************************************************************ */
/* ************************************************************************************************ */
/* ************************************************************************************************ */
/* ************************************************************************************************ */
/* ************************************************************************************************ */
/* ************************************************************************************************ */
/* ************************************************************************************************ */
/* ************************************************************************************************ */

/**
* @name IHydraExpress
* @summary Interface to a HydraExpress class
*/
class IHydraExpress extends HydraExpress {
  constructor() {
    super();
  }

  /**
  * @name init
  * @summary Initializes the HydraExpress module
  * @param {object} config - application configuration object
  * @param {string} version - version of application
  * @param {function} registerRoutesCallback - callback function to register routes
  * @return {object} Promise - promise resolving to hydraexpress ready or failure
  */
  init(config, version, registerRoutesCallback) {
    let inner = {};
    if (typeof version === 'function') {
      registerRoutesCallback = version;
      inner.version = config.version || require('./package.json').version;
    } else if (version) {
      inner.version = version;
    }
    if (registerRoutesCallback) {
      inner.registerRoutesCallback = registerRoutesCallback;
    }
    return super.init(Object.assign({}, config, inner));
  }

  /**
  * @name shutdown
  * @summary Shutdown hydra-express safely.
  */
  shutdown() {
    super._shutdown();
  }

  /**
  * @name getExpress
  * @summary Retrieve the underlying ExpressJS object
  * @return {object} express - expressjs object
  */
  getExpress() {
    return super.getExpress();
  }

  /**
  * @name getHydra
  * @summary Retrieve the underlying Hydra object
  * @return {object} hydra - hydra object
  */
  getHydra() {
    return super.getHydra();
  }

  /**
  * @name log
  * @summary Logger. Use to log messages
  * @param {string} type - type of message: 'fatal', 'error', 'debug', 'info'
  * @param {string} str - string message to log
  */
  log(type, str) {
    super.log(type, str);
  }

  /**
  * @name registerRoutes
  * @summary Register API routes.
  * @param {string} routeBaseUrl - route base url, ex: /v1/offers
  * @param {object} api - express api object
  */
  registerRoutes(routeBaseUrl, api) {
    super._registerRoutes(routeBaseUrl, api);
  }

  /**
   * @name sendResponse
   * @summary Send a server response to caller.
   * @param {number} httpCode - HTTP response code
   * @param {object} res - Node HTTP response object
   * @param {object} data - An object to send
   */
  sendResponse(httpCode, res, data) {
    super._sendResponse(httpCode, res, data);
  }

  /**
  * @name validateJwtToken
  * @summary Express middleware to validate a JWT sent via the req.authorization header
  * @return {function} Middleware function
  */
  validateJwtToken() {
    return super._validateJwtToken();
  }
}

module.exports = new IHydraExpress;
