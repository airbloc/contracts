const Caver = require('caver-js');

const KLAYTN_URL = "https://api.baobab.klaytn.net:8651";
const KLAYTN_ADDRESS = "0x1b0f4d3bc20e40e024e85b3be042ce3169547907";
const KLAYTN_PRIVATE_KEY = "0x18aeb00da666b7c6618a81ab47811ce515d19b584ec1b6417a2cb2b0302de090";

const caver = new Caver(KLAYTN_URL);
const deployerAccount = caver.klay.accounts.wallet.add(KLAYTN_PRIVATE_KEY);

const abi = caver.klay.abi;

const Accounts = require('./build/contracts/Accounts.json');
const AppRegistry = require('./build/contracts/AppRegistry.json');
const Consents = require('./build/contracts/Consents.json');
const ControllerRegistry = require('./build/contracts/ControllerRegistry.json');
const DataTypeRegistry = require('./build/contracts/DataTypeRegistry.json');
const Exchange = require('./build/contracts/Exchange.json');

async function currentBalance() {
    return Number(caver.utils.fromPeb(await caver.klay.getBalance(deployerAccount.address)));
}

let balance;
async function deploy(contract, args = []) {
    const c = new caver.klay.Contract(contract.abi);
    const deployment = c.deploy({
        data: contract.bytecode,
        arguments: args,
    });
    
    console.log('===============================');
    console.log(`${contract.contractName}`);
    const gas = await deployment.estimateGas();
    console.log(`  Gas estimated: ${gas}`);

    return new Promise((resolve, reject) => {
        deployment.send({
            from: deployerAccount.address,
            gas: Math.floor(gas * 1.5),
            value: 0,
        }, (err, txHash) => {
            if (err) return reject(err);
            if (typeof txHash === 'string') {
                console.log(`  Transaction Hash: ${txHash}`);
            }
        })
        .on('receipt', receipt => {
            console.log(`  Included Block: ${receipt.blockNumber}`);
            console.log(`  Gas Used: ${receipt.gasUsed}`);
            console.log(`  Contract Address: ${receipt.contractAddress}`);
            console.log(`  Events Generated: ${receipt.events ? Object.keys(receipt.events).join(', ') : '(none)'}`);
        }).then(async (instance) => {
            const newBalance = await currentBalance();
            console.log(`  Klays used: ${balance - newBalance} KLAY`);
            balance = newBalance;
            resolve(instance);
        });
    });
}

async function main() {
    balance = await currentBalance();
    console.log(`Initial balance: ${balance} KLAY`);

    const apps = await deploy(AppRegistry);
    const exchange = await deploy(Exchange, [apps.contractAddress]);

    const controllers = await deploy(ControllerRegistry);
    const accounts = await deploy(Accounts, [controllers.contractAddress]);

    const dataTypes = await deploy(DataTypeRegistry);
    const consents = await deploy(Consents, [accounts.contractAddress, apps.contractAddress, controllers.contractAddress, dataTypes.contractAddress]);

    console.log(exchange.address, consents.address);
}

main().catch(err => console.error(`Uncaught error : ${err.stack}`));

// abi.encodeContractDeploy(Exchange.abi, Exchange.deployedBytecode);
// abi.encodeContractDeploy(ControllerRegistry.abi, ControllerRegistry.deployedBytecode);
// abi.encodeContractDeploy(DataTypeRegistry.abi, DataTypeRegistry.deployedBytecode);
// abi.encodeContractDeploy(Accounts.abi, Accounts.deployedBytecode);
// abi.encodeContractDeploy(Consents.abi, Consents.deployedBytecode);

