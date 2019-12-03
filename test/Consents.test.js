const { expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('./test-utils');

const Consents = artifacts.require('Consents');
const Users = artifacts.require('Users');
const AppRegistry = artifacts.require('AppRegistry');
const DataTypeRegistry = artifacts.require('DataTypeRegistry');
const ControllerRegistry = artifacts.require('ControllerRegistry');

// signature
const CONSENT_DATA_SIG = '(uint8,string,bool)';

// test data
const APP_NAME = 'test-app';
const DATA_TYPE_GPS = 'gps-data';
const DATA_TYPE_EMAIL = 'email-data';
const DATA_SCHEMA = '{"type": "string", "default": "Just Test GPS Data."}';
const SCHEMA_HASH = web3.utils.keccak256(DATA_SCHEMA);
const TEST_USER_ID = web3.utils.keccak256('test@airbloc.org');
const TEST_USER_ID_HASH = web3.utils.keccak256(TEST_USER_ID);

// enums (defined as Consents.ActionTypes)
const ACTION_COLLECTION = 0;

contract('Consents', async (ethAccounts) => {
  const [contractOwner, user, app, controller, stranger] = ethAccounts;
  let appId;
  let userId;
  let tempUserId;
  let apps;
  let controllers;
  let dataTypes;
  let users;
  let consents;

  before(async () => {
    apps = await AppRegistry.new();
    dataTypes = await DataTypeRegistry.new();

    const { logs } = await apps.register(APP_NAME, { from: app });
    ({ args: { appId } } = expectEvent.inLogs(logs, 'Registration', { appName: APP_NAME }));
    appId = `${appId.padEnd(66, '0')}`;

    await dataTypes.register(DATA_TYPE_GPS, SCHEMA_HASH, { from: app });
    await dataTypes.register(DATA_TYPE_EMAIL, SCHEMA_HASH, { from: app });
  });

  beforeEach(async () => {
    controllers = await ControllerRegistry.new();
    await controllers.register(controller, { from: contractOwner });

    users = await Users.new(controllers.address);

    // create an Airbloc account with ID and password,
    // and register the data controller as a delegate of it.
    let { logs } = await users.create({ from: user });
    ({ args: { userId } } = expectEvent.inLogs(logs, 'SignUp', { owner: user }));
    userId = `${userId.padEnd(66, '0')}`;

    ({ logs } = await users.createTemporary(TEST_USER_ID_HASH, { from: controller }));
    ({ args: { userId: tempUserId } } = expectEvent.inLogs(logs, 'TemporaryCreated', { proxy: controller, identityHash: TEST_USER_ID_HASH }));
    tempUserId = `${tempUserId.padEnd(66, '0')}`;

    // should create new contract for each test
    consents = await Consents.new(
      users.address,
      apps.address,
      controllers.address,
      dataTypes.address,
    );
  });

  describe(`#consent(bytes8,string,${CONSENT_DATA_SIG})`, () => {
    const consentData = {
      action: ACTION_COLLECTION,
      dataType: DATA_TYPE_GPS,
      allow: true,
    };

    let consent;

    beforeEach(async () => {
      consent = consents.methods[`consent(bytes8,string,${CONSENT_DATA_SIG})`];
    });

    context('called directly (owner)', () => {
      it('should create consent correctly', async () => {
        const { logs } = await consent(
          userId,
          APP_NAME,
          consentData,
          { from: user },
        );
        expectEvent.inLogs(logs, 'Consented', {
          userId,
          appId,
          appName: APP_NAME,
          dataType: DATA_TYPE_GPS,
          allowed: true,
        });
      });
      it('should modify consent correctly', async () => {
        await consent(userId, APP_NAME, consentData, { from: user });
        const { logs } = await consent(
          userId,
          APP_NAME,
          { ...consentData, allow: false },
          { from: user },
        );
        expectEvent.inLogs(logs, 'Consented', {
          userId,
          appId,
          appName: APP_NAME,
          dataType: DATA_TYPE_GPS,
          allowed: false,
        });
      });
    });
    context('called indirectly (controller)', () => {
      context('create consent', () => {
        it('should done correctly with controller', async () => {
          await users.setController(controller, { from: user });
          const { logs } = await consent(
            userId,
            APP_NAME,
            consentData,
            { from: controller },
          );
          expectEvent.inLogs(logs, 'Consented', {
            userId,
            appId,
            appName: APP_NAME,
            dataType: DATA_TYPE_GPS,
            allowed: true,
          });
        });
        it('should done correctly with temporary controller', async () => {
          const { logs } = await consent(
            tempUserId,
            APP_NAME,
            consentData,
            { from: controller },
          );
          expectEvent.inLogs(logs, 'Consented', {
            userId: tempUserId,
            appId,
            appName: APP_NAME,
            dataType: DATA_TYPE_GPS,
            allowed: true,
          });
        });
        it('should fail when not authorized', async () => {
          await expectRevert(
            consent(userId, APP_NAME, consentData, { from: stranger }),
            'Consents: sender must be authorized before create consent',
          );
        });
      });
      context('modify consent', () => {
        it('should done correctly with controller', async () => {
          await users.setController(controller, { from: user });
          await consent(userId, APP_NAME, consentData, { from: controller });

          const { logs } = await consent(
            userId,
            APP_NAME,
            { ...consentData, allow: false },
            { from: controller },
          );
          expectEvent.inLogs(logs, 'Consented', {
            userId,
            appId,
            appName: APP_NAME,
            dataType: DATA_TYPE_GPS,
            allowed: false,
          });
        });
        it('should fail when temporary controller tries to modify consent', async () => {
          await consent(tempUserId, APP_NAME, consentData, { from: controller });
          await expectRevert(
            consent(tempUserId, APP_NAME, { ...consentData, allow: false }, { from: controller }),
            'Consents: sender must be authorized before modify consent',
          );
        });
        it('should fail when not authorized', async () => {
          await consent(tempUserId, APP_NAME, consentData, { from: controller });
          await expectRevert(
            consent(tempUserId, APP_NAME, consentData, { from: stranger }),
            'Consents: sender must be authorized before modify consent',
          );
        });
      });
    });
    it('should fail when app does not exist', async () => {
      await expectRevert(
        consent(userId, 'fake-app', consentData, { from: user }),
        'Consents: app does not exist',
      );
    });
    it('should fail when user does not exist', async () => {
      await expectRevert(
        consent('0xdeadbeefdeadbeef', APP_NAME, consentData, { from: user }),
        'Consents: user does not exist',
      );
    });
    it('should fail when data type does not exist', async () => {
      await expectRevert(
        consent(userId, APP_NAME, { ...consentData, dataType: 'fake-data-type' }, { from: user }),
        'Consents: data type does not exist',
      );
    });
  });

  describe(`#consent(string,${CONSENT_DATA_SIG})`, () => {
    const consentData = {
      action: ACTION_COLLECTION,
      dataType: DATA_TYPE_GPS,
      allow: true,
    };

    let consent;

    beforeEach(async () => {
      consent = consents.methods[`consent(string,${CONSENT_DATA_SIG})`];
    });

    it('should done correctly', async () => {
      const { logs } = await consent(APP_NAME, consentData, { from: user });
      expectEvent.inLogs(logs, 'Consented', {
        userId,
        appId,
        appName: APP_NAME,
        dataType: DATA_TYPE_GPS,
        allowed: true,
      });
    });
  });

  describe('#consentMany(bytes8,string,ConsentData[])', () => {
    const consentDataEmail = {
      action: ACTION_COLLECTION,
      dataType: DATA_TYPE_EMAIL,
      allow: true,
    };
    const consentDataGps = {
      action: ACTION_COLLECTION,
      dataType: DATA_TYPE_GPS,
      allow: true,
    };

    let consent;
    let consentMany;

    beforeEach(async () => {
      consent = consents.methods[`consent(bytes8,string,${CONSENT_DATA_SIG})`];
      consentMany = consents.methods[`consentMany(bytes8,string,${CONSENT_DATA_SIG}[])`];
    });

    context('called directly (owner)', () => {
      it('should create consent correctly', async () => {
        const { logs } = await consentMany(userId, APP_NAME, [consentDataEmail], { from: user });
        expectEvent.inLogs(logs, 'Consented', {
          userId,
          appId,
          appName: APP_NAME,
          dataType: DATA_TYPE_EMAIL,
          allowed: true,
        });
      });
      it('should modify consent correctly', async () => {
        await consent(userId, APP_NAME, consentDataGps, { from: user });
        const { logs } = await consentMany(
          userId,
          APP_NAME,
          [{ ...consentDataGps, allow: false }],
          { from: user },
        );
        expectEvent.inLogs(logs, 'Consented', {
          userId,
          appId,
          appName: APP_NAME,
          dataType: DATA_TYPE_GPS,
          allowed: false,
        });
      });
      it('should process multiple consent data correctly', async () => {
        await consent(userId, APP_NAME, consentDataGps, { from: user });
        const { logs } = await consentMany(
          userId,
          APP_NAME,
          [consentDataEmail, { ...consentDataGps, allow: false }],
          { from: user },
        );
        expectEvent.inLogs(logs, 'Consented', {
          userId,
          appId,
          appName: APP_NAME,
          dataType: DATA_TYPE_EMAIL,
          allowed: true,
        });
        expectEvent.inLogs(logs, 'Consented', {
          userId,
          appId,
          appName: APP_NAME,
          dataType: DATA_TYPE_GPS,
          allowed: false,
        });
      });
    });
    context('called indirectly (controller)', () => {
      context('create consent', () => {
        it('should done correctly with controller', async () => {
          await users.setController(controller, { from: user });
          const { logs } = await consentMany(
            userId,
            APP_NAME,
            [consentDataEmail],
            { from: controller },
          );
          expectEvent.inLogs(logs, 'Consented', {
            userId,
            appId,
            appName: APP_NAME,
            dataType: DATA_TYPE_EMAIL,
            allowed: true,
          });
        });
        it('should done correctly with temporary controller', async () => {
          const { logs } = await consentMany(
            tempUserId,
            APP_NAME,
            [consentDataEmail],
            { from: controller },
          );
          expectEvent.inLogs(logs, 'Consented', {
            userId: tempUserId,
            appId,
            appName: APP_NAME,
            dataType: DATA_TYPE_EMAIL,
            allowed: true,
          });
        });
        it('should fail when not authorized', async () => {
          await expectRevert(
            consentMany(userId, APP_NAME, [consentDataEmail], { from: stranger }),
            'Consents: sender must be authorized before create consent',
          );
        });
      });
      context('modify consent', () => {
        it('should done correctly with controller', async () => {
          await users.setController(controller, { from: user });
          await consent(userId, APP_NAME, consentDataGps, { from: controller });

          const { logs } = await consentMany(
            userId,
            APP_NAME,
            [{ ...consentDataGps, allow: false }],
            { from: controller },
          );
          expectEvent.inLogs(logs, 'Consented', {
            userId,
            appId,
            appName: APP_NAME,
            dataType: DATA_TYPE_GPS,
            allowed: false,
          });
        });
        it('should fail when temporary controller tries modify consent', async () => {
          await consent(tempUserId, APP_NAME, consentDataGps, { from: controller });
          await expectRevert(
            consentMany(
              tempUserId,
              APP_NAME,
              [{ ...consentDataGps, allow: false }],
              { from: controller },
            ),
            'Consents: sender must be authorized before modify consent',
          );
        });
        it('should fail when not authorized', async () => {
          await consent(tempUserId, APP_NAME, consentDataGps, { from: controller });
          await expectRevert(
            consentMany(
              tempUserId,
              APP_NAME,
              [{ ...consentDataGps, allow: false }],
              { from: stranger },
            ),
            'Consents: sender must be authorized before modify consent',
          );
        });
      });
      it('should process multiple consent data correctly', async () => {
        await users.setController(controller, { from: user });
        await consent(userId, APP_NAME, consentDataGps, { from: controller });
        const { logs } = await consentMany(
          userId,
          APP_NAME,
          [consentDataEmail, { ...consentDataGps, allow: false }],
          { from: controller },
        );
        expectEvent.inLogs(logs, 'Consented', {
          userId,
          appId,
          appName: APP_NAME,
          dataType: DATA_TYPE_EMAIL,
          allowed: true,
        });
        expectEvent.inLogs(logs, 'Consented', {
          userId,
          appId,
          appName: APP_NAME,
          dataType: DATA_TYPE_GPS,
          allowed: false,
        });
      });
    });
    it('should fail consent data list length exceeded', async () => {
      const consentDataMaxLength = await consents.CONSENT_DATA_MAX_LENGTH();
      const consentData = [];

      for (let i = 0; i < consentDataMaxLength + 1; i += 1) {
        consentData.push(consentDataEmail);
      }

      await expectRevert(
        consentMany(userId, APP_NAME, consentData, { from: user }),
        'Consents: input length exceeds',
      );
    });
    it('should fail when app does not exist', async () => {
      await expectRevert(
        consentMany(userId, 'fake-app', [consentDataEmail, consentDataGps], { from: user }),
        'Consents: app does not exist',
      );
    });
    it('should fail when user does not exist', async () => {
      await expectRevert(
        consentMany('0xdeadbeefdeadbeef', APP_NAME, [consentDataEmail, consentDataGps], { from: user }),
        'Consents: user does not exist',
      );
    });
    it('should fail when data type does not exist', async () => {
      await expectRevert(
        consentMany(userId, APP_NAME, [{ ...consentDataEmail, dataType: 'fake-data-type' }, consentDataGps], { from: user }),
        'Consents: data type does not exist',
      );
    });
  });

  describe('#consentMany(string,ConsentData[])', () => {
    const consentData = {
      action: ACTION_COLLECTION,
      dataType: DATA_TYPE_EMAIL,
      allow: true,
    };

    let consentMany;

    beforeEach(async () => {
      consentMany = consents.methods[`consentMany(string,${CONSENT_DATA_SIG}[])`];
    });

    it('should done correctly', async () => {
      const { logs } = await consentMany(APP_NAME, [consentData], { from: user });
      expectEvent.inLogs(logs, 'Consented', {
        userId,
        appId,
        appName: APP_NAME,
        dataType: DATA_TYPE_EMAIL,
        allowed: true,
      });
    });
  });

  describe('#isAllowed()', () => {
    let consent;

    beforeEach(async () => {
      consent = consents.methods[`consent(bytes8,string,${CONSENT_DATA_SIG})`];
    });

    it('should return whether user is consented at the current moment', async () => {
      await consent(
        userId,
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
    let consent;

    beforeEach(async () => {
      consent = consents.methods[`consent(bytes8,string,${CONSENT_DATA_SIG})`];
    });

    it('should return whether user is consented at the past', async () => {
      await consent(
        userId,
        APP_NAME,
        {
          action: ACTION_COLLECTION,
          dataType: DATA_TYPE_GPS,
          allow: true,
        },
        { from: user },
      );
      await consent(
        userId,
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
