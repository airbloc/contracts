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
      provider: getProviderOf('mainnet'),
      network_id: 1,
      gas: 500000,
      gasPrice: 12000000000, // 12 Gwei
    },
    ropsten: {
      provider: getProviderOf('ropsten'),
      network_id: 3,
      gas: 3000000,
    },
    rinkeby: {
      provider: getProviderOf('rinkeby'),
      network_id: 4,
      gas: 3000000,
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
    klaytn: {
      provider: getProviderOf('klaytn'),
      network_id: '1001', // Aspen network id
      gas: 20000000, // transaction gas limit
      gasPrice: null, // gasPrice of Aspen is 25 Gpeb
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
