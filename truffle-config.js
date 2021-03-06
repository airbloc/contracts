const fs = require('fs');

let localConfig = {};
// eslint-disable-next-line func-names
let getProviderOf = function (network) { return () => `${network} is not implemented!`; };

if (fs.existsSync('truffle-config.local.js')) {
  // eslint-disable-next-line global-require
  const local = require('./truffle-config.local.js');
  localConfig = local.config;
  ({ getProviderOf } = local);
}

const config = {
  networks: {
    mainnet: {
      provider: getProviderOf('ethereum:mainnet'),
      network_id: 1,
      gas: 500000,
      gasPrice: 12000000000, // 12 Gwei
    },
    ropsten: {
      provider: getProviderOf('ethereum:ropsten'),
      network_id: 3,
      skipDryRun: true,
    },
    rinkeby: {
      provider: getProviderOf('ethereum:rinkeby'),
      network_id: 4,
      skipDryRun: true,
    },
    local: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*',
    },
    coverage: {
      host: '127.0.0.1',
      network_id: '*',
      port: 8555,
      gas: 0xfffffffffff,
      gasPrice: 0x01,
    },
    dev: {
      host: '127.0.0.1',
      port: 9545,
      network_id: '*',
    },
    baobab: {
      provider: getProviderOf('klaytn:baobab'),
      network_id: '1001',
      gas: '8500000',
      gasPrice: null,
    },
    cypress: {
      provider: getProviderOf('klaytn:cypress'),
      network_id: '8217', // unknown
      gas: '8500000',
      gasPrice: null,
    },
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
  mocha: {
    reporter: 'eth-gas-reporter',
    reporterOptions: {
      currency: 'KRW',
      gasPrice: 10,
    },
  },
};

module.exports = Object.assign(config, localConfig);
