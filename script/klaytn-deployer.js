/**
 * Since Klaytn does not support Truffle ^0.5.x,
 * Here is a deployer script used for deploying Airbloc contracts.
 */
// eslint-disable-next-line import/no-extraneous-dependencies
const minimist = require('minimist');
const fs = require('fs');
// eslint-disable-next-line import/no-extraneous-dependencies
const Caver = require('caver-js');

const argv = minimist(process.argv.slice(2), { default: { network: 'klaytn:baobab' } });

const config = {
  klaytnEndpoint: 'TODO: ENDPOINT_HERE',
  privateKey: 'TODO: PRIVATE_KEY_HERE',
  buildOutputPath: '../build/contracts',
};

if (fs.existsSync('./truffle-config.local.js')) {
  // eslint-disable-next-line global-require
  const local = require('../truffle-config.local.js');
  config.klaytnEndpoint = local.getEndpointOf(argv[argv.network]);
  config.privateKey = local.privateKey;
}

const caver = new Caver(config.klaytnEndpoint);
const deployerAccount = caver.klay.accounts.wallet.add(config.privateKey);

async function balanceOf(account = deployerAccount) {
  return Number(caver.utils.fromPeb(await caver.klay.getBalance(account.address)));
}

async function deploy(contractName, args = []) {
  const abiPath = `${config.buildOutputPath}/${contractName}.json`;
  if (!fs.existsSync(abiPath)) {
    throw new Error(`Contract ${contractName} not found. Have you run "yarn build"?`);
  }
  const { abi, bytecode } = JSON.parse(fs.readFileSync(abiPath).toString());

  const contract = new caver.klay.Contract(abi);
  const deployment = contract.deploy({
    data: bytecode,
    arguments: args,
  });

  console.log('===============================');
  console.log(`${contractName}`);
  const estimatedGas = await deployment.estimateGas();
  console.log(`  Gas estimated: ${estimatedGas}`);

  const oldBalance = await balanceOf();
  return new Promise((resolve, reject) => {
    deployment
      .send(
        {
          from: deployerAccount,
          gas: Math.floor(estimatedGas * 1.5),
          value: 0,
        },
        (err, txHash) => {
          if (err) reject(err);
          if (typeof txHash === 'string') {
            console.log(`  Transaction Hash: ${txHash}`);
          }
        },
      )
      .on('receipt', (receipt) => {
        const events = receipt.events ? Object.keys(receipt.events).join(', ') : '(none)';
        console.log(`  Included Block: ${receipt.blockNumber}`);
        console.log(`  Gas Used: ${receipt.gasUsed}`);
        console.log(`  Contract Address: ${receipt.contractAddress}`);
        console.log(`  Events Generated: ${events}`);
      })
      .then(async (instance) => {
        const newBalance = await balanceOf();
        console.log(`  Klays used: ${oldBalance - newBalance} KLAY`);
        resolve(instance);
      });
  });
}

async function main() {
  const initialBalance = await balanceOf();
  console.log(`Initial balance: ${initialBalance} KLAY`);

  const apps = await deploy('AppRegistry');
  const exchange = await deploy('Exchange', [apps.contractAddress]);
  await deploy('ERC20Escrow', [exchange.contractAddress]);

  const controllers = await deploy('ControllerRegistry');
  const accounts = await deploy('Accounts', [controllers.contractAddress]);

  const dataTypes = await deploy('DataTypeRegistry');
  await deploy('Consents', [
    accounts.contractAddress,
    apps.contractAddress,
    controllers.contractAddress,
    dataTypes.contractAddress,
  ]);
}

main().catch(err => console.error(`Uncaught error : ${err.stack}`));
