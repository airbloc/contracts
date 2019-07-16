const { expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('./test-utils');

const AppRegistry = artifacts.require('AppRegistry');

contract('AppRegistry', async (accounts) => {
  const appName = 'test-app';
  const [me, stranger] = accounts;

  it('should register', async () => {
    const apps = await AppRegistry.new();

    const { logs } = await apps.register(appName);
    expectEvent.inLogs(logs, 'Registration', { appName });
  });

  it('should fail to register if the name duplicates', async () => {
    const apps = await AppRegistry.new();
    await apps.register(appName);

    await expectRevert(
      apps.register(appName),
      'AppRegistry: app name already exist',
    );
  });

  it('should able to get registered app data', async () => {
    const apps = await AppRegistry.new();
    await apps.register(appName);

    const app = await apps.get(appName);
    expect(app.name).to.equal(appName);
    expect(app.owner).to.equal(me);
  });

  it('should fail to get if it is not registered', async () => {
    const apps = await AppRegistry.new();
    await expectRevert(apps.get(appName), 'AppRegistry: app does not exist');
  });

  it('should able to check existance', async () => {
    const apps = await AppRegistry.new();
    await apps.register(appName);

    await expect(apps.exists(appName)).to.eventually.be.true;
    await expect(apps.exists('wrong-test-app')).to.eventually.be.false;
  });

  it('should able to transfer ownership', async () => {
    const apps = await AppRegistry.new();
    await apps.register(appName);

    const { logs } = await apps.transferAppOwner(appName, stranger);
    expectEvent.inLogs(logs, 'AppOwnerTransferred', { newOwner: stranger });

    const app = await apps.get(appName);
    expect(app.owner).to.equal(stranger);
  });

  it('should fail to transfer ownership if it is not by the owner', async () => {
    const apps = await AppRegistry.new();
    await apps.register(appName);

    await expectRevert(
      apps.transferAppOwner(appName, stranger, { from: stranger }),
      'AppRegistry: only owner can transfer ownership',
    );
  });

  it('should unregister', async () => {
    const apps = await AppRegistry.new();
    await apps.register(appName);

    const { logs } = await apps.unregister(appName);
    expectEvent.inLogs(logs, 'Unregistration', { appName });
  });

  it('should fail to unregister if it is not by the owner', async () => {
    const apps = await AppRegistry.new();
    await apps.register(appName);

    await expectRevert(
      apps.unregister(appName, { from: stranger }),
      'AppRegistry: unauthorized',
    );
  });
});
