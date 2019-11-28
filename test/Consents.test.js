const { BN, expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const { expect, getFirstEvent, createPasswordSignature } = require('./test-utils');

const Consents = artifacts.require('Consents');
const Accounts = artifacts.require('Accounts');
const AppRegistry = artifacts.require('AppRegistry');
const DataTypeRegistry = artifacts.require('DataTypeRegistry');
const ControllerRegistry = artifacts.require('ControllerRegistry');

// test data
const APP_NAME = 'test-app';
const DATA_TYPE_GPS = 'gps-data';
const DATA_TYPE_EMAIL = 'email-data';
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
    dataTypes = await DataTypeRegistry.new();

    await apps.register(APP_NAME, { from: app });
    await dataTypes.register(DATA_TYPE_GPS, SCHEMA_HASH, { from: app });
    await dataTypes.register(DATA_TYPE_EMAIL, SCHEMA_HASH, { from: app });
  });

  beforeEach(async () => {
    controllers = await ControllerRegistry.new();
    await controllers.register(controller, { from: contractOwner });

    accounts = await Accounts.new(controllers.address);

    // create an Airbloc account with ID and password,
    // and register the data controller as a delegate of it.
    const { logs } = await accounts.create({ from: user });
    ({ args: { userId } } = expectEvent.inLogs(logs, 'SignUp', { owner: user }));
    // await accounts.setController(controller);

    // // should create new contract for each test
    consents = await Consents.new(
      accounts.address,
      apps.address,
      controllers.address,
      dataTypes.address,
    );
  });

  describe('#consent()', () => {
    it('should fail if the app does not exist', async () => {
      await expectRevert(
        consents.consent('WRONG_APP_NAME', {
          action: ACTION_COLLECTION,
          dataType: DATA_TYPE_GPS,
          allow: true,
        }, { from: user }),
        'Consents: app does not exist',
      );
    });

    it('should fail when the user is unregistered', async () => {
      await expectRevert(
        consents.consent(APP_NAME, {
          action: ACTION_COLLECTION,
          dataType: DATA_TYPE_GPS,
          allow: true,
        }, { from: stranger }),
        'Accounts: unknown address',
      );
    });

    it('should fail when the data type is not registered', async () => {
      await expectRevert(
        consents.consent(APP_NAME, {
          action: ACTION_COLLECTION,
          dataType: 'WRONG_DATA_TYPE',
          allow: true,
        }, { from: user }),
        'Consents: data type does not exist',
      );
    });

    context('when first time', async () => {
      it('should be done correctly', async () => {
        const { logs } = await consents.consent(APP_NAME, {
          action: ACTION_COLLECTION,
          dataType: DATA_TYPE_GPS,
          allow: true,
        }, { from: user });
        expectEvent.inLogs(logs, 'Consented', {
          action: new BN(ACTION_COLLECTION),
          appName: APP_NAME,
          dataType: DATA_TYPE_GPS,
          userId: `${userId.padEnd(66, '0')}`,
          allowed: true,
        });
      });
    });

    context('when modifying a consent', async () => {
      it('should modify correctly', async () => {
        await consents.consent(APP_NAME, {
          action: ACTION_COLLECTION,
          dataType: DATA_TYPE_GPS,
          allow: true,
        }, { from: user });
        await expect(consents.isAllowed(userId, APP_NAME, ACTION_COLLECTION, DATA_TYPE_GPS)).to.be
          .eventually.be.true;

        await consents.consent(APP_NAME, {
          action: ACTION_COLLECTION,
          dataType: DATA_TYPE_GPS,
          allow: false,
        }, { from: user });
        await expect(consents.isAllowed(userId, APP_NAME, ACTION_COLLECTION, DATA_TYPE_GPS)).to.be
          .eventually.be.false;
      });
    });
  });

  describe('#consentMany()', () => {
    it('should fail if the app does not exist', async () => {
      await expectRevert(
        consents.consentMany('WRONG_APP_NAME', [{
          action: ACTION_COLLECTION,
          dataType: DATA_TYPE_GPS,
          allow: true,
        }], { from: user }),
        'Consents: app does not exist',
      );
    });

    it('should fail when the user is unregistered', async () => {
      await expectRevert(
        consents.consentMany(APP_NAME, [{
          action: ACTION_COLLECTION,
          dataType: DATA_TYPE_GPS,
          allow: true,
        }], { from: stranger }),
        'Accounts: unknown address',
      );
    });

    it('should fail when the data type is not registered', async () => {
      await expectRevert(
        consents.consentMany(APP_NAME, [{
          action: ACTION_COLLECTION,
          dataType: 'WRONG_DATA_TYPE',
          allow: true,
        }], { from: user }),
        'Consents: data type does not exist',
      );
    });

    it('should fail when consent data length exceeded', async () => {
      const consentData = [];
      for (let i = 0; i < 65; i += 1) {
        consentData.push({
          action: ACTION_COLLECTION,
          dataType: 'WRONG_DATA_TYPE',
          allow: true,
        });
      }

      await expectRevert(
        consents.consentMany(APP_NAME, consentData, { from: user }),
        'Consents: input length exceeds',
      );
    });

    context('when first time', async () => {
      it('should be done correctly', async () => {
        const { logs } = await consents.consentMany(APP_NAME, [{
          action: ACTION_COLLECTION,
          dataType: DATA_TYPE_GPS,
          allow: true,
        }, {
          action: ACTION_COLLECTION,
          dataType: DATA_TYPE_EMAIL,
          allow: false,
        }], { from: user });

        expectEvent.inLogs(logs, 'Consented', {
          action: new BN(ACTION_COLLECTION),
          appName: APP_NAME,
          dataType: DATA_TYPE_GPS,
          userId: `${userId.padEnd(66, '0')}`,
          allowed: true,
        });
        expectEvent.inLogs(logs, 'Consented', {
          action: new BN(ACTION_COLLECTION),
          appName: APP_NAME,
          dataType: DATA_TYPE_EMAIL,
          userId: `${userId.padEnd(66, '0')}`,
          allowed: false,
        });
      });
    });

    context('when modifying a consent', async () => {
      it('should modify correctly', async () => {
        await consents.consentMany(APP_NAME, [{
          action: ACTION_COLLECTION,
          dataType: DATA_TYPE_GPS,
          allow: true,
        }, {
          action: ACTION_COLLECTION,
          dataType: DATA_TYPE_EMAIL,
          allow: false,
        }], { from: user });
        await expect(consents.isAllowed(userId, APP_NAME, ACTION_COLLECTION, DATA_TYPE_GPS)).to.be
          .eventually.be.true;
        await expect(consents.isAllowed(userId, APP_NAME, ACTION_COLLECTION, DATA_TYPE_EMAIL)).to.be
          .eventually.be.false;

        await consents.consentMany(APP_NAME, [{
          action: ACTION_COLLECTION,
          dataType: DATA_TYPE_GPS,
          allow: false,
        }, {
          action: ACTION_COLLECTION,
          dataType: DATA_TYPE_EMAIL,
          allow: true,
        }], { from: user });
        await expect(consents.isAllowed(userId, APP_NAME, ACTION_COLLECTION, DATA_TYPE_GPS)).to.be
          .eventually.be.false;
        await expect(consents.isAllowed(userId, APP_NAME, ACTION_COLLECTION, DATA_TYPE_EMAIL)).to.be
          .eventually.be.true;
      });
    });
  });

  describe('#consentByController()', () => {
    it('should fail when it called by others (e.g. apps)', async () => {
      await expectRevert(
        consents.consentByController(
          userId,
          APP_NAME,
          {
            action: ACTION_COLLECTION,
            dataType: DATA_TYPE_GPS,
            allow: true,
          },
          { from: app },
        ),
        'Consents: caller is not a data controller',
      );
    });

    it('should fail if the app does not exist', async () => {
      await expectRevert(
        consents.consentByController(
          userId,
          'UNKNOWN_APP_NAME',
          {
            action: ACTION_COLLECTION,
            dataType: DATA_TYPE_GPS,
            allow: true,
          },
          { from: controller },
        ),
        'Consents: app does not exist',
      );
    });

    it('should fail when the user is unregistered', async () => {
      const registrationEvent = getFirstEvent(await accounts.create({ from: stranger }));
      const unregisteredUserId = registrationEvent.accountId;

      await expectRevert(
        consents.consentByController(
          unregisteredUserId,
          APP_NAME,
          {
            action: ACTION_COLLECTION,
            dataType: DATA_TYPE_GPS,
            allow: true,
          },
          { from: controller },
        ),
        'Consents: sender must be delegate of this user',
      );
    });

    it('should fail when the data type is not registered', async () => {
      await expectRevert(
        consents.consentByController(
          userId,
          APP_NAME,
          {
            action: ACTION_COLLECTION,
            dataType: 'UNKNOWN_DATA_TYPE',
            allow: true,
          },
          { from: controller },
        ),
        'Consents: data type',
      );
    });

    context('when first time', async () => {
      it('should be done correctly', async () => {
        const { logs } = await consents.consentByController(
          userId,
          APP_NAME,
          {
            action: ACTION_COLLECTION,
            dataType: DATA_TYPE_GPS,
            allow: true,
          },
          { from: controller },
        );
        expectEvent.inLogs(logs, 'Consented', {
          action: new BN(ACTION_COLLECTION),
          appName: APP_NAME,
          dataType: DATA_TYPE_GPS,
          userId: `${userId.padEnd(66, '0')}`,
          allowed: true,
        });
      });
    });

    context('when modifying a consent', async () => {
      it('should fail', async () => {
        await consents.consentByController(
          userId,
          APP_NAME,
          {
            action: ACTION_COLLECTION,
            dataType: DATA_TYPE_GPS,
            allow: true,
          },
          { from: controller },
        );
        await expectRevert(
          consents.consentByController(
            userId,
            APP_NAME,
            {
              action: ACTION_COLLECTION,
              dataType: DATA_TYPE_GPS,
              allow: true,
            },
            { from: controller },
          ),
          "Consents: controllers can't modify users' consent without password",
        );
      });
    });
  });

  describe('#consentManyByController()', () => {
    it('should fail when it called by others (e.g. apps)', async () => {
      await expectRevert(
        consents.consentManyByController(
          userId,
          APP_NAME,
          [{
            action: ACTION_COLLECTION,
            dataType: DATA_TYPE_GPS,
            allow: true,
          }],
          { from: app },
        ),
        'Consents: caller is not a data controller',
      );
    });

    it('should fail if the app does not exist', async () => {
      await expectRevert(
        consents.consentManyByController(
          userId,
          'UNKNOWN_APP_NAME',
          [{
            action: ACTION_COLLECTION,
            dataType: DATA_TYPE_GPS,
            allow: true,
          }],
          { from: controller },
        ),
        'Consents: app does not exist',
      );
    });

    it('should fail when the user is unregistered', async () => {
      const registrationEvent = getFirstEvent(await accounts.create({ from: stranger }));
      const unregisteredUserId = registrationEvent.accountId;

      await expectRevert(
        consents.consentManyByController(
          unregisteredUserId,
          APP_NAME,
          [{
            action: ACTION_COLLECTION,
            dataType: DATA_TYPE_GPS,
            allow: true,
          }],
          { from: controller },
        ),
        'Consents: sender must be delegate of this user',
      );
    });

    it('should fail when the data type is not registered', async () => {
      await expectRevert(
        consents.consentManyByController(
          userId,
          APP_NAME,
          [{
            action: ACTION_COLLECTION,
            dataType: 'UNKNOWN_DATA_TYPE',
            allow: true,
          }],
          { from: controller },
        ),
        'Consents: data type',
      );
    });

    it('should fail when consent data length exceeded', async () => {
      const consentData = [];
      for (let i = 0; i < 65; i += 1) {
        consentData.push({
          action: ACTION_COLLECTION,
          dataType: 'WRONG_DATA_TYPE',
          allow: true,
        });
      }

      await expectRevert(
        consents.consentManyByController(
          userId,
          APP_NAME,
          consentData,
          { from: controller },
        ),
        'Consents: input length exceeds',
      );
    });

    context('when first time', async () => {
      it('should be done correctly', async () => {
        const { logs } = await consents.consentManyByController(
          userId,
          APP_NAME,
          [{
            action: ACTION_COLLECTION,
            dataType: DATA_TYPE_GPS,
            allow: true,
          }, {
            action: ACTION_COLLECTION,
            dataType: DATA_TYPE_EMAIL,
            allow: false,
          }],
          { from: controller },
        );

        expectEvent.inLogs(logs, 'Consented', {
          action: new BN(ACTION_COLLECTION),
          appName: APP_NAME,
          dataType: DATA_TYPE_GPS,
          userId: `${userId.padEnd(66, '0')}`,
          allowed: true,
        });
        expectEvent.inLogs(logs, 'Consented', {
          action: new BN(ACTION_COLLECTION),
          appName: APP_NAME,
          dataType: DATA_TYPE_EMAIL,
          userId: `${userId.padEnd(66, '0')}`,
          allowed: false,
        });
      });
    });

    context('when modifying a consent', async () => {
      it('should fail', async () => {
        await consents.consentManyByController(
          userId,
          APP_NAME,
          [{
            action: ACTION_COLLECTION,
            dataType: DATA_TYPE_GPS,
            allow: true,
          }],
          { from: controller },
        );

        await expectRevert(
          consents.consentManyByController(
            userId,
            APP_NAME,
            [{
              action: ACTION_COLLECTION,
              dataType: DATA_TYPE_GPS,
              allow: true,
            }],
            { from: controller },
          ),
          "Consents: controllers can't modify users' consent without password",
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
      allow,
      options = { from: controller },
      password = TEST_USER_PASSWORD,
    ) {
      // additional informations are required for packed ABI encodings
      const typedParams = [
        { type: 'bytes8', value: accountId },
        { type: 'string', value: appName },
        { type: 'uint8', value: action },
        { type: 'string', value: dataType },
        { type: 'bool', value: allow },
      ];
      const passwordSig = createPasswordSignature(typedParams, password);
      return consents.modifyConsentByController(
        accountId, appName, { action, dataType, allow }, passwordSig, options,
      );
    }

    context('when first time', async () => {
      it('should modify correctly', async () => {
        await callModifyConsentByController(
          ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE_GPS, true,
          { from: controller },
        );
        await expect(consents.isAllowed(userId, APP_NAME, ACTION_COLLECTION, DATA_TYPE_GPS))
          .to.eventually.be.true;
      });
    });

    context('when modifying a consent', async () => {
      beforeEach(async () => {
        await consents.consentByController(
          userId,
          APP_NAME,
          {
            action: ACTION_COLLECTION,
            dataType: DATA_TYPE_GPS,
            allow: true,
          },
          { from: controller },
        );
      });

      it('should modify correctly', async () => {
        await callModifyConsentByController(
          ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE_GPS, false,
          { from: controller },
        );
        await expect(consents.isAllowed(userId, APP_NAME, ACTION_COLLECTION, DATA_TYPE_GPS))
          .to.eventually.be.false;
      });

      it('should fail when password mismatches', async () => {
        const tx = callModifyConsentByController(
          ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE_GPS, false,
          { from: controller },
          'WRONG_PASSWORD',
        );
        await expectRevert(tx, 'Accounts: password mismatch');
      });

      it('should fail when it called by others (e.g. apps)', async () => {
        const tx = callModifyConsentByController(
          ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE_GPS, false,
          { from: stranger },
        );
        await expectRevert(tx, 'Consents: caller is not a data controller');
      });

      it('should fail if the called controller is not a delegate of the user', async () => {
        await controllers.register(stranger, { from: contractOwner });
        const tx = callModifyConsentByController(
          ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE_GPS, false,
          { from: stranger },
        );
        await expectRevert(tx, 'Consents: sender must be delegate of this user');
      });

      it('should fail if the app does not exist', async () => {
        const tx = callModifyConsentByController(
          ACTION_COLLECTION, userId, 'UNKNOWN_APP_NAME', DATA_TYPE_GPS, false,
          { from: controller },
        );
        await expectRevert(tx, 'Consents: app does not exist');
      });

      it('should fail when the user is unregistered', async () => {
        const unknownUserId = '0xdeadbeefdeadbeef';
        const tx = callModifyConsentByController(
          ACTION_COLLECTION, unknownUserId, APP_NAME, DATA_TYPE_GPS, false,
          { from: controller },
        );
        await expectRevert(tx, 'Consents: sender must be delegate of this user');
      });

      it('should fail when the data type is not registered', async () => {
        const tx = callModifyConsentByController(
          ACTION_COLLECTION, userId, APP_NAME, 'UNKNOWN_DATA_TYPE', false,
          { from: controller },
        );
        await expectRevert(tx, 'Consents: data type does not exist');
      });
    });
  });

  describe('#modifyConsentManyByController()', () => {
    /**
     * An wrapper of Consents#modifyConsentManyByController(),
     * which automatically adds password signature onto a method call.
     */
    async function callModifyConsentManyByController(
      action,
      accountId,
      appName,
      dataType,
      allow,
      options = { from: controller },
      password = TEST_USER_PASSWORD,
    ) {
      // additional informations are required for packed ABI encodings
      const typedParams = [
        { type: 'bytes8', value: accountId },
        { type: 'string', value: appName },
        { type: 'uint8', value: action },
        { type: 'string', value: dataType },
        { type: 'bool', value: allow },
      ];
      const passwordSig = createPasswordSignature(typedParams, password);
      return consents.modifyConsentManyByController(
        accountId, appName, [{ action, dataType, allow }], passwordSig, options,
      );
    }

    context('when first time', async () => {
      it('should modify correctly', async () => {
        await callModifyConsentManyByController(
          ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE_GPS, true,
          { from: controller },
        );
        await expect(consents.isAllowed(userId, APP_NAME, ACTION_COLLECTION, DATA_TYPE_GPS))
          .to.eventually.be.true;
      });
    });

    context('when modifying a consent', async () => {
      beforeEach(async () => {
        await consents.consentByController(
          userId,
          APP_NAME,
          {
            action: ACTION_COLLECTION,
            dataType: DATA_TYPE_GPS,
            allow: true,
          },
          { from: controller },
        );
      });

      it('should modify correctly', async () => {
        await callModifyConsentManyByController(
          ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE_GPS, false,
          { from: controller },
        );
        await expect(consents.isAllowed(userId, APP_NAME, ACTION_COLLECTION, DATA_TYPE_GPS))
          .to.eventually.be.false;
      });

      it('should fail when password mismatches', async () => {
        const tx = callModifyConsentManyByController(
          ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE_GPS, false,
          { from: controller },
          'WRONG_PASSWORD',
        );
        await expectRevert(tx, 'Accounts: password mismatch');
      });

      it('should fail when it called by others (e.g. apps)', async () => {
        const tx = callModifyConsentManyByController(
          ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE_GPS, false,
          { from: stranger },
        );
        await expectRevert(tx, 'Consents: caller is not a data controller');
      });

      it('should fail if the called controller is not a delegate of the user', async () => {
        await controllers.register(stranger, { from: contractOwner });
        const tx = callModifyConsentManyByController(
          ACTION_COLLECTION, userId, APP_NAME, DATA_TYPE_GPS, false,
          { from: stranger },
        );
        await expectRevert(tx, 'Consents: sender must be delegate of this user');
      });

      it('should fail if the app does not exist', async () => {
        const tx = callModifyConsentManyByController(
          ACTION_COLLECTION, userId, 'UNKNOWN_APP_NAME', DATA_TYPE_GPS, false,
          { from: controller },
        );
        await expectRevert(tx, 'Consents: app does not exist');
      });

      it('should fail when the user is unregistered', async () => {
        const unknownUserId = '0xdeadbeefdeadbeef';
        const tx = callModifyConsentManyByController(
          ACTION_COLLECTION, unknownUserId, APP_NAME, DATA_TYPE_GPS, false,
          { from: controller },
        );
        await expectRevert(tx, 'Consents: sender must be delegate of this user');
      });

      it('should fail when the data type is not registered', async () => {
        const tx = callModifyConsentManyByController(
          ACTION_COLLECTION, userId, APP_NAME, 'UNKNOWN_DATA_TYPE', false,
          { from: controller },
        );
        await expectRevert(tx, 'Consents: data type does not exist');
      });
    });
  });

  describe('#isAllowed()', () => {
    it('should return whether user is consented at the current moment', async () => {
      await consents.consent(
        APP_NAME,
        {
          action: ACTION_COLLECTION,
          dataType: DATA_TYPE_GPS,
          allow: true,
        },
        { from: user },
      );
      await expect(consents.isAllowed(userId, APP_NAME, ACTION_COLLECTION, DATA_TYPE_GPS)).to.be
        .eventually.be.true;
    });
  });

  describe('#isAllowedAt()', () => {
    it('should return whether user is consented at the past', async () => {
      await consents.consent(
        APP_NAME,
        {
          action: ACTION_COLLECTION,
          dataType: DATA_TYPE_GPS,
          allow: true,
        },
        { from: user },
      );
      await consents.consent(
        APP_NAME,
        {
          action: ACTION_COLLECTION,
          dataType: DATA_TYPE_GPS,
          allow: false,
        },
        { from: user },
      );

      const past = (await web3.eth.getBlockNumber()) - 1;
      await expect(consents.isAllowedAt(userId, APP_NAME, ACTION_COLLECTION, DATA_TYPE_GPS, past))
        .to.eventually.be.true;
    });
  });
});
