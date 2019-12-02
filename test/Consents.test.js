const { BN, expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('./test-utils');

const Consents = artifacts.require('Consents');
const Users = artifacts.require('Users');
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

// enums (defined as Consents.ActionTypes)
const ACTION_COLLECTION = 0;

contract('Consents', async (ethAccounts) => {
  const [contractOwner, user, tempUser, app, controller, stranger] = ethAccounts;
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

    await apps.register(APP_NAME, { from: app });
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
    await users.setController(controller, { from: user });

    ({ logs } = await users.createTemporary(TEST_USER_ID_HASH, { from: controller }));
    ({ args: { userId: tempUserId } } = expectEvent.inLogs(logs, 'TemporaryCreated', { proxy: controller, identityHash: TEST_USER_ID_HASH }));

    // should create new contract for each test
    consents = await Consents.new(
      users.address,
      apps.address,
      controllers.address,
      dataTypes.address,
    );
  });

  describe('#consent(bytes8,string,ConsentData)', () => {
    context('called directly (owner)', () => {
      it('should create consent correctly', async () => {});
      it('should modify consent correctly', async () => {});
    });
    context('called indirectly (controller)', () => {
      context('create consent', () => {
        it('should done correctly', async () => {});
        it('should fail when not authorized', async () => {});
      });
      context('modify consent', () => {
        it('should done correctly', async () => {});
        it('should fail when not authorized', async () => {});
      });
    });
    it('should fail when app does not exist', async () => {});
    it('should fail when user does not exist', async () => {});
    it('should fail when data type does not exist', async () => {});
  });

  describe('#consent(string,ConsentData)', () => {
    it('should done correctly', async () => {
      // check userId
    });
  });

  describe('#consentMany(bytes8,string,ConsentData[])', () => {
    context('called directly (owner)', () => {
      it('should create consent correctly', async () => {});
      it('should modify consent correctly', async () => {});
      it('should create/modify consent correctly', async () => {});
    });
    context('called indirectly (controller)', () => {
      context('create consent', () => {

      });
      context('modify consent', () => {

      });
      context('create/modify consent', () => {

      });
    });

    it('should fail when app does not exist', async () => {});
    it('should fail when user does not exist', async () => {});
    it('should fail when data type does not exist', async () => {});
  });

  describe('#consentMany(string,ConsentData[])', () => {
    it('should done correctly', async () => {
      // check userId
    });
  });

  // describe('#consent()', () => {
  //   it('should fail if the app does not exist', async () => {
  //     await expectRevert(
  //       consents.consent(
  //         userId,
  //         'WRONG_APP_NAME',
  //         {
  //           action: ACTION_COLLECTION,
  //           dataType: DATA_TYPE_GPS,
  //           allow: true,
  //         },
  //         { from: user },
  //       ),
  //       'Consents: app does not exist',
  //     );
  //   });

  //   it('should fail when the user is unregistered', async () => {
  //     await expectRevert(
  //       consents.consent(
  //         '0xdeadbeefdeadbeef',
  //         APP_NAME,
  //         {
  //           action: ACTION_COLLECTION,
  //           dataType: DATA_TYPE_GPS,
  //           alow: true,
  //         },
  //         { from: stranger },
  //       ),
  //       'Consents: user does not exist',
  //     );
  //   });

  //   it('should fail when the data type is not registered', async () => {
  //     await expectRevert(
  //       consents.consent(
  //         userId,
  //         APP_NAME,
  //         {
  //           action: ACTION_COLLECTION,
  //           dataType: 'WRONG_DATA_TYPE',
  //           allow: true,
  //         },
  //         { from: user },
  //       ),
  //       'Consents: data type does not exist',
  //     );
  //   });

  //   context('when first time', async () => {
  //     it('should be done correctly', async () => {
  //       const { logs } = await consents.consent(
  //         userId,
  //         APP_NAME,
  //         {
  //           action: ACTION_COLLECTION,
  //           dataType: DATA_TYPE_GPS,
  //           allow: true,
  //         },
  //         { from: user },
  //       );
  //       expectEvent.inLogs(logs, 'Consented', {
  //         action: new BN(ACTION_COLLECTION),
  //         appName: APP_NAME,
  //         dataType: DATA_TYPE_GPS,
  //         userId: `${userId.padEnd(66, '0')}`,
  //         allowed: true,
  //       });
  //     });

  //     context('when modifying a consent', async () => {
  //       it('should modify correctly', async () => {
  //         let isAllowed;

  //         await consents.consent(
  //           userId,
  //           APP_NAME,
  //           {
  //             action: ACTION_COLLECTION,
  //             dataType: DATA_TYPE_GPS,
  //             allow: true,
  //           },
  //           { from: user },
  //         );
  //         isAllowed = await consents.isAllowed(userId, APP_NAME, ACTION_COLLECTION, DATA_TYPE_GPS);
  //         expect(isAllowed).to.be.true;

  //         await consents.consent(
  //           userId,
  //           APP_NAME,
  //           {
  //             action: ACTION_COLLECTION,
  //             dataType: DATA_TYPE_GPS,
  //             allow: false,
  //           },
  //           { from: user },
  //         );
  //         isAllowed = await consents.isAllowed(userId, APP_NAME, ACTION_COLLECTION, DATA_TYPE_GPS);
  //         expect(isAllowed).to.be.true;
  //       });
  //     });
  //   });
  // });

  // describe('#consentMany()', () => {
  //   it('should fail if the app does not exist', async () => {
  //     await expectRevert(
  //       consents.consentMany(
  //         userId,
  //         'WRONG_APP_NAME',
  //         [
  //           {
  //             action: ACTION_COLLECTION,
  //             dataType: DATA_TYPE_GPS,
  //             allow: true,
  //           },
  //         ],
  //         { from: user },
  //       ),
  //       'Consents: app does not exist',
  //     );
  //   });

  //   it('should fail when the user is unregistered', async () => {
  //     await expectRevert(
  //       consents.consentMany(
  //         userId,
  //         APP_NAME,
  //         [
  //           {
  //             action: ACTION_COLLECTION,
  //             dataType: DATA_TYPE_GPS,
  //             allow: true,
  //           },
  //         ],
  //         { from: stranger },
  //       ),
  //       'Users: unknown address',
  //     );
  //   });

  //   it('should fail when the data type is not registered', async () => {
  //     await expectRevert(
  //       consents.consentMany(
  //         userId,
  //         APP_NAME,
  //         [
  //           {
  //             action: ACTION_COLLECTION,
  //             dataType: 'WRONG_DATA_TYPE',
  //             allow: true,
  //           },
  //         ],
  //         { from: user },
  //       ),
  //       'Consents: data type does not exist',
  //     );
  //   });

  //   it('should fail when consent data length exceeded', async () => {
  //     const consentData = [];
  //     for (let i = 0; i < 65; i += 1) {
  //       consentData.push({
  //         action: ACTION_COLLECTION,
  //         dataType: 'WRONG_DATA_TYPE',
  //         allow: true,
  //       });
  //     }

  //     await expectRevert(
  //       consents.consentMany(userId, APP_NAME, consentData, { from: user }),
  //       'Consents: input length exceeds',
  //     );
  //   });

  //   context('when first time', async () => {
  //     it('should be done correctly', async () => {
  //       const { logs } = await consents.consentMany(
  //         userId,
  //         APP_NAME,
  //         [
  //           {
  //             action: ACTION_COLLECTION,
  //             dataType: DATA_TYPE_GPS,
  //             allow: true,
  //           },
  //           {
  //             action: ACTION_COLLECTION,
  //             dataType: DATA_TYPE_EMAIL,
  //             allow: false,
  //           },
  //         ],
  //         { from: user },
  //       );

  //       expectEvent.inLogs(logs, 'Consented', {
  //         action: new BN(ACTION_COLLECTION),
  //         appName: APP_NAME,
  //         dataType: DATA_TYPE_GPS,
  //         userId: `${userId.padEnd(66, '0')}`,
  //         allowed: true,
  //       });
  //       expectEvent.inLogs(logs, 'Consented', {
  //         action: new BN(ACTION_COLLECTION),
  //         appName: APP_NAME,
  //         dataType: DATA_TYPE_EMAIL,
  //         userId: `${userId.padEnd(66, '0')}`,
  //         allowed: false,
  //       });
  //     });
  //   });

  //   context('when modifying a consent', async () => {
  //     it('should modify correctly', async () => {
  //       let isAllowed;

  //       await consents.consentMany(
  //         userId,
  //         APP_NAME,
  //         [
  //           {
  //             action: ACTION_COLLECTION,
  //             dataType: DATA_TYPE_GPS,
  //             allow: true,
  //           },
  //           {
  //             action: ACTION_COLLECTION,
  //             dataType: DATA_TYPE_EMAIL,
  //             allow: false,
  //           },
  //         ],
  //         { from: user },
  //       );
  //       isAllowed = await consents.isAllowed(userId, APP_NAME, ACTION_COLLECTION, DATA_TYPE_GPS);
  //       expect(isAllowed).to.be.eventually.be.true;
  //       isAllowed = await consents.isAllowed(userId, APP_NAME, ACTION_COLLECTION, DATA_TYPE_EMAIL);
  //       expect(isAllowed).to.be.eventually.be.false;

  //       await consents.consentMany(
  //         userId,
  //         APP_NAME,
  //         [
  //           {
  //             action: ACTION_COLLECTION,
  //             dataType: DATA_TYPE_GPS,
  //             allow: false,
  //           },
  //           {
  //             action: ACTION_COLLECTION,
  //             dataType: DATA_TYPE_EMAIL,
  //             allow: true,
  //           },
  //         ],
  //         { from: user },
  //       );
  //       isAllowed = await consents.isAllowed(userId, APP_NAME, ACTION_COLLECTION, DATA_TYPE_GPS);
  //       expect(isAllowed).to.be.eventually.be.false;
  //       isAllowed = await consents.isAllowed(userId, APP_NAME, ACTION_COLLECTION, DATA_TYPE_EMAIL);
  //       expect(isAllowed).to.be.eventually.be.true;
  //     });
  //   });
  // });

  describe('#isAllowed()', () => {
    it('should return whether user is consented at the current moment', async () => {
      await consents.consent(
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
    it('should return whether user is consented at the past', async () => {
      await consents.consent(
        userId,
        APP_NAME,
        {
          action: ACTION_COLLECTION,
          dataType: DATA_TYPE_GPS,
          allow: true,
        },
        { from: user },
      );
      await consents.consent(
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
