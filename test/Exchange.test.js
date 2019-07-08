const truffleAssert = require('truffle-assertions');
const { BN, time } = require('openzeppelin-test-helpers');

const Web3 = require('web3');

const web3 = new Web3();
const crypto = require('crypto');
const { expect, decodeErrorReason } = require('./test-utils');

const AppRegistry = artifacts.require('AppRegistry');
const Escrow = artifacts.require('ERC20Escrow');
const Exchange = artifacts.require('Exchange');
const SimpleToken = artifacts.require('SimpleToken');

contract('Exchange', async (accounts) => {
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
    const escrowSign = await escrow.TRANSACT_SELECTOR.call();
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
    escrow = await Escrow.new(exchange.address);
    token = await SimpleToken.new({ from: minter });
  });

  describe('preparing order', async () => {
    // happy path
    it('should able to prepare order', async () => {
      await apps.register('provider', { from: provider });

      const { escrowSign, escrowArgs } = await getEscrowArgs();

      const result = await exchange.prepare(
        'provider', consumer,
        escrow.address,
        escrowSign,
        escrowArgs,
        getDataIds(64),
        { from: provider },
      );

      await truffleAssert.eventEmitted(result, 'OfferPrepared', async (evt) => {
        const offer = await exchange.getOffer(evt.offerId.slice(0, 18));
        const app = await apps.get(offer.provider);

        const offerExists = await exchange.offerExists(evt.offerId.slice(0, 18));

        return (
          // event
          evt.by === app.hashedName
          && offerExists === true
        );
      });
    });

    it('should fail to prepare order if offeror app name is not registered', async () => {
      const { escrowSign, escrowArgs } = await getEscrowArgs();

      await truffleAssert.fails(
        exchange.prepare(
          'provider', consumer,
          escrow.address,
          escrowSign,
          escrowArgs,
          getDataIds(64),
          { from: provider },
        ),
        truffleAssert.ErrorType.REVERT,
        'provider app does not exist',
      );
    });

    it('should fail to prepare order if sender is not owner of provider app', async () => {
      await apps.register('provider', { from: provider });

      const { escrowSign, escrowArgs } = await getEscrowArgs();

      await truffleAssert.fails(
        exchange.prepare(
          'provider', consumer,
          escrow.address,
          escrowSign,
          escrowArgs,
          getDataIds(64),
          { from: stranger },
        ),
        truffleAssert.ErrorType.REVERT,
        'only provider app owner can prepare order',
      );
    });

    it('should fail to prepare order if dataIds length exceeds limit', async () => {
      await apps.register('provider', { from: provider });

      const { escrowSign, escrowArgs } = await getEscrowArgs();

      await truffleAssert.fails(
        exchange.prepare(
          'provider', consumer,
          escrow.address,
          escrowSign,
          escrowArgs,
          getDataIds(256),
          { from: provider },
        ),
        truffleAssert.ErrorType.REVERT,
        'dataIds length exceeded (max 128)',
      );
    });

    it('should fail to prepare order if escrow is not contract', async () => {
      await apps.register('provider', { from: provider });

      const { escrowSign, escrowArgs } = await getEscrowArgs();

      await truffleAssert.fails(
        exchange.prepare(
          'provider', consumer,
          consumer,
          escrowSign,
          escrowArgs,
          getDataIds(64),
          { from: provider },
        ),
        truffleAssert.ErrorType.REVERT,
        'not contract address',
      );
    });
  });

  describe('updating order', async () => {
    let dataIds;
    let offerId;

    beforeEach(async () => {
      await apps.register('provider', { from: provider });

      dataIds = getDataIds(200);
      const { escrowSign, escrowArgs } = await getEscrowArgs();

      const result = await exchange.prepare(
        'provider', consumer,
        escrow.address,
        escrowSign,
        escrowArgs,
        dataIds.slice(0, 20),
        { from: provider },
      );

      await truffleAssert.eventEmitted(result, 'OfferPrepared', (evt) => {
        offerId = evt.offerId.slice(0, 18);
        return true;
      });
    });

    // happy path
    it('should able to add dataIds', async () => {
      await exchange.addDataIds(offerId, dataIds.slice(20, 40), { from: provider });

      const offer = await exchange.getOffer(offerId);
      expect(offer.dataIds).to.have.members(dataIds.slice(0, 40));
    });

    it('should fail to add dataIds if sender is not owner of this app', async () => {
      await truffleAssert.fails(
        exchange.addDataIds(offerId, dataIds.slice(20, 40), { from: stranger }),
        truffleAssert.ErrorType.REVERT,
        'only provider app owner can update order',
      );
    });

    it('should fail to add dataIds if order is not on neutral state', async () => {
      // change order state
      await exchange.order(offerId);

      await truffleAssert.fails(
        exchange.addDataIds(offerId, dataIds.slice(20, 40), { from: provider }),
        truffleAssert.ErrorType.REVERT,
        'neutral state only',
      );
    });

    it('should fail to add dataIds if its length exceeds limlt', async () => {
      await truffleAssert.fails(
        exchange.addDataIds(offerId, dataIds.slice(20, 200), { from: provider }),
        truffleAssert.ErrorType.REVERT,
        'dataIds length exceeded (max 128)',
      );
    });
  });

  describe('submitting order', async () => {
    let offerId;

    beforeEach(async () => {
      await apps.register('provider', { from: provider });

      const { escrowSign, escrowArgs } = await getEscrowArgs();

      const result = await exchange.prepare(
        'provider', consumer,
        escrow.address,
        escrowSign,
        escrowArgs,
        getDataIds(64),
        { from: provider },
      );

      await truffleAssert.eventEmitted(result, 'OfferPrepared', (evt) => {
        offerId = evt.offerId.slice(0, 18);
        return true;
      });
    });

    // happy path
    it('should submit order', async () => {
      const result = await exchange.order(offerId, { from: provider });

      await truffleAssert.eventEmitted(result, 'OfferPresented', async (evt) => {
        const offer = await exchange.getOffer(evt.offerId.slice(0, 18));
        const app = await apps.get(offer.provider);

        return (
          evt.offerId.slice(0, 18) === offerId
          && evt.by === app.hashedName
        );
      });
    });

    it('should fail to submit order if order is not on neutral state', async () => {
      const result = await exchange.order(offerId, { from: provider });
      await truffleAssert.eventEmitted(result, 'OfferPresented');

      await truffleAssert.fails(
        exchange.order(offerId, { from: provider }),
        truffleAssert.ErrorType.REVERT,
        'neutral state only',
      );
    });

    it('should fail to submit order if sender is not owner of this app', async () => {
      await truffleAssert.fails(
        exchange.order(offerId, { from: stranger }),
        truffleAssert.ErrorType.REVERT,
        'only provider app owner can present order',
      );
    });
  });

  describe('canceling order', async () => {
    let offerId;

    beforeEach(async () => {
      await apps.register('provider', { from: provider });

      const { escrowSign, escrowArgs } = await getEscrowArgs();

      const result = await exchange.prepare(
        'provider', consumer,
        escrow.address,
        escrowSign,
        escrowArgs,
        getDataIds(64),
        { from: provider },
      );
      await truffleAssert.eventEmitted(result, 'OfferPrepared', (evt) => {
        offerId = evt.offerId.slice(0, 18);
        return true;
      });
      await exchange.order(offerId, { from: provider });
    });

    it('should cancel order', async () => {
      const result = await exchange.cancel(offerId, { from: provider });

      await truffleAssert.eventEmitted(result, 'OfferCanceled', async (evt) => {
        const offer = await exchange.getOffer(evt.offerId.slice(0, 18));
        const app = await apps.get(offer.provider);

        return (
          evt.offerId.slice(0, 18) === offerId
          && evt.by === app.hashedName
        );
      });
    });

    it('should fail to cancel order if order is not on pending state', async () => {
      const result = await exchange.cancel(offerId, { from: provider });
      await truffleAssert.eventEmitted(result, 'OfferCanceled');

      await truffleAssert.fails(
        exchange.cancel(offerId, { from: provider }),
        truffleAssert.ErrorType.REVERT,
        'pending state only',
      );
    });

    it('should fail to cancel order if sender is not owner of this app', async () => {
      await truffleAssert.fails(
        exchange.cancel(offerId, { from: stranger }),
        truffleAssert.ErrorType.REVERT,
        'only provider app owner can cancel order',
      );
    });
  });

  describe('settling order', async () => {
    const txAmount = new BN(web3.utils.toWei('100', 'ether'));

    let offerId;

    beforeEach(async () => {
      await apps.register('provider', { from: provider });

      const { escrowSign, escrowArgs } = await getEscrowArgs();

      const result = await exchange.prepare(
        'provider', consumer,
        escrow.address,
        escrowSign,
        escrowArgs,
        getDataIds(64),
        { from: provider },
      );
      await truffleAssert.eventEmitted(result, 'OfferPrepared', (evt) => {
        offerId = evt.offerId.slice(0, 18);
        return true;
      });
      await exchange.order(offerId);
    });

    it('should settle order', async () => {
      await token.mint(consumer, txAmount, { from: minter });
      await token.approve(escrow.address, txAmount, { from: consumer });

      let providerBalance = await token.balanceOf(provider);
      let consumerBalance = await token.balanceOf(consumer);

      const result = await exchange.settle(offerId, { from: consumer });
      await truffleAssert.eventEmitted(result, 'OfferSettled', evt => (
        evt.offerId.slice(0, 18) === offerId
          && evt.by === consumer
      ));
      await truffleAssert.eventEmitted(result, 'OfferReceipt', async (evt) => {
        const offer = await exchange.getOffer(evt.offerId.slice(0, 18));
        const app = await apps.get(offer.provider);

        return (
          evt.offerId.slice(0, 18) === offerId
          && evt.provider === app.hashedName
          && evt.consumer === consumer
        );
      });

      providerBalance = await token.balanceOf(provider) - providerBalance;
      consumerBalance -= await token.balanceOf(consumer);

      expect(providerBalance.toString()).to.be.equals(txAmount.toString());
      expect(consumerBalance.toString()).to.be.equals(txAmount.toString());
    });

    it('should fail to settle order if order is not on pending state', async () => {
      await token.mint(consumer, txAmount, { from: minter });
      await token.approve(escrow.address, txAmount, { from: consumer });

      const result = await exchange.settle(offerId, { from: consumer });
      await truffleAssert.eventEmitted(result, 'OfferSettled');
      await truffleAssert.eventEmitted(result, 'OfferReceipt');

      await truffleAssert.fails(
        exchange.settle(offerId, { from: consumer }),
        truffleAssert.ErrorType.REVERT,
        'pending state only',
      );
    });

    it('should fail to settle order if sender is not owner of this app', async () => {
      await token.mint(consumer, txAmount, { from: minter });
      await token.approve(escrow.address, txAmount, { from: consumer });

      await truffleAssert.fails(
        exchange.settle(offerId, { from: stranger }),
        truffleAssert.ErrorType.REVERT,
        'only consumer can settle order',
      );
    });

    it('should fail to settle order if order is outdated', async () => {
      await token.mint(consumer, txAmount, { from: minter });
      await token.approve(escrow.address, txAmount, { from: consumer });

      // skipping blocks
      for (let i = 0; i < 61; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await time.advanceBlock();
      }

      await truffleAssert.fails(
        exchange.settle(offerId, { from: consumer }),
        truffleAssert.ErrorType.REVERT,
        'outdated order',
      );
    });

    it('should get revert reason when failed to exec escrow contract', async () => {
      const result = await exchange.settle(offerId, { from: consumer });
      await truffleAssert.eventEmitted(result, 'EscrowExecutionFailed', evt => (
        decodeErrorReason(evt.reason) === 'low allowance'
      ));
    });

    // TODO: make bad escrow contract
    // it('should fail to settle order if unable to call escrow method', async () => {});
    // it('should fail to settle order if escrow method not contains offerId param', async () => {});
    // it('should fail to settle order if escrow method trying reentrancy attack', async () => {});
  });

  describe('rejecting order', async () => {
    let offerId;

    beforeEach(async () => {
      await apps.register('provider', { from: provider });

      const { escrowSign, escrowArgs } = await getEscrowArgs();

      const result = await exchange.prepare(
        'provider', consumer,
        escrow.address,
        escrowSign,
        escrowArgs,
        getDataIds(64),
        { from: provider },
      );
      await truffleAssert.eventEmitted(result, 'OfferPrepared', (evt) => {
        offerId = evt.offerId.slice(0, 18);
        return true;
      });
      await exchange.order(offerId);
    });

    it('should reject order', async () => {
      const result = await exchange.reject(offerId, { from: consumer });
      await truffleAssert.eventEmitted(result, 'OfferRejected', evt => (
        evt.offerId.slice(0, 18) === offerId
          && evt.by === consumer
      ));
    });

    it('should fail to reject order if sender is not authorized', async () => {
      await truffleAssert.fails(
        exchange.reject(offerId, { from: stranger }),
        truffleAssert.ErrorType.REVERT,
        'only consumer can reject order',
      );
    });

    it('should fail to reject order if order is not on pending state', async () => {
      const result = await exchange.reject(offerId, { from: consumer });
      await truffleAssert.eventEmitted(result, 'OfferRejected');
      await truffleAssert.fails(
        exchange.reject(offerId, { from: consumer }),
        truffleAssert.ErrorType.REVERT,
        'pending state only',
      );
    });
  });
});
