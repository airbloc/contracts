const fs = require('fs');

const Users = artifacts.require('Users');
const AppRegistry = artifacts.require('AppRegistry');
const Consents = artifacts.require('Consents');
const ConsentsLib = artifacts.require('ConsentsLib');
const ControllerRegistry = artifacts.require('ControllerRegistry');
const DataTypeRegistry = artifacts.require('DataTypeRegistry');
const ERC20Escrow = artifacts.require('ERC20Escrow');
const Exchange = artifacts.require('Exchange');
const ExchangeLib = artifacts.require('ExchangeLib');
const FeePayerUtils = artifacts.require('FeePayerUtils');
const StringUtils = artifacts.require('StringUtils');

// for test
const SimpleToken = artifacts.require('SimpleToken');

const DEPLOYMENT_OUTPUT_PREFIX = 'deployment';

const localNetwork = ['dev', 'local'];
const testNetwork = ['ropsten', 'rinkeby', 'aspen', 'baobab'];
const mainNetwork = ['mainnet', 'cypress'];

module.exports = (deployer, network) => {
  deployer.then(async () => {
    // contracts without any dependencies will go here:
    // const baseContracts = [AppRegistry, ControllerRegistry, DataTypeRegistry];

    await deployer.deploy(FeePayerUtils);
    await deployer.deploy(StringUtils);

    await deployer.link(StringUtils, AppRegistry);
    await deployer.deploy(AppRegistry);

    await deployer.deploy(ControllerRegistry);
    await deployer.deploy(DataTypeRegistry);

    // users
    await deployer.link(FeePayerUtils, Users);
    await deployer.link(StringUtils, Users);
    await deployer.deploy(Users, ControllerRegistry.address);

    // consents
    await deployer.deploy(ConsentsLib);
    await deployer.link(ConsentsLib, Consents);
    await deployer.deploy(
      Consents,
      Users.address, AppRegistry.address,
      ControllerRegistry.address, DataTypeRegistry.address,
    );

    // exchange
    await deployer.deploy(ExchangeLib);
    await deployer.link(ExchangeLib, Exchange);
    await deployer.deploy(Exchange, AppRegistry.address);

    // escrow
    await deployer.deploy(ERC20Escrow, Exchange.address);

    if (testNetwork.includes(network) || localNetwork.includes(network)) {
      await deployer.deploy(SimpleToken);
    }

    const deployedContracts = {
      Users,
      AppRegistry,
      Consents,
      ControllerRegistry,
      DataTypeRegistry,
      ERC20Escrow,
      Exchange,
    };

    if (testNetwork.includes(network) || localNetwork.includes(network)) {
      deployedContracts.SimpleToken = SimpleToken;
    }

    const deployments = {};

    const convertPromises = Object.entries(deployedContracts).map(async ([contractName, contract]) => {
      const txHash = contract.transactionHash;
      const tx = await web3.eth.getTransaction(txHash);

      deployments[contractName] = {
        address: contract.address,
        tx_hash: txHash,
        created_at: tx.blockNumber,
        abi: contract.abi,
      };
    });

    await Promise.all(convertPromises);

    if (localNetwork.includes(network)) {
      console.log('Writing deployments to deployment.local.json');
      fs.writeFileSync(`${DEPLOYMENT_OUTPUT_PREFIX}.local.json`, JSON.stringify(deployments, null, '  '));
    }
    if (testNetwork.includes(network)) {
      console.log('Writing deployments to deployment.test.json');
      fs.writeFileSync(`${DEPLOYMENT_OUTPUT_PREFIX}.test.json`, JSON.stringify(deployments, null, '  '));
    }
    if (mainNetwork.includes(network)) {
      console.log('Writing deployments to deployment.json');
      fs.writeFileSync(`${DEPLOYMENT_OUTPUT_PREFIX}.json`, JSON.stringify(deployments, null, '  '));
    }
  });
};
