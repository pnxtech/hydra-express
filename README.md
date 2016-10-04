![logo](hydra-express.jpg)
# Hydra / Express  

A module which wraps Hydra and ExpressJS to provide an out of the box microservice which can support API routes and handlers.

For more information on Hydra see: [Hydra](https://github.com/flywheelsports/fwsp-hydra)

## Installation

To install and use in another project:

```shell
$ npm i @flywheelsports/fwsp-hydra-express
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
const hydraExpress = require('@flywheelsports/fwsp-hydra-express');

function registerRoutesCallback() {
  hydraExpress.registerRoutes('/v1/offers', require('./offers-v1-api'));
}

hydraExpress.init(config, version, registerRoutesCallback)
  .then((serviceInfo) => {
    console.log('serviceInfo', serviceInfo);
  })
  .catch((err) => {
    console.log('err', err);
  });
```

In the example above, the `serviceInfo` on the then statement returns an object which contains the serviceName, servicePort and other bits of useful values.

## Logging and error reporting

HydraExpress includes a `log` member which allows you to log to both the console and log file.  

```javascript
hydraExpress.log('error', message);
```

The first parameter to `log` is the type of log message: `fatal`, `error`, `debug` or `info`.  The second parameter is the string message to store. It's highly recommended that you take the opportunity to create highly descriptive log messages since this function doesn't log a stack trace.

Additionally, log messages of type `fatal` or `error` are sent to hydra-core for logging inside of the services health check log. See: https://github.com/flywheelsports/hydra#health-and-presence

## Serving static web content

A hydra-express service can serve static web content. Simply create a folder called `public` and copy website files into it. An example can be found in the `demo/webserver` folder.

## Demo

The demo folder includes a simple demonstration of hydra-express. In the folder you'll find the following files `red-service.js`, `green-service.js` and `blue-service.js`. Those files each launch a service which can respond to the a `hello` API call via a web browser or curl.

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
* @return {object} Promise - promise resolving to hydraexpress ready or failure
*/
init(config, version, registerRoutesCallback)
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
Retrieve the underlying ExpressJS object
```javascript
/**
* @name getExpress
* @summary Retrieve the underlying ExpressJS object
* @return {object} express - expressjs object
*/
getExpress()
```

#### getHydra
Retrieve the underlying Hydra object
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
Express middleware to validate a JWT sent via the req.authorization header
```javascript
/**
* @name validateJwtToken
* @summary Express middleware to validate a JWT sent via the req.authorization header
* @return {function} Middleware function
*/
validateJwtToken()
```

## Hydra / Express configuration

Use the following configuration template (config/properties.js) as a starting point in your microservice.

```javascript
exports.value = {
  appServiceName: 'test-service',
  jwtPublicCert: '',
  cluster: false,
  maxSockets: 500,
  environment: 'development',
  logPath: '',
  logRequestHeader: true,
  logOutboundRequest: true,
  logglyConfig: {
    token: '{sometoken}',
    subdomain: 'fws'
  },
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
appServiceName | The top level name of the service. This isn't used by Hydra Express. It's there for your own use.
jwtPublicCert | The path to a public key used to validate JSON Web Tokens using middleware.
cluster | If true then Hydra/Express will enter Node Cluster mode and use all available CPU cores.
maxSockets | Maximum number of open socket connections.
environment | Node Environment
logPath | The path to use for the service log file.
logRequestHeader | If true, Hydra/Express will log request headers to the service log file.
logOutboundRequest | If true, Hydra/Express will log outbound responses to the service log file.
logglyConfig | Loggly configuration settings
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
