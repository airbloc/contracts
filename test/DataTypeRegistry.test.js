const { expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('./test-utils');

const DataTypeRegistry = artifacts.require('DataTypeRegistry');

// test data
const DATA_SCHEMA = JSON.stringify({
  type: 'string',
  default: 'This is test lul',
});
const SCHEMA_HASH = web3.utils.sha3(DATA_SCHEMA);

contract('DataTypeRegistry', async (ethAccounts) => {
  const name = 'test-data';
  const [me, stranger] = ethAccounts;
  let dataTypes;

  beforeEach(async () => {
    dataTypes = await DataTypeRegistry.new();
  });

  describe('#register()', () => {
    it('should done correctly', async () => {
      const { logs } = await dataTypes.register(name, SCHEMA_HASH);
      expectEvent.inLogs(logs, 'Registration', { name });
    });

    it('should fail if the name duplicates', async () => {
      await dataTypes.register(name, SCHEMA_HASH);
      await expectRevert(
        dataTypes.register(name, SCHEMA_HASH),
        'DataTypeRegistry: data type name already exists',
      );
    });
  });

  describe('#get()', () => {
    it('should retrieve registered app data', async () => {
      await dataTypes.register(name, SCHEMA_HASH);

      const dataType = await dataTypes.get(name);
      expect(dataType.name).to.equal(name);
      expect(dataType.schemaHash).to.equal(SCHEMA_HASH);
      expect(dataType.owner).to.equal(me);
    });

    it('should fail on unregistered app name', async () => {
      await expectRevert(
        dataTypes.get('unregistered-app'),
        'DataTypeRegistry: data type does not exist',
      );
    });
  });

  describe('#exists()', () => {
    it('should able to check existence', async () => {
      await dataTypes.register(name, SCHEMA_HASH);

      await expect(dataTypes.exists(name)).to.eventually.be.true;
      await expect(dataTypes.exists('wrong-test-data')).to.eventually.be.false;
    });
  });

  describe('#unregister()', () => {
    it('should unregister correctly', async () => {
      await dataTypes.register(name, SCHEMA_HASH);

      const { logs } = await dataTypes.unregister(name);
      expectEvent.inLogs(logs, 'Unregistration', { name });

      await expectRevert(dataTypes.get(name), 'DataTypeRegistry: data type does not exist');
    });

    it('should fail to unregister if it is not by the owner', async () => {
      await dataTypes.register(name, SCHEMA_HASH);

      await expectRevert(
        dataTypes.unregister(name, { from: stranger }),
        'DataTypeRegistry: unauthorized',
      );
    });
  });
});
