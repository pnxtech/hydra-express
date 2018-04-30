exports.value = {
  environment: 'development',
  testMode: true,
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
