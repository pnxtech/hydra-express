'use strict';

const config = require('./properties').value;
const version = require('../package.json').version;
const hydraExpress = require('../index');

const HTTP_OK = 200;
config.hydra.serviceName = 'tiny-service';

hydraExpress.init(config, version, () => {
  const express = hydraExpress.getExpress();
  let api = express.Router();
  api.get('/hello', (req, res) => {
    res.status(HTTP_OK).json({
      code: HTTP_OK,
      result: {
        message: `Hello from tiny-service`
      }
    });
  });
  api.get('/sieve', (req, res) => {
    function primeRange(max) {
      let max_sqrt = Math.sqrt(max);
      let range = [];
      let current = 0;

      //generate array of numbers
      for (let i = 2; i <= max; i++) {
        range.push(i);
      }

      //filter multiples out
      while (range[current] <= max_sqrt) {
        range = range.filter((n) => {
          return (n == range[current] || n % range[current] != 0);
        });
        current++;
      }
      return range;
    }

    primeRange(300000);
    res.status(HTTP_OK).json({
      code: HTTP_OK,
      result: {
        message: `Hello from tiny-service sieve test`
      }
    });
  });
  hydraExpress.registerRoutes({
    '/v1/tiny-service': api
  });
})
  .then((serviceInfo) => {
    console.log('serviceInfo', serviceInfo);
  })
  .catch((err) => {
    console.log('err', err);
  });
