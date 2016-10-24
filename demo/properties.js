exports.value = {
  appServiceName: 'app-service',
  cluster: false,
  maxSockets: 500,
  environment: 'development',
  jwtPublicCert: 'service.pub',
  logPath: '',
  logRequestHeader: true,
  logOutboundRequest: true,
  logglyConfig: {
    token: '',
    subdomain: 'fws'
  },
  hydra: {
    serviceName: 'hello-service',
    serviceDescription: 'Service Demo',
    serviceIP: '',
    servicePort: 0,
    serviceType: 'demo',
    redis: {
      url: '127.0.0.1',
      port: 6379
    }
  }
};
