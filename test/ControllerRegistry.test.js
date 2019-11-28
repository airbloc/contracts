const { expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('./test-utils');

const ControllerRegistry = artifacts.require('ControllerRegistry');

contract('ControllerRegistry', async (accounts) => {
  const [contractOwner, controller, stranger] = accounts;
  let controllers;

  beforeEach(async () => {
    controllers = await ControllerRegistry.new();
  });

  describe('#register()', () => {
    it('should done correctly', async () => {
      const { logs } = await controllers.register(controller, { from: contractOwner });
      expectEvent.inLogs(logs, 'Registration', { controller });
    });

    it('should fail when it called by non-owners', async () => {
      await expectRevert(
        controllers.register(controller, { from: stranger }),
        'Ownable: caller is not the owner',
      );
    });

    it('should fail when controller already registered', async () => {
      await controllers.register(controller);
      await expectRevert(
        controllers.register(controller),
        'ControllerRegistry: already registered',
      );
    });
  });

  describe('#unregister', () => {
    beforeEach(async () => {
      await controllers.register(controller, { from: contractOwner });
    });

    it('should done correctly', async () => {
      const { logs } = await controllers.unregister(controller, { from: contractOwner });
      expectEvent.inLogs(logs, 'Unregistration', { controller });
    });

    it('should fail when it called by non-owners', async () => {
      await expectRevert(
        controllers.unregister(controller, { from: stranger }),
        'Ownable: caller is not the owner',
      );
    });

    it('should fail when controller already unregistered', async () => {
      await controllers.unregister(controller, { from: contractOwner });
      await expectRevert(
        controllers.unregister(controller, { from: contractOwner }),
        'ControllerRegistry: already unregistered',
      );
    });
  });

  describe('#isController', () => {
    it('should return true when given address is registered', async () => {
      await controllers.register(controller, { from: contractOwner });
      const isController = await controllers.isController(controller);
      expect(isController).to.be.true;
    });

    it('should return false when given address is unregistered', async () => {
      const isController = await controllers.isController(controller);
      expect(isController).to.be.false;
    });
  });
});
