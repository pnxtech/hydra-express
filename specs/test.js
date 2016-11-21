'use strict';

require('./helpers/chai.js');
const request = require('superagent');

const config = require('./properties').value;
const version = require('../package.json').version;
const hydraExpress = require('../index.js');

describe('HydraExpress init', () => {
  it('should rejected promise if missing version field during init', (done) => {
    function registerRoutesCallback() {}
    hydraExpress.init(config, null, registerRoutesCallback)
      .catch((err) => {
        expect(err.message).to.be.equal('Missing fields: version');
        done();
      });
  });

  it('should rejected promiss if missing registerRoutesCallback during init', (done) => {
    hydraExpress.init(config, version)
      .catch((err) => {
        expect(err.message).to.be.equal('Missing fields: registerRoutesCallback');
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

});
