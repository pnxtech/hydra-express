exports.value = {
  environment: 'development',
  logRequestHeader: true,
  logOutboundRequest: true,
  hydra: {
    serviceName: 'test-service',
    serviceDescription: 'Raison d\'etre',
    serviceIP: '127.0.0.1',
    servicePort: 0,
    serviceType: 'test',
    redis: {
      url: '127.0.0.1',
      port: 6379
    }
  }
};
