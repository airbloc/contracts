const Migrations = artifacts.require('./Migrations.sol');

module.exports = (deployer, network, accounts) => {
  console.log('  Deployer Account Address: ');
  console.log(`    - ${accounts[0]}`);
  deployer.deploy(Migrations);
};
