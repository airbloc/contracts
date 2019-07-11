const { expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('./test-utils');

const ControllerRegistry = artifacts.require('ControllerRegistry');

contract('ControllerRegistry', async (accounts) => {
  const [contractOwner, controllerAddr, stranger] = accounts;
  let controllers;

  beforeEach(async () => {
    controllers = await ControllerRegistry.new();
  });

  describe('#register()', () => {
    it('should done correctly', async () => {
      const { logs } = await controllers.register(controllerAddr, { from: contractOwner });
      expectEvent.inLogs(logs, 'Registration', { controller: controllerAddr });
    });

    it('should fail when it called by non-owners', async () => {
      await expectRevert(
        controllers.register(controllerAddr, { from: stranger }),
        'Ownable: caller is not the owner',
      );
    });

    it('should fail when controller already registered', async () => {
      await controllers.register(controllerAddr);
      await expectRevert(
        controllers.register(controllerAddr),
        'ControllerRegistry: already registered',
      );
    });
  });

  describe('#get()', () => {
    it('should return registered controller data', async () => {
      await controllers.register(controllerAddr);

      const dataController = await controllers.get(controllerAddr);
      expect(dataController.controller).to.equal(controllerAddr);
    });

    it('should fail if unknown address is given', async () => {
      await expectRevert(
        controllers.get(stranger),
        'ControllerRegistry: controller does not exist',
      );
    });
  });

  describe('#exists()', () => {
    it('should able to check existance', async () => {
      await controllers.register(controllerAddr);

      await expect(controllers.exists(controllerAddr)).to.eventually.be.true;
      await expect(controllers.exists(stranger)).to.eventually.be.false;
    });
  });
});
