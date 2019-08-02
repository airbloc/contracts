Airbloc Contracts
=================
[![CircleCI](https://circleci.com/gh/airbloc/contracts/tree/master.svg?style=shield)](https://circleci.com/gh/airbloc/contracts/tree/master)
[![Coverage Status](https://coveralls.io/repos/github/airbloc/contracts/badge.svg?branch=master)](https://coveralls.io/github/airbloc/contracts?branch=master)

`airbloc/contract` contains on-chain backend contract codes
written in [Solidity](https://solidity.readthedocs.io) v0.5.0.

### Prerequisites

 - Node 8.10 or higher
 - Yarn

### Build

To build contracts, use `yarn compile`.

```
$ yarn compile
```

You can see compiled contract bytecodes and output ABIs in `build/` directory.


### Deploying Contracts

#### Setting Up Local Custom Providers

Before deploying contracts on actual network, you need to create `truffle-config.local.js` to set up your own Web3 provider with your wallets
(e.g. Private Key, Ledger Nano S). The example of the file is:

```js
const fs = require('fs');

const PrivateKeyProvider = require("truffle-privatekey-provider");
const privateKey = fs.readFileSync('../private.key').toString();

module.exports = {
  getEndpointOf(network) {
    if (network === 'ethereum') return `https://${network}.eth.io`;
    if (network === 'klaytn') return `https://${network}.klay.io`;
    return '';
  },
  getProviderOf(network) {
    const endpoint = getEndpointOf(network);
    if ('ethereum' === network) return new PrivateKeyProvider(privateKey, endpoint);
    if ('klaytn' === network) return new PrivateKeyProvider(privateKey, endpoint);
    return new PrivateKeyProvider(privateKey, 'MY_DEFAULT_ENDPOINT');
  },
};
```

#### Deploying

To deploy contracts, you can use `yarn migrate:<platform_name>:<network_name>` command. The network name can be one of those:

* `local`
  * `dev`: Uses local network on http://localhost:9545 executed by command `truffle dev` with default unlocked account
  * `local`: Uses local network on http://localhost:8545 with default unlocked account
* `ethereum`
  * `mainnet`: Uses Ethereum Mainnet with your provider defined in `truffle-config.local.js`
  * `ropsten`: Uses Ethereum Testnet with your provider defined in `truffle-config.local.js`
* `klaytn`
  * `cypress`: Uses Klaytn Mainnet with your provider defined in `truffle-config.local.js`
  * `baobab`: Uses Klaytn Testnet with your provider defined in `truffle-config.local.js`

For example, to deploy contract on ropsten, you can type:

```
$ yarn migrate:ethereum:ropsten
```

After deployment, `deployment.local.json` is generated. The generated JSON file contains all deployed contract address
information, and it is essential to run Airbloc server. You can provide the file path to Airbloc server as an argument.

```
 $ airbloc server --deployment ./contracts/deployment.local.json
```

### Testing

#### Running Unit Tests

First, you need to launch development server.

```
 $ yarn dev
```

Then you can run unit tests using `yarn test`.

```
 $ yarn test
```

#### Using Docker

First, you need to build a new image or pull from `airbloc/contracts`.

```
 $ docker build -t airbloc/contracts .
```

Then, you need to run container. This uses [ganache-cli](https://truffleframework.com/ganache), which is a light Ethereum chain client suitable for testing.

```
 $ docker run -it -p 8545:8545 -p 8500:8500 airbloc/contracts
```

To access to `deployment.json` (Contract Deployment Addresses), you can use `http://localhost:8500` endpoint.

```
$ curl http://localhost:8500 # For Example
{
  "Accounts": { "0xd95b1f49c581251f9b62cae463e34120acdddd76", <ABI> }
  "AppRegistry": { "0x093735b0603de9e655f876589c8577361b074e1b", <ABI> }
  "SchemaRegistry": { "0x7c8a3e4a4513514cf7d83921dbfb2700372c9294", <ABI> }
  "CollectionRegistry": { "0x558a7882df946fbfb631654db52b0a25fc6def8e", <ABI> }
  "Exchange": { "0x4e6385774f651a9b3317be8433c029cb5f58388f", <ABI> }
  "SimpleContract": { "0x9a084041d379cf551539a29f8f431d3936e28532", <ABI> }
  "SparseMerkleTree": { "0x49da8fd3c2fd575663b848488dadbe73f7452cd4", <ABI> }
  "DataRegistry": { "0x0e101b525652ce6aa43c1f9f71dc0c29b1cb1f37", <ABI> }
  "ERC20Mintable": { "0x009fb3ad2a28ea072ecc61c9176feab31cae6c68", <ABI> }
}
```

The endpoint URL can be also provided as an argument to airbloc server.
For detailed use, please refer root `docker-compose.yml`.

```
$ airbloc server --deployment http://localhost:8500/
```
