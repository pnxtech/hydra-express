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
    // console.log('serviceInfo', serviceInfo);
    let hydra = hydraExpress.getHydra();
    hydra.openSubscriberChannel('hydra:test');
    hydra.subscribeToChannel('hydra:test', function(message) {
      console.log(message);
    });
  })
  .catch((err) => {
    console.log('err', err);
  });
