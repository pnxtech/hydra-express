'use strict';

const config = require('../properties').value;
const version = require('../../package.json').version;
const hydraExpress = require('../../index');

config.hydra.serviceName = 'web-service';
config.hydra.servicePort = 8080;

hydraExpress.init(config, version, () => {
  hydraExpress.registerRoutes({
    '/v1/web': require('./web-v1-api')
  });
})
  .then((serviceInfo) => {
    console.log('serviceInfo', serviceInfo);
  })
  .catch((err) => {
    console.log('err', err);
  });
