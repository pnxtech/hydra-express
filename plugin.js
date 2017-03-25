'use strict';

const HydraPlugin = require('hydra/plugin');

/**
 * @name HydraExpressPlugin
 * @description Extend this for hydra-express plugins
 * @extends HydraPlugin
 */
class HydraExpressPlugin extends HydraPlugin {
  /**
   * @param {string} pluginName - unique name for the plugin
   */
  constructor(pluginName) {
    super(pluginName);
  }
  /**
   * @name setHydraExpress
   * @param {object} hydraExpress - hydra express instance
   */
  setHydraExpress(hydraExpress) {
    this.setHydra(hydraExpress.getHydra());
    this.hydraExpress = hydraExpress;
  }
  /**
   * @name setConfig
   * @param {string} serviceConfig - the service-level config
   * @param {object} serviceConfig.hydra - the hydra-level config
   */
  setConfig(serviceConfig) {
    super.setConfig(serviceConfig.hydra);
    this.serviceConfig = serviceConfig;
  }
}

module.exports = HydraExpressPlugin;
