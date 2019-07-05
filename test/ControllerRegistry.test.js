const truffleAssert = require('truffle-assertions');
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
      const result = await controllers.register(controllerAddr, { from: contractOwner });
      truffleAssert.eventEmitted(result, 'Registration', event => event.controller === controllerAddr);
    });

    it('should fail when it called by non-owners', async () => {
      await truffleAssert.fails(
        controllers.register(controllerAddr, { from: stranger }),
        truffleAssert.ErrorType.REVERT,
        'not the owner',
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
      await truffleAssert.fails(
        controllers.get(stranger),
        truffleAssert.ErrorType.REVERT,
        'does not exist',
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
