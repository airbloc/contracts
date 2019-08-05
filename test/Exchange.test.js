const Web3 = require('web3');
const crypto = require('crypto');
// eslint-disable-next-line object-curly-newline
const { BN, time, expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('./test-utils');

const web3 = new Web3();

const AppRegistry = artifacts.require('AppRegistry');
const ERC20Escrow = artifacts.require('ERC20Escrow');
const Exchange = artifacts.require('Exchange');
const SimpleToken = artifacts.require('SimpleToken');

contract('Exchange', async (accounts) => {
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

  describe('preparing order', async () => {
    // happy path
    it('should able to prepare order', async () => {
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

      expectEvent.inLogs(logs, 'OfferPrepared', { providerAppName });
    });

    it('should fail to prepare order if offeror app name is not registered', async () => {
      const { escrowSign, escrowArgs } = await getEscrowArgs();

      await expectRevert(
        exchange.prepare(
          providerAppName, consumer,
          escrow.address,
          escrowSign,
          escrowArgs,
          getDataIds(64),
          { from: provider },
        ),
        'Exchange: provider app does not exist',
      );
    });

    it('should fail to prepare order if sender is not owner of provider app', async () => {
      await apps.register(providerAppName, { from: provider });

      const { escrowSign, escrowArgs } = await getEscrowArgs();

      await expectRevert(
        exchange.prepare(
          providerAppName, consumer,
          escrow.address,
          escrowSign,
          escrowArgs,
          getDataIds(64),
          { from: stranger },
        ),
        'Exchange: only provider app owner can prepare order',
      );
    });

    it('should fail to prepare order if dataIds length exceeds limit', async () => {
      await apps.register(providerAppName, { from: provider });

      const { escrowSign, escrowArgs } = await getEscrowArgs();

      await expectRevert(
        exchange.prepare(
          providerAppName, consumer,
          escrow.address,
          escrowSign,
          escrowArgs,
          getDataIds(256),
          { from: provider },
        ),
        'ExchangeLib: dataIds length exceeded (max 128)',
      );
    });

    it('should fail to prepare order if escrow is not contract', async () => {
      await apps.register(providerAppName, { from: provider });

      const { escrowSign, escrowArgs } = await getEscrowArgs();

      await expectRevert(
        exchange.prepare(
          providerAppName, consumer,
          consumer,
          escrowSign,
          escrowArgs,
          getDataIds(64),
          { from: provider },
        ),
        'ExchangeLib: not contract address',
      );
    });
  });

  describe('updating order', async () => {
    let dataIds;
    let offerId;

    beforeEach(async () => {
      await apps.register(providerAppName, { from: provider });

      dataIds = getDataIds(200);
      const { escrowSign, escrowArgs } = await getEscrowArgs();

      const { logs } = await exchange.prepare(
        providerAppName, consumer,
        escrow.address,
        escrowSign,
        escrowArgs,
        dataIds.slice(0, 20),
        { from: provider },
      );

      const event = expectEvent.inLogs(logs, 'OfferPrepared', { providerAppName });
      offerId = event.args.offerId.slice(0, 18);
    });

    // happy path
    it('should able to add dataIds', async () => {
      await exchange.addDataIds(offerId, dataIds.slice(20, 40), { from: provider });

      const offer = await exchange.getOffer(offerId);
      expect(offer.dataIds).to.have.members(dataIds.slice(0, 40));
    });

    it('should fail to add dataIds if sender is not owner of this app', async () => {
      await expectRevert(
        exchange.addDataIds(offerId, dataIds.slice(20, 40), { from: stranger }),
        'Exchange: only provider app owner can update order',
      );
    });

    it('should fail to add dataIds if order is not on neutral state', async () => {
      // change order state
      await exchange.order(offerId);

      await expectRevert(
        exchange.addDataIds(offerId, dataIds.slice(20, 40), { from: provider }),
        'ExchangeLib: neutral state only',
      );
    });

    it('should fail to add dataIds if its length exceeds limlt', async () => {
      await expectRevert(
        exchange.addDataIds(offerId, dataIds.slice(20, 200), { from: provider }),
        'ExchangeLib: dataIds length exceeded (max 128)',
      );
    });
  });

  describe('submitting order', async () => {
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
    });

    // happy path
    it('should submit order', async () => {
      const { logs } = await exchange.order(offerId, { from: provider });
      expectEvent.inLogs(logs, 'OfferPresented', { offerId: `${offerId.padEnd(66, '0')}`, providerAppName });
    });

    it('should fail to submit order if order is not on neutral state', async () => {
      const { logs } = await exchange.order(offerId, { from: provider });
      expectEvent.inLogs(logs, 'OfferPresented', { offerId: `${offerId.padEnd(66, '0')}`, providerAppName });

      await expectRevert(
        exchange.order(offerId, { from: provider }),
        'ExchangeLib: neutral state only',
      );
    });

    it('should fail to submit order if sender is not owner of this app', async () => {
      await expectRevert(
        exchange.order(offerId, { from: stranger }),
        'Exchange: only provider app owner can present order',
      );
    });
  });

  describe('canceling order', async () => {
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
    });

    it('should cancel order', async () => {
      const { logs } = await exchange.cancel(offerId, { from: provider });
      expectEvent.inLogs(logs, 'OfferCanceled', { offerId: `${offerId.padEnd(66, '0')}`, providerAppName });
    });

    it('should fail to cancel order if order is not on pending state', async () => {
      const { logs } = await exchange.cancel(offerId, { from: provider });
      expectEvent.inLogs(logs, 'OfferCanceled', { offerId: `${offerId.padEnd(66, '0')}`, providerAppName });

      await expectRevert(
        exchange.cancel(offerId, { from: provider }),
        'ExchangeLib: pending state only',
      );
    });

    it('should fail to cancel order if sender is not owner of this app', async () => {
      await expectRevert(
        exchange.cancel(offerId, { from: stranger }),
        'Exchange: only provider app owner can cancel order',
      );
    });
  });

  describe('settling order', async () => {
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

    it('should settle order', async () => {
      const { logs } = await exchange.settle(offerId, { from: consumer });
      expectEvent.inLogs(logs, 'OfferSettled', { offerId: `${offerId.padEnd(66, '0')}`, consumer });
      expectEvent.inLogs(logs, 'OfferReceipt', { offerId: `${offerId.padEnd(66, '0')}`, providerAppName, consumer });
    });

    it('should fail to settle order if order is not on pending state', async () => {
      const { logs } = await exchange.settle(offerId, { from: consumer });
      expectEvent.inLogs(logs, 'OfferSettled', { offerId: `${offerId.padEnd(66, '0')}`, consumer });
      expectEvent.inLogs(logs, 'OfferReceipt', { offerId: `${offerId.padEnd(66, '0')}`, providerAppName, consumer });

      await expectRevert(
        exchange.settle(offerId, { from: consumer }),
        'ExchangeLib: pending state only',
      );
    });

    it('should fail to settle order if sender is not owner of this app', async () => {
      await expectRevert(
        exchange.settle(offerId, { from: stranger }),
        'Exchange: only consumer can settle order',
      );
    });

    it('should fail to settle order if order is outdated', async () => {
      // skipping blocks
      const skipper = (num) => {
        const promises = [];
        for (let i = 0; i < num; i += 1) {
          promises.push(time.advanceBlock());
        }
        return Promise.all(promises);
      };

      await skipper(61);
      await expectRevert(
        exchange.settle(offerId, { from: consumer }),
        'ExchangeLib: outdated order',
      );
    });
  });

  describe('rejecting order', async () => {
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

      await exchange.order(offerId);
    });

    it('should reject order', async () => {
      const { logs } = await exchange.reject(offerId, { from: consumer });
      expectEvent.inLogs(logs, 'OfferRejected', { offerId: `${offerId.padEnd(66, '0')}`, consumer });
    });

    it('should fail to reject order if sender is not authorized', async () => {
      await expectRevert(
        exchange.reject(offerId, { from: stranger }),
        'Exchange: only consumer can reject order',
      );
    });

    it('should fail to reject order if order is not on pending state', async () => {
      const { logs } = await exchange.reject(offerId, { from: consumer });
      expectEvent.inLogs(logs, 'OfferRejected', { offerId: `${offerId.padEnd(66, '0')}`, consumer });

      await expectRevert(
        exchange.reject(offerId, { from: consumer }),
        'ExchangeLib: pending state only',
      );
    });
  });
});
