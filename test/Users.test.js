const { expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('./test-utils');

const Users = artifacts.require('Users');
const ControllerRegistry = artifacts.require('ControllerRegistry');

// test constants
const IDENTITY_PREIMAGE = web3.utils.keccak256('test@airbloc.org');
const IDENTITY_HASH = web3.utils.keccak256(IDENTITY_PREIMAGE);

// enums (from Users.AccountStatus)
// const ACCOUNT_STATUS_NONE = 0;
const USER_STATUS_TEMPORARY = 1;
const USER_STATUS_CREATED = 2;

// public constants
const USER_ROLE_DATA_CONTROLLER = 'dataController';
const USER_ACTION_CONSENT_CREATE = 'consent:create';
// const USER_ACTION_CONSENT_MODIFY = 'consent:modify';
// const USER_ACTION_USER_TRANSFER_OWNERSHIP = 'user:transferOwnership';

contract('Users', async (ethAccounts) => {
  const [contractOwner, owner, controller, otherController, stranger] = ethAccounts;
  let users;
  let controllers;

  before(async () => {
    controllers = await ControllerRegistry.new({ from: contractOwner });
    await controllers.register(controller, { from: contractOwner });
    await controllers.register(otherController, { from: contractOwner });
  });

  beforeEach(async () => {
    users = await Users.new(controllers.address);
  });

  describe('#create()', () => {
    it('should done correctly', async () => {
      const { logs } = await users.create({ from: owner });
      expectEvent.inLogs(logs, 'SignUp', { owner });
    });

    it('should create initial roles', async () => {
      const { logs } = await users.create({ from: owner });
      const { args: { userId } } = expectEvent.inLogs(logs, 'SignUp', { owner });
      expectEvent.inLogs(logs, 'RoleCreation', {
        resourceId: `${userId.padEnd(66, '0')}`,
        roleName: USER_ROLE_DATA_CONTROLLER,
      });
      expectEvent.inLogs(logs, 'ActionGranted', {
        resourceId: `${userId.padEnd(66, '0')}`,
        roleName: USER_ROLE_DATA_CONTROLLER,
        actionName: USER_ACTION_CONSENT_CREATE,
      });
    });

    it('should fail when it called twice', async () => {
      await users.create({ from: owner });
      await expectRevert(
        users.create({ from: owner }),
        'Users: you can make only one user per one Klaytn Account',
      );
    });
  });

  describe('#createTemporary()', () => {
    it('should done correctly', async () => {
      const { logs } = await users.createTemporary(IDENTITY_HASH, { from: controller });
      expectEvent.inLogs(logs, 'TemporaryCreated', { proxy: controller });
    });

    it('should create initial roles', async () => {
      const { logs } = await users.createTemporary(IDENTITY_HASH, { from: controller });
      const { args: { userId } } = expectEvent.inLogs(logs, 'TemporaryCreated', { proxy: controller });
      expectEvent.inLogs(logs, 'RoleCreation', {
        resourceId: `${userId.padEnd(66, '0')}`,
        roleName: USER_ROLE_DATA_CONTROLLER,
      });
      expectEvent.inLogs(logs, 'ActionGranted', {
        resourceId: `${userId.padEnd(66, '0')}`,
        roleName: USER_ROLE_DATA_CONTROLLER,
        actionName: USER_ACTION_CONSENT_CREATE,
      });
    });

    it('should bind role to controller', async () => {
      const { logs } = await users.createTemporary(IDENTITY_HASH, { from: controller });
      const { args: { userId } } = expectEvent.inLogs(logs, 'TemporaryCreated', { proxy: controller });
      expectEvent.inLogs(logs, 'RoleBound', {
        resourceId: `${userId.padEnd(66, '0')}`,
        subject: controller,
        roleName: USER_ROLE_DATA_CONTROLLER,
      });
    });

    it('should create temporary user with temporary state', async () => {
      const { logs } = await users.createTemporary(IDENTITY_HASH, { from: controller });
      const { args: { userId } } = expectEvent.inLogs(logs, 'TemporaryCreated', { proxy: controller });

      const user = await users.getUser(userId);
      expect(user.status).to.be.equal(String(USER_STATUS_TEMPORARY));
    });

    it('should fail when it is called by non-controllers', async () => {
      await expectRevert(
        users.createTemporary(IDENTITY_HASH, { from: stranger }),
        'Users: caller is not a data controller',
      );
    });

    it('should fail when given ID already exists', async () => {
      await users.createTemporary(IDENTITY_HASH, { from: controller });
      await expectRevert(
        users.createTemporary(IDENTITY_HASH, { from: controller }),
        'Users: user already exists',
      );
    });
  });

  describe('#unlockTemporary()', () => {
    let userId;
    beforeEach(async () => {
      const { logs } = await users.createTemporary(IDENTITY_HASH, { from: controller });
      ({ args: { userId } } = expectEvent.inLogs(logs, 'TemporaryCreated', { proxy: controller }));
    });

    it('should done correctly', async () => {
      const { logs } = await users.unlockTemporary(IDENTITY_PREIMAGE, owner, {
        from: controller,
      });
      expectEvent.inLogs(logs, 'Unlocked', { userId: `${userId.padEnd(66, '0')}` });

      const account = await users.getUser(userId);
      expect(account.status).to.be.equal(String(USER_STATUS_CREATED));
      expect(account.owner).to.be.equal(owner);
    });

    it('should fail when it is called by non-controllers', async () => {
      await expectRevert(
        users.unlockTemporary(IDENTITY_PREIMAGE, owner, { from: stranger }),
        'Users: caller is not a data controller',
      );
    });

    it('should fail when user\'s state is not temporary', async () => {
      await users.unlockTemporary(IDENTITY_PREIMAGE, owner, { from: controller });
      await expectRevert(
        users.unlockTemporary(IDENTITY_PREIMAGE, owner, { from: controller }),
        'Users: it\'s not temporary user',
      );
    });

    it('should fail when it is not called by original data controller', async () => {
      await expectRevert(
        users.unlockTemporary(IDENTITY_PREIMAGE, owner, { from: otherController }),
        'Users: user must be unlocked through the designated data controller',
      );
    });

    it('should fail if given wallet address is already registered', async () => {
      await users.create({ from: owner });

      await expectRevert(
        users.unlockTemporary(IDENTITY_PREIMAGE, owner, { from: controller }),
        'Users: you can make only one user per one Klaytn Account',
      );
    });
  });

  describe('#setController()', () => {
    let userId;
    beforeEach(async () => {
      const { logs } = await users.create({ from: owner });
      ({ args: { userId } } = expectEvent.inLogs(logs, 'SignUp', { owner }));
    });

    it('should done correctly', async () => {
      const { logs } = await users.setController(controller, { from: owner });

      expectEvent.inLogs(logs, 'RoleBound', {
        resourceId: `${userId.padEnd(66, '0')}`,
        subject: controller,
        roleName: USER_ROLE_DATA_CONTROLLER,
      });
    });

    it('should replace controller correctly', async () => {
      await users.setController(controller, { from: owner });
      const { logs } = await users.setController(otherController, { from: owner });

      expectEvent.inLogs(logs, 'RoleUnbound', {
        resourceId: `${userId.padEnd(66, '0')}`,
        subject: controller,
        roleName: USER_ROLE_DATA_CONTROLLER,
      });
      expectEvent.inLogs(logs, 'RoleBound', {
        resourceId: `${userId.padEnd(66, '0')}`,
        subject: otherController,
        roleName: USER_ROLE_DATA_CONTROLLER,
      });
    });

    it('should fail when given address is already a controller of user', async () => {
      await users.setController(controller, { from: owner });
      await expectRevert(
        users.setController(controller, { from: owner }),
        'Users: given address is already a controller of user',
      );
    });

    it('should fail when given address is non-controller', async () => {
      await expectRevert(
        users.setController(stranger, { from: owner }),
        'Users: given address is not a data controller',
      );
    });

    it('should fail when userId correspond to sender does not exist', async () => {
      await expectRevert(
        users.setController(controller, { from: stranger }),
        'Users: user does not exist',
      );
    });
  });

  describe('#isTemporary()', () => {
    it('should return true for temporary account', async () => {
      const { logs } = await users.createTemporary(IDENTITY_HASH, { from: controller });
      const { args: { userId } } = expectEvent.inLogs(logs, 'TemporaryCreated', { proxy: controller });

      await expect(users.isTemporary(userId)).to.eventually.be.true;
    });

    it('should return false for created account', async () => {
      const { logs } = await users.create({ from: owner });
      const { args: { userId } } = expectEvent.inLogs(logs, 'SignUp', { owner });

      await expect(users.isTemporary(userId)).to.eventually.be.false;
    });

    it('should return false for unknown account', async () => {
      const unknownId = '0xdeadbeefdeadbeef';
      await expect(users.isTemporary(unknownId)).to.eventually.be.false;
    });
  });

  describe('#isControllerOf()', () => {
    let userId;
    beforeEach(async () => {
      const { logs } = await users.create({ from: owner });
      ({ args: { userId } } = expectEvent.inLogs(logs, 'SignUp', { owner }));

      await users.setController(controller, { from: owner });
    });

    it('should return true when the delegate is calling', async () => {
      await expect(users.isControllerOf(controller, userId)).to.eventually.be.true;
    });

    it('should return false if caller is not the delegate', async () => {
      await expect(users.isControllerOf(stranger, userId)).to.eventually.be.false;
    });
  });

  describe('#getUser()', () => {
    it('should return correct data', async () => {
      const { logs } = await users.create({ from: owner });
      const { args: { userId } } = expectEvent.inLogs(logs, 'SignUp', { owner });

      const user = await users.getUser(userId);
      expect(user.owner).to.be.equal(owner);
      expect(user.status).to.be.equal(String(USER_STATUS_CREATED));
    });

    it('should fail if unknown ID is given', async () => {
      const unknownId = '0xdeadbeefcafebabe';
      await expectRevert(users.getUser(unknownId), 'Users: user does not exist');
    });
  });

  describe('#getUserId()', () => {
    it('should return correct ID', async () => {
      const { logs } = await users.create({ from: owner });
      const { args: { userId } } = expectEvent.inLogs(logs, 'SignUp', { owner });
      await expect(users.getUserId(owner)).to.eventually.be.equal(userId);
    });

    it('should fail if unknown address is given', async () => {
      await expectRevert(users.getUserId(stranger), 'Users: unknown address');
    });
  });
});
