/**
* @name hello-v1-api
* @description This module packages the Hello API.
*/
'use strict';

const hydraExpress = require('../index');
const express = hydraExpress.getExpress();
let api = express.Router();

const HTTP_OK = 200;

/**
* @description Answer the hello call.
* @param {function} route handler
*/
api.get('/hello', (req, res) => {
  let hydra = hydraExpress.getHydra();
  let serviceName = hydra.getServiceName();
  hydraExpress.sendResponse(HTTP_OK, res, {
    result: {
      message: `Hello from ${serviceName}`
    }
  });
});

/**
* @description Answer with a message.
* @param {function} route handler
*/
api.post('/say', (req, res) => {
  let message = req.body.message;
  let hydra = hydraExpress.getHydra();
  let serviceName = hydra.getServiceName();
  hydraExpress.sendResponse(HTTP_OK, res, {
    result: {
      message: `[${message}] via ${serviceName}`
    }
  });
});

module.exports = api;
