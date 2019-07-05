const truffleAssert = require('truffle-assertions');

const Web3 = require('web3');

const web3 = new Web3();
const crypto = require('crypto');
const { expect } = require('./test-utils');

const AppRegistry = artifacts.require('AppRegistry');
const Escrow = artifacts.require('ERC20Escrow');
const Exchange = artifacts.require('Exchange');
const TestToken = artifacts.require('SimpleToken');

contract('Exchange', async (accounts) => {
  const [provider, consumer, stranger] = accounts;
  let apps;
  let exchange;
  let token;

  async function getEscrowArgs() {
    const escrow = await Escrow.new(exchange.address);

    const transactSignature = await escrow.TRANSACT_SIGNATURE.call();
    const escrowSign = web3.eth.abi.encodeFunctionSignature(transactSignature);
    const escrowArgs = web3.eth.abi.encodeParameters(
      ['address', 'uint256'],
      [token.address, web3.utils.toWei('100', 'ether')],
    );
    const dataIds = [];
    for (let i = 0; i < 256; i += 1) {
      dataIds.push(`0x${crypto.randomBytes(20).toString('hex')}`);
    }

    return {
      escrow,
      escrowSign,
      escrowArgs,
      dataIds,
    };
  }

  beforeEach(async () => {
    apps = await AppRegistry.new();
    exchange = await Exchange.new(apps.address);
    token = await TestToken.new({ from: provider });
  });

  describe('preparing order', async () => {
    // happy path
    it('should able to prepare order', async () => {
      await apps.register('provider', { from: provider });

      const {
        escrow,
        escrowSign, escrowArgs, dataIds,
      } = await getEscrowArgs();

      const result = await exchange.prepare(
        'provider', consumer,
        escrow.address,
        escrowSign,
        escrowArgs,
        dataIds.slice(0, 64),
      );

      await truffleAssert.eventEmitted(result, 'OfferPrepared', async (evt) => {
        const offer = await exchange.getOffer(evt.offerId.slice(0, 18));

        return (
          // event
          evt.by === provider.address

          // offer
          && offer.from === 'me'
          && offer.to === 'strange'
          && offer.at === 0
          && offer.until === 0
          && offer.escrow.addr === escrow.address
          && offer.escrow.sign === escrowSign
          && offer.escrow.args === escrowArgs
          && offer.status === 0
        );
      });
    });

    it('should fail to prepare order if offeror app name is not registered', async () => {
      const {
        escrow,
        escrowSign, escrowArgs, dataIds,
      } = await getEscrowArgs();

      await truffleAssert.fails(
        exchange.prepare(
          'provider', consumer,
          escrow.address,
          escrowSign,
          escrowArgs,
          dataIds.slice(0, 64),
        ),
        truffleAssert.ErrorType.REVERT,
        'offeror app does not exist',
      );
    });

    it('should fail to prepare order if sender is not owner of offeror app', async () => {
      await apps.register('provider', { from: provider });

      const {
        escrow,
        escrowSign, escrowArgs, dataIds,
      } = await getEscrowArgs();

      await truffleAssert.fails(
        exchange.prepare(
          'provider', consumer,
          escrow.address,
          escrowSign,
          escrowArgs,
          dataIds.slice(0, 64),
          { from: stranger },
        ),
        truffleAssert.ErrorType.REVERT,
        'should have required authority',
      );
    });

    it('should fail to prepare order if dataIds length exceeds limit', async () => {
      await apps.register('provider', { from: provider });

      const {
        escrow,
        escrowSign, escrowArgs, dataIds,
      } = await getEscrowArgs();

      await truffleAssert.fails(
        exchange.prepare(
          'provider', consumer,
          escrow.address,
          escrowSign,
          escrowArgs,
          dataIds,
        ),
        truffleAssert.ErrorType.REVERT,
        'dataIds length exceeded (max 128)',
      );
    });

    it('should fail to prepare order if escrow is not contract', async () => {
      await apps.register('provider', { from: provider });

      const {
        escrowSign, escrowArgs, dataIds,
      } = await getEscrowArgs();

      await truffleAssert.fails(
        exchange.prepare(
          'provider', consumer,
          consumer,
          escrowSign,
          escrowArgs,
          dataIds.slice(0, 64),
        ),
        truffleAssert.ErrorType.REVERT,
        'not contract address',
      );
    });
  });

  describe('updating order', async () => {
    // happy path
    it('should able to add dataIds', async () => {
      await apps.register('provider', { from: provider });

      const {
        escrow,
        escrowSign, escrowArgs, dataIds,
      } = await getEscrowArgs();

      const result = await exchange.prepare(
        'provider', consumer,
        escrow.address,
        escrowSign,
        escrowArgs,
        dataIds.slice(0, 20),
      );

      await truffleAssert.eventEmitted(result, 'OfferPrepared', async (evt) => {
        await exchange.addDataIds(evt.offerId.slice(0, 18), dataIds.slice(20, 40));
        const offer = await exchange.getOffer(evt.offerId.slice(0, 18));

        expect(offer.dataIds).to.have.members(dataIds.slice(0, 40));
      });
    });

    it('should fail to add dataIds if sender is not owner of this app', async () => {
      await apps.register('provider', { from: provider });

      const {
        escrow,
        escrowSign, escrowArgs, dataIds,
      } = await getEscrowArgs();

      const result = await exchange.prepare(
        'provider', consumer,
        escrow.address,
        escrowSign,
        escrowArgs,
        dataIds.slice(0, 20),
      );

      await truffleAssert.eventEmitted(result, 'OfferPrepared', async (evt) => {
        await truffleAssert.fails(
          exchange.addDataIds(evt.offerId.slice(0, 18), dataIds.slice(20, 40), { from: consumer }),
          truffleAssert.ErrorType.REVERT,
          'should have required authority',
        );
      });
    });

    it('should fail to add dataIds if order is not on neutral state', async () => {
      await apps.register('provider', { from: provider });

      const {
        escrow,
        escrowSign, escrowArgs, dataIds,
      } = await getEscrowArgs();

      const result = await exchange.prepare(
        'provider', consumer,
        escrow.address,
        escrowSign,
        escrowArgs,
        dataIds.slice(0, 20),
      );

      await truffleAssert.eventEmitted(result, 'OfferPrepared', async (evt) => {
        // change order state
        await exchange.order(evt.offerId.slice(0, 18));

        await truffleAssert.fails(
          exchange.addDataIds(evt.offerId.slice(0, 18), dataIds.slice(20, 40)),
          truffleAssert.ErrorType.REVERT,
          'neutral state only',
        );
      });
    });

    it('should fail to add dataIds if its length exceeds limlt', async () => {
      await apps.register('provider', { from: provider });

      const {
        escrow,
        escrowSign, escrowArgs, dataIds,
      } = await getEscrowArgs();

      const result = await exchange.prepare(
        'provider', consumer,
        escrow.address,
        escrowSign,
        escrowArgs,
        dataIds.slice(0, 20),
      );

      await truffleAssert.eventEmitted(result, 'OfferPrepared', async (evt) => {
        await truffleAssert.fails(
          exchange.addDataIds(evt.offerId.slice(0, 18), dataIds.slice(20, 200)),
          truffleAssert.ErrorType.REVERT,
          'dataIds length exceeded (max 128)',
        );
      });
    });
  });

  describe('submitting order', async () => {
    let offerId;

    beforeEach(async () => {
      await apps.register('provider', { from: provider });

      const {
        escrow,
        escrowSign, escrowArgs, dataIds,
      } = await getEscrowArgs();

      const result = await exchange.prepare(
        'provider', consumer,
        escrow.address,
        escrowSign,
        escrowArgs,
        dataIds.slice(0, 20),
      );

      await truffleAssert.eventEmitted(result, 'OfferPrepared', async (evt) => {
        offerId = evt.offerId.slice(0, 18);

        return (
          evt.by === provider.address
        );
      });
    });

    // happy path
    it('should submit order', async () => {
      const result = await exchange.order(offerId);

      await truffleAssert.eventEmitted(result, 'OfferPresented', async evt => (
        evt.offerId.slice(0, 18) === offerId
          && evt.by === provider.address
      ));
    });

    it('should fail to submit order if order is not on neutral state', async () => {
      const result = await exchange.order(offerId);
      await truffleAssert.eventEmitted(result, 'OfferPresented');

      await truffleAssert.fails(
        exchange.order(offerId),
        truffleAssert.ErrorType.REVERT,
        'neutral state only',
      );
    });

    it('should fail to submit order if sender is not owner of this app', async () => {
      await truffleAssert.fails(
        exchange.order(offerId, { from: consumer }),
        truffleAssert.ErrorType.REVERT,
        'should have required authority',
      );
    });
  });

  describe('canceling order', async () => {
    let offerId;

    beforeEach(async () => {
      await apps.register('provider', { from: provider });

      const {
        escrow, escrowSign, escrowArgs, dataIds,
      } = await getEscrowArgs();

      let result = await exchange.prepare(
        'provider', consumer,
        escrow.address,
        escrowSign,
        escrowArgs,
        dataIds.slice(0, 20),
      );

      await truffleAssert.eventEmitted(result, 'OfferPrepared', async (evt) => {
        offerId = evt.offerId.slice(0, 18);

        return (
          evt.by === provider.address
        );
      });

      result = await exchange.order(offerId);
      await truffleAssert.eventEmitted(result, 'OfferPresented', async evt => (
        evt.offerId === offerId
          && evt.by === provider.address
      ));
    });

    it('should cancel order', async () => {
      const result = await exchange.cancel(offerId);

      await truffleAssert.eventEmitted(result, 'OfferCanceled', async evt => (
        evt.offerId === offerId
          && evt.by === provider.address
      ));
    });

    it('should fail to cancel order if order is not on pending state', async () => {
      const result = await exchange.cancel(offerId);
      await truffleAssert.eventEmitted(result, 'OfferCanceled');

      await truffleAssert.fails(
        exchange.cancel(offerId),
        truffleAssert.ErrorType.REVERT,
        'pending state only',
      );
    });

    it('should fail to cancel order if sender is not owner of this app', async () => {
      await truffleAssert.fails(
        exchange.cancel(offerId, { from: consumer }),
        truffleAssert.ErrorType.REVERT,
        'should have required authority',
      );
    });
  });

  describe('settling order', async () => {
    let offerId;
    let escrow;

    beforeEach(async () => {
      await apps.register('provider', { from: provider });

      escrow = await Escrow.new(exchange.address);

      const {
        escrowSign, escrowArgs, dataIds,
      } = await getEscrowArgs();

      let result = await exchange.prepare(
        'provider', consumer,
        escrow.address,
        escrowSign,
        escrowArgs,
        dataIds.slice(0, 64),
      );

      await truffleAssert.eventEmitted(result, 'OfferPrepared', async (evt) => {
        offerId = evt.offerId.slice(0, 18);

        return (
          evt.by === provider.address
        );
      });

      result = await exchange.order(offerId);
      await truffleAssert.eventEmitted(result, 'OfferPresented', async evt => (
        evt.offerId.slice(0, 18) === offerId
          && evt.by === provider.address
      ));
    });

    it('should settle order', async () => {
      await token.mint(consumer, web3.utils.toWei('200', 'ether'), { from: provider });
      await token.approve(escrow.address, web3.utils.toWei('200', 'ether'), { from: consumer });

      const result = await exchange.settle(offerId, { from: consumer });
      await truffleAssert.eventEmitted(result, 'OfferSettled', evt => (
        evt.offerId.slice(0, 18) === offerId
          && evt.by === consumer
      ));
      await truffleAssert.eventEmitted(result, 'OfferReceipt', evt => (
        evt.offerId.slice(0, 18) === offerId
      ));

      // TODO: compare token balance
    });

    it('should fail to settle order if order is not on pending state', async () => {
      await token.mint(consumer, web3.utils.toWei('100', 'ether'), { from: provider });
      await token.approve(escrow.address, web3.utils.toWei('100', 'ether'), { from: consumer });

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
      await token.mint(consumer, web3.utils.toWei('100', 'ether'), { from: provider });
      await token.approve(escrow.address, web3.utils.toWei('100', 'ether'), { from: consumer });

      await truffleAssert.fails(
        exchange.settle(offerId),
        truffleAssert.ErrorType.REVERT,
        'should have required authority',
      );
    });

    // TODO
    // it('should fail to settle order if order is outdated', async () => {
    //   await token.mint(stranger, web3.utils.toWei('100', 'ether'), { from: me });
    //   await token.approve(escrow.address, web3.utils.toWei('100', 'ether'), { from: stranger });

    //   // skipping blocks

    //   await truffleAssert.fails(
    //     exchange.settle(offerId),
    //     truffleAssert.ErrorType.REVERT,
    //     'outdated order',
    //   );
    // });

    // TODO: make bad escrow contract
    it('should fail to settle order if unable to call escrow method', async () => {});
    it('should fail to settle order if escrow method not contains offerId param', async () => {});
    it('should fail to settle order if escrow method trying reentrancy attack', async () => {});
  });

  describe('rejecting order', async () => {
    it('should reject order', async () => {});
  });
});
