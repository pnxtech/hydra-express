'use strict';

require('./helpers/chai.js');
const request = require('superagent');

const config = require('./properties').value;
const version = require('../package.json').version;
const hydraExpress = require('../index.js');

describe('HydraExpress init', () => {
  it('should rejected promiss if missing registerRoutesCallback during init', (done) => {
    hydraExpress.init(config, version)
      .catch((err) => {
        expect(err.message).to.be.equal('Config missing fields: registerRoutesCallback');
        done();
      });
  });
});

describe('HydraExpress service', () => {
  function registerRoutesCallback() {
    let express = hydraExpress.getExpress();
    let app = hydraExpress.getExpressApp();
    let api = express.Router();
    api.get('/info', (req, res) => {
      const HTTP_OK = 200;
      let info = `${config.serviceName} version: ${version}`;
      res.status(HTTP_OK).json({
        code: HTTP_OK,
        info
      });
    });
    app.use('/v1', api);
  }

  it('should be able to register an http route and call it', (done) => {
    hydraExpress.init(config, registerRoutesCallback)
      .then((serviceInfo) => {
        request
          .get(`http://localhost:${serviceInfo.servicePort}/v1/info`)
          .end((err, res) => {
            expect(err).to.be.null;
            expect(res.status).to.be.equal(200);
            expect(res).to.have.property('info');
            done();
          });
      })
      .catch((err) => {
        console.log('err', err);
      });
  }).timeout(5000);

  it.skip('should be able to register an https route and call it', (done) => {
    let securedConfig = Object.assign({}, config);
    securedConfig.hydra.serviceProtocol = 'https';
    securedConfig.hydra.sslKey = __dirname + '/fake_ssl_key.pem';
    securedConfig.hydra.sslCert = __dirname + '/fake_ssl_cert.pem';

    hydraExpress.init(securedConfig, registerRoutesCallback)
       .then((serviceInfo) => {
         request
           .get(`https://localhost:${serviceInfo.servicePort}/v1/info`)
           .end((err, res) => {
             expect(err).to.be.null;
             expect(res.status).to.be.equal(200);
             expect(res).to.have.property('info');
             done();
           });
       })
       .catch((err) => {
         console.log('err', err);
       });
  });
});
