/**
* HydraExpress Module
* @description A module that binds Hydra and ExpressJS. This simplifies building API enabled microservices.
* @author Carlos Justiniano
*/
'use strict';

const Promise = require('bluebird');
Promise.config({
  // Enables all warnings except forgotten return statements.
  warnings: {
    wForgottenReturn: false
  }
});

Promise.series = (iterable, action) => {
  return Promise.mapSeries(
    iterable.map(action),
    (value, index, _length) => value || iterable[index].name || null
  );
};

const hydra = require('hydra');
const Utils = hydra.getUtilsHelper();
const ServerResponse = hydra.getServerResponseHelper();
let serverResponse = new ServerResponse();

const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const http = require('http');
const moment = require('moment');
const path = require('path');
const responseTime = require('response-time');
const jwtAuth = require('fwsp-jwt-auth');

let app = express();

let defaultLogger = () => {
  let dump = (level, obj) => {
    console.log(level.toUpperCase());
    console.dir(obj, {colors: true, depth: null});
  };
  return {
    fatal: (obj) => dump('FATAL', obj),
    error: (obj) => dump('ERROR', obj),
    debug: (obj) => dump('DEBUG', obj),
    info: (obj) => dump('INFO', obj)
  };
};

/**
* @name HydraExpress
* @summary HydraExpress class
*/
class HydraExpress {
  /**
  * @name constructor
  * @return {undefined}
  */
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
    return Promise.series(plugins, (plugin) => this._registerPlugin(plugin));
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
  * @name _init
  * @summary Initialize HydraExpress using a configuration object.
  * @private
  * @throws Throws an Error() if config is found to be invalid
  * @param {object} config - configuration as described in the projects readme
  * @return {object} Promise - promise resolving to hydraexpress ready or failure
  */
  _init(config) {
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
      } else if (!config.registerRoutesCallback) {
        reject(new Error('Config missing registerRoutesCallback parameter'));
      } else {
        config.hydra.serviceVersion = config.version;
        this.config = config;
        this.config.environment = this.config.environment || 'development';
        this.registerRoutesCallback = config.registerRoutesCallback;
        this.registerMiddlewareCallback = config.registerMiddlewareCallback;
        /**
        * Start the log event Listener as soon as possible in order to
        * receive redis initialization errors.
        *
        * @param {string} entry - log entry
        */
        hydra.on('log', (entry) => {
          this.log(entry.type, entry.message);
        });
        return Promise.series(this.registeredPlugins, (plugin) => plugin.setConfig(config))
          .then((..._results) => {
            if (config.jwtPublicCert) {
              return jwtAuth.loadCerts(null, config.jwtPublicCert)
                .catch((_err) => reject(new Error('Can\'t load public cert')));
            }
          })
          .then(() => this.start(resolve, reject))
          .catch((err) => this.log('error', err.toString()));
      }
    });
  }

  /**
  * @name _shutdown
  * @summary Shutdown hydra-express safely.
  * @return {undefined}
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
  * @name getJwtAuth
  * @summary Retrieve the underlying jwtAuth object
  * @return {object} jwtAuth - jwtAuth object
  */
  getJwtAuth() {
    return jwtAuth;
  }

  /**
  * @name getRuntimeConfig
  * @summary Retrieve loaded configuration object
  * @return {object} config - immutable object
  */
  getRuntimeConfig() {
    return Object.assign({}, this.config);
  }

  /**
   * @name log
   * @summary logs a message
   * @private
   * @param {string} type - type of message: 'info', 'start', 'error'
   * @param {string} message - message to log
  * @return {undefined}
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
  * @param {function} _reject - promise reject
  * @private
  * @return {undefined}
  */
  start(resolve, _reject) {
    let serviceInfo;
    hydra.init(this.config)
      .then((config) => {
        this.config = config;
        return hydra.registerService();
      })
      .then((_serviceInfo) => {
        serviceInfo = _serviceInfo;
        this.log('start', `${hydra.getServiceName()} (v.${hydra.getInstanceVersion()}) server listening on port ${this.config.hydra.servicePort}`);
        this.log('info', `Using environment: ${this.config.environment}`);
        this.initService();
        return Promise.series(this.registeredPlugins, (plugin) => plugin.onServiceReady());
      })
      .then((..._results) => {
        return Promise.delay(2000);
      })
      .then(() => resolve(serviceInfo))
      .catch((err) => this.log('error', err.toString()));
  }

  /**
   * @name initService
   * @summary Initialize service
   * @private
   * @return {undefined}
   */
  initService() {
    app.use(cors());
    app.use(responseTime());

    /**
    * @description Stamp every request with the process id that handled it.
    * @param {object} req - express request object
    * @param {object} res - express response object
    * @param {function} next - express next handler
    */
    app.use((req, res, next) => {
      res.set('x-process-id', process.pid);
      next();
    });

    /**
    * @description Fatal error handler.
    * @param {function} err - error handler function
    */
    process.on('cleanup', () => {
      this._shutdown();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      this.log('fatal', 'Received SIGTERM');
      process.emit('cleanup');
    });
    process.on('SIGINT', () => {
      this.log('fatal', 'Received SIGINT');
      process.emit('cleanup');
    });
    process.on('unhandledRejection', (reason, _p) => {
      this.log('fatal', Utils.safeJSONStringify(reason));
      console.log(reason); // necessary for full stack trace
      process.emit('cleanup');
    });
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
      process.emit('cleanup');
    });

    /**
    * Security.
    */
    const ninetyDaysInMilliseconds = moment.duration(90, 'days').asMilliseconds();
    app.use(helmet());
    app.use(helmet.hidePoweredBy({setTo: `${hydra.getServiceName()}/${hydra.getInstanceVersion()}`}));
    app.use(helmet.hsts({maxAge: ninetyDaysInMilliseconds}));

    app.use(bodyParser.urlencoded({extended: false}));

    this.registerMiddlewareCallback && this.registerMiddlewareCallback();

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
        err.status = ServerResponse.HTTP_NOT_FOUND;
        next(err);
      });

      /**
      * @param {object} err - express err object
      * @param {object} req - express request object
      * @param {object} res - express response object
      * @param {function} _next - express next handler
      */
      app.use((err, req, res, _next) => {
        let errCode = err.status || ServerResponse.HTTP_SERVER_ERROR;
        if (err.status !== ServerResponse.HTTP_NOT_FOUND) {
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
  * @return {undefined}
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
   * @return {undefined}
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
        this.sendResponse(ServerResponse.HTTP_UNAUTHORIZED, res, {
          result: {
            reason: 'Invalid token'
          }
        });
      } else {
        let token = authHeader.split(' ')[1];
        if (token) {
          return jwtAuth.verifyToken(token)
            .then((decoded) => {
              req.authToken = decoded;
              next();
            })
            .catch((err) => {
              this.sendResponse(ServerResponse.HTTP_UNAUTHORIZED, res, {
                result: {
                  reason: err.message
                }
              });
            });
        } else {
          this.sendResponse(ServerResponse.HTTP_UNAUTHORIZED, res, {
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
  /**
  * @name constructor
  * @return {undefined}
  */
  constructor() {
    super();
  }

  /**
  * @name init
  * @summary Initializes the HydraExpress module
  * @param {object} config - application configuration object
  * @param {string} version - version of application
  * @param {function} registerRoutesCallback - callback function to register routes
  * @param {function} registerMiddlewareCallback - callback function to register middleware
  * @return {object} Promise - promise resolving to hydraexpress ready or failure
  */
  init(config, version, registerRoutesCallback, registerMiddlewareCallback) {
    if (typeof config === 'string') {
      const configHelper = hydra.getConfigHelper();
      return configHelper.init(config)
        .then(() => {
          return this.init(configHelper.getObject(), version, registerRoutesCallback, registerMiddlewareCallback);
        })
        .catch((_err) => {
          throw new Error(`Unable to load config from ${config}`);
        });
    }

    let inner = {};
    if (typeof version === 'function') {
      registerMiddlewareCallback = registerRoutesCallback;
      registerRoutesCallback = version;
      // inner.version = config.version || require(`${__dirname}/package.json`).version;
    } else if (version) {
      inner.version = version;
    }

    if (registerRoutesCallback) {
      inner.registerRoutesCallback = registerRoutesCallback;
    }
    if (registerMiddlewareCallback) {
      inner.registerMiddlewareCallback = registerMiddlewareCallback;
    }
    return super._init(Object.assign({}, config, inner));
  }

  /**
  * @name shutdown
  * @summary Shutdown hydra-express safely.
  * @return {undefined}
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
  * @name getJwtAuth
  * @summary Retrieve the underlying jwtAuth object
  * @return {object} jwtAuth - jwtAuth object
  */
  getJwtAuth() {
    return super.getJwtAuth();
  }

  /**
  * @name getRuntimeConfig
  * @summary Retrieve loaded configuration object
  * @return {object} config - immutable object
  */
  getRuntimeConfig() {
    return super.getRuntimeConfig();
  }

  /**
  * @name log
  * @summary Logger. Use to log messages
  * @param {string} type - type of message: 'fatal', 'error', 'debug', 'info'
  * @param {string} str - string message to log
  * @return {undefined}
  */
  log(type, str) {
    super.log(type, str);
  }

  /**
  * @name registerRoutes
  * @summary Register API routes.
  * @param {string} routeBaseUrl - route base url, ex: /v1/offers
  * @param {object} api - express api object
  * @return {undefined}
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
   * @return {undefined}
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
