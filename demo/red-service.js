'use strict';

const config = require('./properties').value;
const version = require('../package.json').version;
const hydraExpress = require('../index');

config.hydra.serviceName = 'red-service';

hydraExpress.init(config, version, () => {
  hydraExpress.registerRoutes({
    '/v1/red': require('./hello-v1-api')
  });
})
  .then((serviceInfo) => {
    let hydra = hydraExpress.getHydra();
    hydra.on('message', function(message) {
      console.log(message);
    });
  })
  .catch((err) => {
    console.log('err', err);
  });
