const { expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('./test-utils');

const AppRegistry = artifacts.require('AppRegistry');

const TEST_APP_NAME = 'test-app';

contract('AppRegistry', async (accounts) => {
  let apps;

  const [owner, stranger] = accounts;

  beforeEach(async () => {
    apps = await AppRegistry.new();
  });

  describe('#register', () => {
    it('should done correctly', async () => {
      const { logs } = await apps.register(TEST_APP_NAME, { from: owner });
      const { args: { appId } } = expectEvent.inLogs(logs, 'Registration', { appName: TEST_APP_NAME });

      const fetchedAppId = await apps.getId(TEST_APP_NAME);
      expect(fetchedAppId).to.be.equal(appId);

      const app = await apps.get(TEST_APP_NAME, { from: owner });
      expect(app.name).to.be.equal(TEST_APP_NAME);
      expect(app.owner).to.be.equal(owner);
    });

    it('should fail when register with same name twice', async () => {
      await apps.register(TEST_APP_NAME, { from: owner });
      await expectRevert(
        apps.register(TEST_APP_NAME, { from: owner }),
        'AppRegistry: app correspond to this name already registered',
      );
    });
  });

  describe('#unregister', () => {
    beforeEach(async () => {
      await apps.register(TEST_APP_NAME, { from: owner });
    });

    it('should done correctly', async () => {
      const { logs } = await apps.unregister(TEST_APP_NAME, { from: owner });
      expectEvent.inLogs(logs, 'Unregistration', { appName: TEST_APP_NAME });

      await expectRevert(
        apps.get(TEST_APP_NAME, { from: owner }),
        'AppRegistry: app does not exist',
      );
    });

    it('should fail when unauthorized address tries to unregister', async () => {
      await expectRevert(
        apps.unregister(TEST_APP_NAME, { from: stranger }),
        'AppRegistry: unauthorized',
      );
    });

    it('should fail when trying to unregister app which does not exist', async () => {
      await apps.unregister(TEST_APP_NAME, { from: owner });
      await expectRevert(
        apps.unregister(TEST_APP_NAME, { from: owner }),
        'AppRegistry: app does not exist',
      );
    });
  });

  describe('#transferAppOwner', () => {
    beforeEach(async () => {
      await apps.register(TEST_APP_NAME, { from: owner });
    });

    it('should done correctly', async () => {
      const { logs } = await apps.transferAppOwner(TEST_APP_NAME, stranger, { from: owner });
      expectEvent.inLogs(logs, 'AppOwnerTransferred', {
        appName: TEST_APP_NAME,
        oldOwner: owner,
        newOwner: stranger,
      });
    });

    it('should fail when sender is not owner of the app', async () => {
      await expectRevert(
        apps.transferAppOwner(TEST_APP_NAME, stranger, { from: stranger }),
        'AppRegistry: only owner can transfer ownership',
      );
    });
  });

  describe('#get', async () => {
    it('should return app correctly', async () => {
      await apps.register(TEST_APP_NAME, { from: owner });
      const app = await apps.get(TEST_APP_NAME);
      expect(app.name).to.be.equal(TEST_APP_NAME);
      expect(app.owner).to.be.equal(owner);
    });

    it('should fail when app does not exist', async () => {
      await expectRevert(
        apps.register(TEST_APP_NAME, { from: owner }),
        'AppRegistry: app does not exist',
      );
    });
  });

  describe('#getId', async () => {
    it('should return app id correctly', async () => {
      const { logs } = await apps.register(TEST_APP_NAME, { from: owner });
      const { args: { appId } } = expectEvent.inLogs(logs, 'Registration', { appName: TEST_APP_NAME });

      const fetchedAppId = await apps.getId(TEST_APP_NAME);
      expect(fetchedAppId).to.be.equal(appId);
    });
  });

  describe('#exists', async () => {
    it('should returnn true when app does exist', async () => {
      await apps.register(TEST_APP_NAME, { from: owner });
      const existance = await apps.exists(TEST_APP_NAME);
      expect(existance).to.be.true;
    });

    it('shuold return false when app does not exist', async () => {
      const existance = await apps.exists(TEST_APP_NAME);
      expect(existance).to.be.false;
    });
  });

  describe('#isOwner', async () => {
    beforeEach(async () => {
      await apps.register(TEST_APP_NAME, { from: owner });
    });

    it('should return true when given owner is actual owner of app', async () => {
      const isOwner = await apps.isOwner(TEST_APP_NAME, owner);
      expect(isOwner).to.be.true;
    });

    it('should return false when given owner is not owner of app', async () => {
      const isOwner = await apps.isOwner(TEST_APP_NAME, stranger);
      expect(isOwner).to.be.false;
    });
  });
});
