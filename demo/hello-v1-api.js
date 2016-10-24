const hydraExpress = require('../index');
const express = hydraExpress.getExpress();
let api = express.Router();

const HTTP_OK = 200;

/**
* @description Answer the hello call.
* @param {function} route handler
*/
api.get('/greeting', (req, res) => {
  let hydra = hydraExpress.getHydra();
  let serviceName = hydra.getServiceName();
  hydraExpress.sendResponse(HTTP_OK, res, {
    result: {
      message: `Hello from ${serviceName}`
    }
  });
});

module.exports = api;
