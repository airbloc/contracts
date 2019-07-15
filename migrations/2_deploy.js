const fs = require('fs');

const Accounts = artifacts.require('Accounts');
const AppRegistry = artifacts.require('AppRegistry');
const Consents = artifacts.require('Consents');
const ConsentsLib = artifacts.require('ConsentsLib');
const ControllerRegistry = artifacts.require('ControllerRegistry');
const DataTypeRegistry = artifacts.require('DataTypeRegistry');
const ERC20Escrow = artifacts.require('ERC20Escrow');
const Exchange = artifacts.require('Exchange');
const ExchangeLib = artifacts.require('ExchangeLib');

// for test
const SimpleToken = artifacts.require('SimpleToken');

const DEPLOYMENT_OUTPUT_PATH = 'deployment.local.json';

const testNetwork = ['ropsten', 'rinkeby', 'aspen', 'baobab'];
const mainNetwork = ['mainnet', 'cypress'];

module.exports = (deployer, network) => {
  deployer.then(async () => {
    // contracts without any dependencies will go here:
    const baseContracts = [AppRegistry, ControllerRegistry, DataTypeRegistry];

    // eslint-disable-next-line no-restricted-syntax
    for (const baseContract of baseContracts) {
      // eslint-disable-next-line no-await-in-loop
      await deployer.deploy(baseContract);
    }

    // accounts
    await deployer.deploy(Accounts, ControllerRegistry.address);

    // consents
    await deployer.deploy(ConsentsLib);
    await deployer.link(ConsentsLib, Consents);
    await deployer.deploy(
      Consents,
      Accounts.address, AppRegistry.address,
      ControllerRegistry.address, DataTypeRegistry.address,
    );

    // exchange
    await deployer.deploy(ExchangeLib);
    await deployer.link(ExchangeLib, Exchange);
    await deployer.deploy(Exchange, AppRegistry.address);

    // escrow
    await deployer.deploy(ERC20Escrow, Exchange.address);

    if (testNetwork.includes(network)) {
      await deployer.deploy(SimpleToken);
    }

    const deployments = {
      Accounts: Accounts.address,
      AppRegistry: AppRegistry.address,
      Consents: Consents.address,
      ConsentsLib: ConsentsLib.address,
      ControllerRegistry: ControllerRegistry.address,
      DataTypeRegistry: DataTypeRegistry.address,
      ERC20Escrow: ERC20Escrow.address,
      Exchange: Exchange.address,
      ExchangeLib: ExchangeLib.address,
    };

    if (testNetwork.includes(network)) {
      deployments.SimpleToken = SimpleToken.address;
    }

    console.log('Writing deployments to deployment.local.json');
    fs.writeFileSync(DEPLOYMENT_OUTPUT_PATH, JSON.stringify(deployments, null, '  '));
  });
};
