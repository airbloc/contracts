const Web3 = require('web3');
const crypto = require('crypto');
const { BN, expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const { expect, decodeErrorReason } = require('./test-utils');

const web3 = new Web3();

const AppRegistry = artifacts.require('AppRegistry');
const ERC20Escrow = artifacts.require('ERC20Escrow');
const Exchange = artifacts.require('Exchange');
const SimpleToken = artifacts.require('SimpleToken');


contract('ERC20Escrow', async (accounts) => {
  const providerAppName = 'provider';
  const [provider, consumer, minter, stranger] = accounts;

  let apps;
  let escrow;
  let exchange;
  let token;

  function getDataIds(length = 256) {
    const dataIds = [];
    for (let i = 0; i < length; i += 1) {
      dataIds.push(`0x${crypto.randomBytes(20).toString('hex')}`);
    }
    return dataIds;
  }

  async function getEscrowArgs() {
    const escrowSign = await escrow.getTransactSelector.call();
    const escrowArgs = web3.eth.abi.encodeParameters(
      ['address', 'uint256'],
      [token.address, web3.utils.toWei('100', 'ether')],
    );

    return {
      escrowSign,
      escrowArgs,
    };
  }

  beforeEach(async () => {
    apps = await AppRegistry.new();
    exchange = await Exchange.new(apps.address);
    escrow = await ERC20Escrow.new(exchange.address);
    token = await SimpleToken.new({ from: minter });
  });

  describe('#convert', async () => {
    let offerId;
    let escrowSign;
    let escrowArgs;

    beforeEach(async () => {
      await apps.register(providerAppName, { from: provider });

      ({ escrowSign, escrowArgs } = await getEscrowArgs());

      const { logs } = await exchange.prepare(
        providerAppName, consumer,
        escrow.address,
        escrowSign,
        escrowArgs,
        getDataIds(64),
        { from: provider },
      );

      const event = expectEvent.inLogs(logs, 'OfferPrepared', { providerAppName });
      offerId = event.args.offerId.slice(0, 18);
    });

    it('should return calldata correctly', async () => {
      const calldata = await escrow.convert(escrowSign, escrowArgs, offerId);
      const decoded = web3.eth.abi.decodeParameters(['address', 'uint256', 'bytes8'], `0x${calldata.slice(10)}`);

      expect(decoded[0]).to.be.equals(token.address);
      expect(decoded[1].toString()).to.be.equals(web3.utils.toWei('100', 'ether'));
      expect(await exchange.offerExists(decoded[2])).to.be.true;
    });

    it('should fail on offer does not exists', async () => {
      expectRevert(
        escrow.convert(escrowSign, escrowArgs, '0xdeadbeefdeadbeef'),
        'ERC20Escrow: offer does not exists',
      );
    });

    it('should fail on there is no supported method in contract', async () => {
      expectRevert(
        escrow.convert('0xdeadbeef', escrowArgs, offerId),
        'ERC20Escrow: invalid selector',
      );
    });
  });

  describe('#transact', async () => {
    const txAmount = new BN(web3.utils.toWei('100', 'ether'));

    let offerId;

    beforeEach(async () => {
      await apps.register(providerAppName, { from: provider });

      const { escrowSign, escrowArgs } = await getEscrowArgs();

      const { logs } = await exchange.prepare(
        providerAppName, consumer,
        escrow.address,
        escrowSign,
        escrowArgs,
        getDataIds(64),
        { from: provider },
      );

      const event = expectEvent.inLogs(logs, 'OfferPrepared', { providerAppName });
      offerId = event.args.offerId.slice(0, 18);

      await exchange.order(offerId, { from: provider });

      await token.mint(consumer, txAmount, { from: minter });
      await token.increaseAllowance(escrow.address, txAmount, { from: consumer });
    });

    it('should transact correctly', async () => {
      let providerBalance = await token.balanceOf(provider);
      let consumerBalance = await token.balanceOf(consumer);

      await exchange.settle(offerId, { from: consumer });
      providerBalance = await token.balanceOf(provider) - providerBalance;
      consumerBalance -= await token.balanceOf(consumer);

      expect(providerBalance.toString()).to.be.equals(txAmount.toString());
      expect(consumerBalance.toString()).to.be.equals(txAmount.toString());
    });

    it('should fail on sender is not exchange (account)', async () => {
      expectRevert(
        escrow.transact(
          token.address,
          web3.utils.toWei('100', 'ether'),
          offerId,
          { from: stranger },
        ),
        'ERC20Escrow: only exchange contract can execute this method',
      );
    });

    it('should fail on sender is not exchange (contract)', async () => {
      expectRevert(
        escrow.transact(
          token.address,
          web3.utils.toWei('100', 'ether'),
          offerId,
          { from: stranger },
        ),
        'ERC20Escrow: only exchange contract can execute this method',
      );
    });

    it('should fail on address does not match with offer information', async () => {
      const { escrowSign, escrowArgs } = await getEscrowArgs();

      const { logs } = await exchange.prepare(
        providerAppName, consumer,
        token.address,
        escrowSign,
        escrowArgs,
        getDataIds(64),
        { from: provider },
      );

      const event = expectEvent.inLogs(logs, 'OfferPrepared', { providerAppName });
      const otherOfferId = event.args.offerId.slice(0, 18);

      expectRevert(
        escrow.transact(
          token.address,
          web3.utils.toWei('100', 'ether'),
          otherOfferId,
          { from: exchange.address },
        ),
        'ERC20Escrow: invalid contract information',
      );
    });

    it('should fail on consumer does not allowed sufficient balance', async () => {
      await token.decreaseAllowance(escrow.address, txAmount, { from: consumer });

      const { logs } = await exchange.settle(offerId, { from: consumer });
      const event = expectEvent.inLogs(logs, 'EscrowExecutionFailed');

      expect(decodeErrorReason(event.args.reason)).to.be.equals('ERC20Escrow: low allowance');
    });

    it('should fail on consumer does not have sufficient balance', async () => {
      await token.transfer(minter, txAmount, { from: consumer });

      const { logs } = await exchange.settle(offerId, { from: consumer });
      const event = expectEvent.inLogs(logs, 'EscrowExecutionFailed');

      expect(decodeErrorReason(event.args.reason)).to.be.equals('ERC20Escrow: low balance');
    });
  });
});
