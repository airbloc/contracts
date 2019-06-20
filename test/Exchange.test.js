const truffleAssert = require('truffle-assertions');
const { expect } = require('./test-utils');

const web3 = require('web3');
const crypto = require('crypto');

const AppRegistry = artifacts.require('AppRegistry');
const Escrow = artifacts.require('Escrow');
const Exchange = artifacts.require('Exchange');
const TestToken = artifacts.require('SimpleToken');

contract('Exchange', async (accounts) => {
  const [me, stranger] = accounts;
  const apps = await AppRegistry.new();

  const registerApp = async (apps, appName, sender) => {
    await apps.register(appName);
    
    const app = await apps.get(appName, { from: sender });
    expect(app.name).to.equal(appName);
    expect(app.owner).to.equal(sender);
  };

  const getEscrowArgs = async (exchangeAddr, tokenAddr) => {
    const escrow = await Escrow.new(exchangeAddr);
    const escrowSign = web3.eth.abi.encodeFunctionSignature(Escrow.TRANSACT_SIGNATURE);
    const escrowArgs = web3.eth.abi.encodeParameters(
      ['address', 'uint256'],
      [tokenAddr, web3.utils.toWei('100', 'ether')],
    );
    const dataIds = [];
    for (i = 0; i < 20; i++) {
      dataIds.push(crypto.randomBytes(20).toString('hex'));
    }
    
    return {
      escrow: escrow,
      escrowSign: escrowSign,
      escrowArgs: escrowArgs,
      dataIds: dataIds,
    };
  };

  before(async () => {
    await registerApp(apps, 'me', me);
    await registerApp(apps, 'stranger', stranger);
  });

  describe('preparing order', async () => {
    it('should able to prepare order', async () => {
      const exchange = await Exchange.new(apps.address);
      const token = await TestToken.new();
      
      const isMinted = await token.mint(me, web3.utils.toWei('100', 'ether'));
      expect(isMinted).to.be.true;

      const args = getEscrowArgs(exchange.address, token.address);

      await truffleAssert.eventEmitted(exchange.prepare(
        'me', 'stranger',
        args.escrow.address,
        args.escrowSign,
        args.escrowArgs,
        args.dataIds,
      ), 'OfferPrepared', console.log);
    });

    it('should fail to prepare order if from app name is not registered', async () => {

    });

    it('should fail to prepare order if to app name is registered', async () => {

    });

    it('should able to add dataIds into preparing order', async () => {

    });

    it('should fail to add dataIds into other order', async () => {

    });
  });

  describe('submitting order', async () => {
    it('should submit order', async () => {

    });
  });

  describe('canceling order', async () => {
    it('should cancel order', async () => {

    });
  });

  describe('settling order', async () => {
    it('should settle order', async () => {

    });
  });

  describe('rejecting order', async () => {
    it('should reject order', async () => {

    });
  });

});
