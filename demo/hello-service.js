const config = require('./properties').value;
const hydraExpress = require('../index');

hydraExpress.init(config, () => {
  hydraExpress.registerRoutes({
    '/v1/hello': require('./hello-v1-api')
  });
})
  .then((serviceInfo) => {
    console.log('serviceInfo', serviceInfo);
  })
  .catch((err) => {
    console.log('err', err);
  });
