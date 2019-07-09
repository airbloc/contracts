const truffleAssert = require('truffle-assertions');
const { expect, getFirstEvent, createPasswordSignature } = require('./test-utils');

const Consents = artifacts.require('Consents');
const Accounts = artifacts.require('Accounts');
const AppRegistry = artifacts.require('AppRegistry');
const DataTypeRegistry = artifacts.require('DataTypeRegistry');
const ControllerRegistry = artifacts.require('ControllerRegistry');

// test data
const APP_NAME = 'test-app';
const DATA_TYPE = 'gps-data';
const DATA_SCHEMA = '{"type": "string", "default": "Just Test GPS Data."}';
const SCHEMA_HASH = web3.utils.keccak256(DATA_SCHEMA);
const TEST_USER_ID = web3.utils.keccak256('test@airbloc.org');
const TEST_USER_ID_HASH = web3.utils.keccak256(TEST_USER_ID);
const TEST_USER_PASSWORD = 'AiRbLoC';

// enums (defined as Consents.ActionTypes)
const ACTION_COLLECTION = 0;

contract('Consents', async (ethAccounts) => {
  const [contractOwner, user, app, controller, stranger] = ethAccounts;
  let userId;
  let apps;
  let controllers;
  let dataTypes;
  let accounts;
  let consents;

  before(async () => {
    apps = await AppRegistry.new();
    controllers = await ControllerRegistry.new();
    dataTypes = await DataTypeRegistry.new();
    accounts = await Accounts.new(controllers.address);

    await apps.register(APP_NAME, { from: app });
    await controllers.register(controller, { from: contractOwner });
    await dataTypes.register(DATA_TYPE, SCHEMA_HASH, { from: app });

    // create an Airbloc account with ID and password,
    // and register the data controller as a delegate of it.
    const result = await accounts.createTemporary(TEST_USER_ID_HASH, { from: controller });
    const passwordSig = createPasswordSignature([TEST_USER_ID, user], TEST_USER_PASSWORD);
    await accounts.unlockTemporary(TEST_USER_ID, user, passwordSig, { from: controller });

    const signUpEvent = getFirstEvent(result);
    userId = signUpEvent.accountId;
  });

  beforeEach(async () => {
    // should create new contract for each test
    consents = await Consents.new(
      accounts.address,
      apps.address,
      controllers.address,
      dataTypes.address,
    );
  });

  describe('#consent()', () => {
    it('should fail if the app does not exist', async () => {
      await truffleAssert.fails(
        consents.consent(ACTION_COLLECTION, 'WRONG_APP_NAME', DATA_TYPE, true, { from: user }),
        truffleAssert.ErrorType.REVERT,
        'app',
      );
    });

    it('should fail when the user is unregistered', async () => {
      await truffleAssert.fails(
        consents.consent(ACTION_COLLECTION, APP_NAME, DATA_TYPE, true, { from: stranger }),
        truffleAssert.ErrorType.REVERT,
        'unknown address',
      );
    });

    it('should fail when the data type is not registered', async () => {
      await truffleAssert.fails(
        consents.consent(ACTION_COLLECTION, APP_NAME, 'WRONG_DATA_TYPE', true, { from: user }),
        truffleAssert.ErrorType.REVERT,
        'data type',
      );
    });

    context('when first time', async () => {
      it('should be done correctly', async () => {
        const txReceipt = await consents.consent(ACTION_COLLECTION, APP_NAME, DATA_TYPE, true, {
          from: user,
        });
        truffleAssert.eventEmitted(
          txReceipt,
          'Consented',
          event => event.action.toNumber() === ACTION_COLLECTION
            && event.appName === APP_NAME
            && event.dataType === DATA_TYPE
            && event.userId.slice(0, 18) === userId
            && event.allowed === true,
        );
      });
    });

    context('when modifying a consent', async () => {
      it('should modify correctly', async () => {
        await consents.consent(ACTION_COLLECTION, APP_NAME, DATA_TYPE, true, { from: user });
        await expect(consents.isAllowed(ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE)).to.be
          .eventually.be.true;

        await consents.consent(ACTION_COLLECTION, APP_NAME, DATA_TYPE, false, { from: user });
        await expect(consents.isAllowed(ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE)).to.be
          .eventually.be.false;
      });
    });
  });

  describe('#consentByController()', () => {
    it('should fail when it called by others (e.g. apps)', async () => {
      await truffleAssert.fails(
        consents.consentByController(ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE, true, {
          from: app,
        }),
        truffleAssert.ErrorType.REVERT,
        'not a data controller',
      );
    });

    it('should fail if the app does not exist', async () => {
      await truffleAssert.fails(
        consents.consentByController(
          ACTION_COLLECTION,
          userId,
          'UNKNOWN_APP_NAME',
          DATA_TYPE,
          true,
          { from: controller },
        ),
        truffleAssert.ErrorType.REVERT,
        'app does not exist',
      );
    });

    it('should fail when the user is unregistered', async () => {
      const registrationEvent = getFirstEvent(await accounts.create({ from: stranger }));
      const unregisteredUserId = registrationEvent.accountId;

      await truffleAssert.fails(
        consents.consentByController(
          ACTION_COLLECTION,
          unregisteredUserId,
          APP_NAME,
          DATA_TYPE,
          true,
          { from: controller },
        ),
        truffleAssert.ErrorType.REVERT,
        'must be delegate of this user',
      );
    });

    it('should fail when the data type is not registered', async () => {
      await truffleAssert.fails(
        consents.consentByController(
          ACTION_COLLECTION,
          userId,
          APP_NAME,
          'UNKNOWN_DATA_TYPE',
          true,
          { from: controller },
        ),
        truffleAssert.ErrorType.REVERT,
        'data type',
      );
    });

    context('when first time', async () => {
      it('should be done correctly', async () => {
        const txReceipt = await consents.consentByController(
          ACTION_COLLECTION,
          userId,
          APP_NAME,
          DATA_TYPE,
          true,
          { from: controller },
        );
        truffleAssert.eventEmitted(
          txReceipt,
          'Consented',
          event => event.action.toNumber() === ACTION_COLLECTION
            && event.appName === APP_NAME
            && event.dataType === DATA_TYPE
            && event.userId.slice(0, 18) === userId
            && event.allowed === true,
        );
      });
    });

    context('when modifying a consent', async () => {
      it('should fail', async () => {
        await consents.consentByController(
          ACTION_COLLECTION,
          userId,
          APP_NAME,
          DATA_TYPE,
          true,
          { from: controller },
        );
        await truffleAssert.fails(
          consents.consentByController(
            ACTION_COLLECTION,
            userId,
            APP_NAME,
            DATA_TYPE,
            false,
            { from: controller },
          ),
          truffleAssert.ErrorType.REVERT,
          "can't modify",
        );
      });
    });
  });

  describe('#modifyConsentByController()', () => {
    /**
     * An wrapper of Consents#modifyConsentByController(),
     * which automatically adds password signature onto a method call.
     */
    async function callModifyConsentByController(
      action,
      accountId,
      appName,
      dataType,
      allowed,
      options = { from: controller },
      password = TEST_USER_PASSWORD,
    ) {
      // additional informations are required for packed ABI encodings
      const typedParams = [
        { type: 'uint8', value: action },
        { type: 'bytes8', value: accountId },
        { type: 'string', value: appName },
        { type: 'string', value: dataType },
        { type: 'bool', value: allowed },
      ];
      const passwordSig = createPasswordSignature(typedParams, password);
      return consents.modifyConsentByController(
        action, accountId, appName, dataType, allowed, passwordSig, options,
      );
    }

    context('when first time', async () => {
      it('should modify correctly', async () => {
        await callModifyConsentByController(
          ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE, true,
          { from: controller },
        );
        await expect(consents.isAllowed(ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE))
          .to.eventually.be.true;
      });
    });

    context('when modifying a consent', async () => {
      beforeEach(async () => {
        await consents.consentByController(
          ACTION_COLLECTION,
          userId,
          APP_NAME,
          DATA_TYPE,
          true,
          { from: controller },
        );
      });

      it('should modify correctly', async () => {
        await callModifyConsentByController(
          ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE, false,
          { from: controller },
        );
        await expect(consents.isAllowed(ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE))
          .to.eventually.be.false;
      });

      it('should fail when password mismatches', async () => {
        const tx = callModifyConsentByController(
          ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE, false,
          { from: controller },
          'WRONG_PASSWORD',
        );
        await truffleAssert.fails(tx, truffleAssert.ErrorType.REVERT, 'password');
      });

      it('should fail when it called by others (e.g. apps)', async () => {
        const tx = callModifyConsentByController(
          ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE, false,
          { from: stranger },
        );
        await truffleAssert.fails(tx, truffleAssert.ErrorType.REVERT, 'data controller');
      });

      it('should fail if the called controller is not a delegate of the user', async () => {
        await controllers.register(stranger, { from: contractOwner });
        const tx = callModifyConsentByController(
          ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE, false,
          { from: stranger },
        );
        await truffleAssert.fails(tx, truffleAssert.ErrorType.REVERT, 'delegate');
      });
      
      it('should fail if the app does not exist', async () => {
        const tx = callModifyConsentByController(
          ACTION_COLLECTION, userId, 'UNKNOWN_APP_NAME', DATA_TYPE, false,
          { from: controller },
        );
        await truffleAssert.fails(tx, truffleAssert.ErrorType.REVERT, 'app');
      });

      it('should fail when the user is unregistered', async () => {
        const unknownUserId = '0xdeadbeefdeadbeef';
        const tx = callModifyConsentByController(
          ACTION_COLLECTION, unknownUserId, APP_NAME, DATA_TYPE, false,
          { from: controller },
        );
        await truffleAssert.fails(tx, truffleAssert.ErrorType.REVERT);
      });

      it('should fail when the data type is not registered', async () => {
        const tx = callModifyConsentByController(
          ACTION_COLLECTION, userId, APP_NAME, 'UNKNOWN_DATA_TYPE', false,
          { from: controller },
        );
        await truffleAssert.fails(tx, truffleAssert.ErrorType.REVERT, 'data type');
      });
    });
  });

  describe('#isAllowed()', () => {
    it('should return whether user is consented at the current moment', async () => {
      await consents.consent(ACTION_COLLECTION, APP_NAME, DATA_TYPE, true, { from: user });
      await expect(consents.isAllowed(ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE)).to.be
        .eventually.be.true;
    });
  });

  describe('#isAllowedAt()', () => {
    it('should return whether user is consented at the past', async () => {
      await consents.consent(ACTION_COLLECTION, APP_NAME, DATA_TYPE, true, { from: user });
      await consents.consent(ACTION_COLLECTION, APP_NAME, DATA_TYPE, false, { from: user });

      const past = (await web3.eth.getBlockNumber()) - 1;
      await expect(consents.isAllowedAt(ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE, past))
        .to.eventually.be.true;
    });
  });
});
