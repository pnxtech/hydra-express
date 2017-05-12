![logo](hydra-express.png)

A module which wraps Hydra and ExpressJS to provide an out of the box microservice which can support API routes and handlers.

For more information on Hydra see: [Hydra](https://github.com/flywheelsports/hydra)

* [Installation](#installation)
* [Usage](#usage)
* [Logging and error reporting](#logging-and-error-reporting)
* [Serving static web content](#serving-static-web-content)
* [Built-in routes](#built-in-routes)
* [Demo](#demo)
* [HydraExpress members](#hydraexpress-members)
  * [init](#init)
  * [shutdown](#shutdown)
  * [getExpress](#getexpress)
  * [getHydra](#gethydra)
  * [log](#log)
  * [sendResponse](#sendresponse)
  * [validateJwtToken](#validatejwttoken)
* [Hydra / Express configuration](#hydra--express-configuration)
* [Tests](#tests)
* [Hydra Express Plugins](#hydra-express-plugins)

## Installation

To install and use in another project:

```shell
$ npm install hydra-express
```

To contribute and develop locally:

```shell
$ nvm use
$ npm install
```

## Usage

```javascript
'use strict';

const config = require('./config/properties').value;
const version = require('./package.json').version;
const hydraExpress = require('hydra-express');

function registerRoutesCallback() {
  hydraExpress.registerRoutes('/v1/offers', require('./offers-v1-api'));
}

function registerMiddlewareCallback() {
  let app = hydraExpress.getExpressApp();
  app.use((req, res, next) => {
    console.log('req.headers', req.headers);
    next();
  });
}

hydraExpress.init(config, version, registerRoutesCallback, registerMiddlewareCallback)
  .then((serviceInfo) => {
    console.log('serviceInfo', serviceInfo);
  })
  .catch((err) => {
    console.log('err', err);
  });
```

In the example above, the `serviceInfo` on the then statement returns an object which contains the serviceName, servicePort and other bits of useful values.

## Logging and error reporting

HydraExpress includes a `log` member which allows you to log into to both the console and log file.

```javascript
hydraExpress.log('error', message);
```

The first parameter to `log` is the type of log message: `fatal`, `error`, `debug` or `info`.  The second parameter is the string message to store. It's highly recommended that you take the opportunity to create highly descriptive log messages since this function doesn't log a stack trace.

Additionally, log messages of type `fatal` or `error` are sent to hydra-core for logging inside of the services health check log. See: https://github.com/flywheelsports/hydra#health-and-presence

## Serving static web content

A hydra-express service can serve static web content. Simply create a folder called `public` and copy website files into it. An example can be found in the `demo/webserver` folder.

## Built-in routes

Built-in routes are prefixed with an underscore.

Route | Method | Description
--- | ---| ---
/_config/{service-name} | GET | Returns the config object used by this service

## Demo

The demo folder includes a simple demonstration of hydra-express. In the folder you'll find the following files `red-service.js`, `green-service.js` and `blue-service.js`. Those files each launch a service which can respond to the `hello` API call via a web browser or curl.

```
http://localhost:{port}/v1/{color}/hello
```

You'll need to grab the port number which is displayed when a service starts and then use the service name (`red`, `green`, `blue`) to connect to it.

For example:

```shell
$ node red-service.js
[2016-05-20T18:47:30.872Z]  INFO: service/50421 on Vantage.local:  (event=start)

    --
    message: red-service (v.0.2.13) server listening on port 4832
[2016-05-20T18:47:30.874Z]  INFO: service/50421 on Vantage.local:  (event=info, message="Using environment: development")
```

From the example above we see that the service is listening on port 4832, so we use that in the API request via a web browser.

```
http://localhost:4832/v1/red/hello
```

We'll then get this result:

```javascript
{
  "code": 200,
  "result": {
    "message": "Hello from red-service"
  }
}
```

You can run multiple services by starting the other two services, `blue-service` and `green-service`, in other terminal windows.

## HydraExpress members

#### init
Initializes the HydraExpress module
```javascript
/**
* @name init
* @summary Initializes the HydraExpress module
* @param {object} config - application configuration object
* @param {string} version - version of application
* @param {function} registerRoutesCallback - callback function to register routes
* @param {function} registerMiddlewareCallback - callback function to register middleware
* @return {object} Promise - promise resolving to hydraexpress ready or failure
*/
init(config, version, registerRoutesCallback, registerMiddlewareCallback)
```

#### shutdown
Shutdown hydra-express safely
```javascript
/**
* @name shutdown
* @summary Shutdown hydra-express safely.
*/
shutdown()
```

#### getExpress
Retrieves the underlying ExpressJS object
```javascript
/**
* @name getExpress
* @summary Retrieve the underlying ExpressJS object
* @return {object} express - expressjs object
*/
getExpress()
```

#### getHydra
Retrieves the underlying Hydra object
```javascript
/**
* @name getHydra
* @summary Retrieve the underlying Hydra object
* @return {object} hydra - hydra object
*/
getHydra()
```

#### log
Logger. Use to log messages
```javascript
/**
* @name log
* @summary Logger. Use to log messages
* @param {string} type - type of message: 'fatal', 'error', 'debug', 'info'
* @param {string} str - string message to log
*/
log(type, str)
```

#### sendResponse
Send a server response to caller
```javascript
/**
 * @name sendResponse
 * @summary Send a server response to caller.
 * @param {number} httpCode - HTTP response code
 * @param {object} res - Node HTTP response object
 * @param {object} data - An object to send
 */
sendResponse(httpCode, res, data)
```

#### validateJwtToken

*DEPRECATED*

This functionality has been extracted to the [jwt-auth plugin](http://github.com/flywheelsports/hydra-express-plugin-jwt-auth).

## Hydra / Express configuration

Use the following configuration template (config/properties.js) as a starting point in your microservice.

```javascript
exports.value = {
  jwtPublicCert: '',
  cluster: false,
  maxSockets: 500,
  environment: 'development',
  logPath: '',
  logRequestHeader: true,
  logOutboundRequest: true,
  hydra: {
    serviceName: 'test-service',
    serviceDescription: 'Raison d\'etre',
    serviceIP: '',
    servicePort: 0,
    serviceType: 'test',
    redis: {
      url: '127.0.0.1',
      port: 6379
    }
  }
};
```

Let's look at each key in more detail:

Key | Usage
--- | ---
jwtPublicCert | The path to a public key used to validate JSON Web Tokens using middleware.
cluster | If true then Hydra/Express will enter Node Cluster mode and use all available CPU cores.
maxSockets | Maximum number of open socket connections.
environment | Node Environment
logPath | The path to use for the service log file.
logRequestHeader | If true, Hydra/Express will log request headers to the service log file.
logOutboundRequest | If true, Hydra/Express will log outbound responses to the service log file.
hydra.serviceName | The service name used by Hydra.
hydra.serviceDescription | A description for the service. Used by monitoring software.
hydra.serviceIP | The IP address to use with the service. If the value is equal to an empty string (''), then the machine's local IP will be used, otherwise a four segment IP address is expected (52.9.201.160).
hydra.servicePort | The port address the service should use. If set to zero then a random port will be selected.
hydra.serviceType | The service class. For example: "social" for all services relating to social.
hydra.redis | The settings for the Redis server which hydra should use.

## Tests

This project uses Mocha, Chai and SuperAgent tests. Those packages are installed as dev dependencies during the NPM install process.

If you don't already have Mocha installed globally you can run:

```shell
$ npm install -g mocha
```

> ***IMPORTANT***: Before being able to run the tests you'll need to first copy the `specs/sample-properties.js` to `specs/properties.js` and ensure that the settings contain valid keys.

To run the tests suite:

```shell
$ npm run test
```

## Hydra Express Plugins

`HydraExpressPlugin` extends `HydraPlugin`. See the [Hydra plugin documention](https://github.com/flywheelsports/hydra/blob/master/plugins.md) for more details.

Some caveats for `HydraExpressPlugin` vs `HydraPlugin`:

1. In `HydraExpressPlugin`, `setHydraExpress(hydraExpress)` is called instead of `setHydra(hydra)`; `setHydraExpress` calls `setHydra(hydraExpress.getHydra())` internally.

2. `HydraExpressPlugin.setConfig` is called with the service-level config rather than the hydra-level config like `HydraPlugin.setConfig`. `HydraExpressPlugin.setConfig(config)` calls `super.setConfig(config.hydra)` internally.

Make sure to call `super.setHydraExpress` or `super.setConfig` if you're extending `HydraExpressPlugin`, or otherwise ensure that the `HydraPlugin` methods get called with the appropriate arguments.

See the [`HydraExpressLogger` plugin](https://github.com/flywheelsports/fwsp-logger/blob/master/lib/HydraExpressLogger.js) for an example of a plugin that registers Express middleware (look at `onServiceReady`).
