const truffleAssert = require('truffle-assertions');
const { expect } = require('./test-utils');

const Web3 = require('web3');
const web3 = new Web3();
const crypto = require('crypto');

const AppRegistry = artifacts.require('AppRegistry');
const Escrow = artifacts.require('Escrow');
const Exchange = artifacts.require('Exchange');
const TestToken = artifacts.require('SimpleToken');

const zeroAddr = "0x0000000000000000000000000000000000000000";

contract('Exchange', async (accounts) => {
  const [me, stranger] = accounts;
  let apps;
  let exchange;
  let token;

  const registerApp = async (appName, sender) => {
    await apps.register(appName, { from: sender });
    
    const app = await apps.get(appName);
    expect(app.name).to.equal(appName);
    expect(app.owner).to.equal(sender);
  };

  const getEscrowArgs = async () => {
    const escrow = await Escrow.new(exchange.address);

    const transactSignature = await escrow.TRANSACT_SIGNATURE.call();
    const escrowSign = web3.eth.abi.encodeFunctionSignature(transactSignature);
    const escrowArgs = web3.eth.abi.encodeParameters(
      ['address', 'uint256'],
      [token.address, web3.utils.toWei('100', 'ether')],
    );
    const dataIds = [];
    for (i = 0; i < 256; i++) {
      dataIds.push('0x'+crypto.randomBytes(20).toString('hex'));
    }
    
    return {
      escrow: escrow,
      escrowSign: escrowSign,
      escrowArgs: escrowArgs,
      dataIds: dataIds,
    };
  };

  beforeEach(async () => {
    apps = await AppRegistry.new();
    exchange = await Exchange.new(apps.address);
    token = await TestToken.new();
  });

  describe('preparing order', async () => {
    // happy path
    it('should able to prepare order', async () => {
      await registerApp('me', me);
      await registerApp('stranger', stranger);
      
      const { escrow, escrowSign, escrowArgs, dataIds } = await getEscrowArgs();

      const result = await exchange.prepare(
        'me', 'stranger',
        escrow.address,
        escrowSign,
        escrowArgs, 
        dataIds.slice(0, 64),
      );
      
      await truffleAssert.eventEmitted(result, 'OfferPrepared', async (evt) => {
          const offer = await exchange.getOffer(evt.offerId.slice(0, 20));

          return (
            // event
            evt.by == me.address &&
            evt.at == result.receipt.blockNumber &&

            // offer
            offer.from == 'me' &&
            offer.to == 'strange' &&
            offer.at == 0 &&
            offer.until == 0 &&
            offer.escrow.addr == escrow.address &&
            offer.escrow.sign == escrowSign &&
            offer.escrow.args == escrowArgs &&
            offer.status == 0
          );
      });
    });

    it('should fail to prepare order if offeror app name is not registered', async () => {
      await registerApp('stranger', stranger);
      
      const { escrow, escrowSign, escrowArgs, dataIds } = await getEscrowArgs();

      await truffleAssert.fails(
        exchange.prepare(
          'me', 'stranger', 
          escrow.address,
          escrowSign,
          escrowArgs,
          dataIds.slice(0, 64),
        ),
        truffleAssert.ErrorType.REVERT,
        "offeror app does not exist",
      )
    });

    it('should fail to prepare order if sender is not owner of offeror app', async () => {
      await registerApp('me', me);
      await registerApp('stranger', stranger);

      const { escrow, escrowSign, escrowArgs, dataIds } = await getEscrowArgs();

      await truffleAssert.fails(
        exchange.prepare(
          'me', 'stranger', 
          escrow.address,
          escrowSign,
          escrowArgs,
          dataIds.slice(0, 64),
          { from: stranger },
        ),
        truffleAssert.ErrorType.REVERT,
        "should have required authority",
      )
    
    });

    it('should fail to prepare order if offeree app name is not registered', async () => {
      await registerApp('me', me);
  
      const { escrow, escrowSign, escrowArgs, dataIds } = await getEscrowArgs();

      await truffleAssert.fails(
        exchange.prepare(
          'me', 'stranger', 
          escrow.address,
          escrowSign,
          escrowArgs,
          dataIds.slice(0, 64),
        ),
        truffleAssert.ErrorType.REVERT,
        "offeree app does not exist",
      )
    });

    it('should fail to prepare order if dataIds length exceeds limit', async () => {
      await registerApp('me', me);
      await registerApp('stranger', stranger);

      const { escrow, escrowSign, escrowArgs, dataIds } = await getEscrowArgs();

      await truffleAssert.fails(
        exchange.prepare(
          'me', 'stranger',
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
      await registerApp('me', me)
      await registerApp('stranger', stranger);

      const { escrow, escrowSign, escrowArgs, dataIds } = await getEscrowArgs();

      await truffleAssert.fails(
        exchange.prepare(
          'me', 'stranger',
          stranger,
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
      await registerApp('me', me);
      await registerApp('stranger', stranger);
  
      const { escrow, escrowSign, escrowArgs, dataIds } = await getEscrowArgs();

      const result = await exchange.prepare(
        'me', 'stranger',
        escrow.address,
        escrowSign,
        escrowArgs, 
        dataIds.slice(0, 20),
      );

      await truffleAssert.eventEmitted(result, 'OfferPrepared', async (evt) => {
        await exchange.addDataIds(evt.offerId.slice(0, 20), dataIds.slice(20, 40));
        const offer = await exchange.getOffer(evt.offerId.slice(0, 20));

        expect(offer.dataIds).to.have.members(dataIds.slice(0, 40));
      });
    });

    it('should fail to add dataIds if sender is not owner of this app', async () => {
      await registerApp('me', me);
      await registerApp('stranger', stranger);

      const { escrow, escrowSign, escrowArgs, dataIds } = await getEscrowArgs();

      const result = await exchange.prepare(
        'me', 'stranger',
        escrow.address,
        escrowSign,
        escrowArgs,
        dataIds.slice(0, 20),
      );

      await truffleAssert.eventEmitted(result, 'OfferPrepared', async (evt) => {
        await truffleAssert.fails(
          exchange.addDataIds(evt.offerId.slice(0, 20), dataIds.slice(20, 40), { from: stranger }),
          truffleAssert.ErrorType.REVERT,
          'should have required authority',
        );
      });
    });

    it('should fail to add dataIds if order is not on neutral state', async () => {
      await registerApp('me', me);
      await registerApp('stranger', stranger);

      const { escrow, escrowSign, escrowArgs, dataIds } = await getEscrowArgs();

      const result = await exchange.prepare(
        'me', 'stranger',
        escrow.address,
        escrowSign,
        escrowArgs,
        dataIds.slice(0, 20),
      );

      await truffleAssert.eventEmitted(result, 'OfferPrepared', async (evt) => {
        // change order state
        await exchange.order(evt.offerId.slice(0, 20));

        await truffleAssert.fails(
          exchange.addDataIds(evt.offerId.slice(0, 20), dataIds.slice(20, 40)),
          truffleAssert.ErrorType.REVERT,
          'neutral state only',
        );
      });
    });

    it('should fail to add dataIds if its length exceeds limlt', async () => {
      await registerApp('me', me);
      await registerApp('stranger', stranger);

      const { escrow, escrowSign, escrowArgs, dataIds } = await getEscrowArgs();

      const result = await exchange.prepare(
        'me', 'stranger',
        escrow.address,
        escrowSign,
        escrowArgs,
        dataIds.slice(0, 20),
      );

      await truffleAssert.eventEmitted(result, 'OfferPrepared', async (evt) => {
        await truffleAssert.fails(
          exchange.addDataIds(evt.offerId.slice(0, 20), dataIds.slice(20, 200)),
          truffleAssert.ErrorType.REVERT,
          'dataIds length exceeded (max 128)',
        );
      });
    });
  })

  describe('submitting order', async () => {
    let offerId;

    beforeEach(async () => {
      await registerApp('me', me);
      await registerApp('stranger', stranger);

      const { escrow, escrowSign, escrowArgs, dataIds } = await getEscrowArgs();

      const result = await exchange.prepare(
        'me', 'stranger',
        escrow.address,
        escrowSign,
        escrowArgs,
        dataIds.slice(0, 20),
      );

      await truffleAssert.eventEmitted(result, 'OfferPrepared', async (evt) => {
        offerId = evt.offerId.slice(0, 20);

        return (
          evt.by == me.address && 
          evt.at == result.receipt.blockNumber
        );
      });
    });
    
    // happy path
    it('should submit order', async () => {
      const result = await exchange.order(offerId);

      await truffleAssert.eventEmitted(result, 'OfferPresented', async (evt) => {
        return (
          evt.offerId.slice(0, 20) == offerId && 
          evt.by == me.address && 
          evt.at == result.receipt.blockNumber
        );
      });
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
        exchange.order(offerId, { from: stranger}),
        truffleAssert.ErrorType.REVERT,
        'should have required authority',
      );
    });
  });

  describe('canceling order', async () => {
    let offerId;

    beforeEach(async () => {
      await registerApp('me', me);
      await registerApp('stranger', stranger);

      const { escrow, escrowSign, escrowArgs, dataIds } = await getEscrowArgs();

      let result = await exchange.prepare(
        'me', 'stranger',
        escrow.address,
        escrowSign,
        escrowArgs,
        dataIds.slice(0, 20),
      );

      await truffleAssert.eventEmitted(result, 'OfferPrepared', async (evt) => {
        offerId = evt.offerId.slice(0, 20);

        return (
          evt.by == me.address && 
          evt.at == result.receipt.blockNumber
        );
      });

      result = await exchange.order(offerId);
      await truffleAssert.eventEmitted(result, 'OfferPresented', async (evt) => {
        return (
          evt.offerId == offerId &&
          evt.by == me.address &&
          evt.at == result.receipt.blockNumber
        );
      });
    });

    it('should cancel order', async () => {
      const result = await exchange.cancel(offerId);
      
      await truffleAssert.eventEmitted(result, 'OfferCanceled', async (evt) => {
        return (
          evt.offerId == offerId &&
          evt.by == me.address &&
          evt.at == result.receipt.blockNumber
        );
      });
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
        exchange.cancel(offerId, { from: stranger }),
        truffleAssert.ErrorType.REVERT,
        'should have required authority',
      );
    });
  });

  describe('settling order', async () => {
    it('should settle order', async () => {
      await registerApp('me', me);
      await registerApp('stranger', stranger);
      
      const { escrow, escrowSign, escrowArgs, dataIds } = await getEscrowArgs();

      let result = await exchange.prepare(
        'me', 'stranger',
        escrow.address,
        escrowSign,
        escrowArgs, 
        dataIds.slice(0, 64),
      );
      let offerId;

      await truffleAssert.eventEmitted(result, 'OfferPrepared', async (evt) => { 
        offerId = evt.offerId.slice(0, 20);

        return (
          evt.by == me.address &&
          evt.at == result.receipt.blockNumber
        );
      });
      
      result = await exchange.order(offerId);
      await truffleAssert.eventEmitted(result, 'OfferPresented', async (evt) => {
        return (
          evt.offerId.slice(0, 20) == offerId &&
          evt.by == me.address &&
          evt.at == result.receipt.blockNumber
        );
      });

      await token.approve(escrow.address, web3.utils.toWei('100', 'ether'));
      
      result = await exchange.settle(offerId, { from: stranger });
      await truffleAssert.eventEmitted(result, 'OfferSettled', console.log);
      await truffleAssert.eventEmitted(result, 'OfferReceipt', console.log);
    });

    it('should fail to settle order if order is not on pending state', async () => {});
    it('should fail to settle order if sender is not owner of this app', async () => {});
    it('should fail to settle order if order is outdated', async () => {});
    it('should fail to settle order if unable to call escrow method', async () => {});
    it('should fail to settle order if escrow args is not valid', async () => {});
    it('should fail to settle order if escrow sign is not valid', async () => {});
    // TODO: make bad escrow contract
    it('should fail to settle order if escrow method not contains offerId param', async () => {});
    it('should fail to settle order if escrow method trying reentrancy attack', async () => {});
  });

  describe('rejecting order', async () => {
    it('should reject order', async () => {});
  });

});
