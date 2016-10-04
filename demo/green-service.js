'use strict';

const config = require('./properties').value;
const version = require('../package.json').version;
const hydraExpress = require('../index');

config.hydra.serviceName = 'green-service';

hydraExpress.init(config, version, () => {
  hydraExpress.registerRoutes({
    '/v1/green': require('./hello-v1-api')
  });
})
  .then((serviceInfo) => {
    // console.log('serviceInfo', serviceInfo);
  })
  .catch((err) => {
    console.log('err', err);
  });
