const truffleAssert = require('truffle-assertions');
const { expect } = require('./test-utils');

const DataTypeRegistry = artifacts.require('DataTypeRegistry');

// test data
const DATA_SCHEMA = JSON.stringify({
  type: 'string',
  default: 'This is test lul',
});
const SCHEMA_HASH = web3.utils.sha3(DATA_SCHEMA);

contract('DataTypeRegistry', async (ethAccounts) => {
  const [me, stranger] = ethAccounts;
  let dataTypes;

  beforeEach(async () => {
    dataTypes = await DataTypeRegistry.new();
  });

  describe('#register()', () => {
    it('should done correctly', async () => {
      const result = await dataTypes.register('test-data', SCHEMA_HASH);
      truffleAssert.eventEmitted(result, 'Registration', event => event.name === 'test-data');
    });

    it('should fail if the name duplicates', async () => {
      await truffleAssert.passes(dataTypes.register('test-data', SCHEMA_HASH));
      await truffleAssert.fails(
        dataTypes.register('test-data', SCHEMA_HASH),
        truffleAssert.ErrorType.REVERT,
        'already exists',
      );
    });
  });

  describe('#get()', () => {
    it('should retrieve registered app data', async () => {
      await dataTypes.register('test-data', SCHEMA_HASH);

      const dataType = await dataTypes.get('test-data');
      expect(dataType.name).to.equal('test-data');
      expect(dataType.schemaHash).to.equal(SCHEMA_HASH);
      expect(dataType.owner).to.equal(me);
    });

    it('should fail on unregistered app name', async () => {
      await truffleAssert.fails(dataTypes.get('unregistered-app'), truffleAssert.ErrorType.REVERT);
    });
  });

  describe('#exists()', () => {
    it('should able to check existence', async () => {
      await dataTypes.register('test-data', SCHEMA_HASH);

      await expect(dataTypes.exists('test-data')).to.eventually.be.true;
      await expect(dataTypes.exists('wrong-test-data')).to.eventually.be.false;
    });
  });

  describe('#unregister()', () => {
    it('should unregister correctly', async () => {
      await dataTypes.register('test-data', SCHEMA_HASH);

      const result = await dataTypes.unregister('test-data');
      truffleAssert.eventEmitted(result, 'Unregistration', event => event.name === 'test-data');
    });

    it('should fail to unregister if it is not by the owner', async () => {
      await dataTypes.register('test-data', SCHEMA_HASH);

      await truffleAssert.fails(
        dataTypes.unregister('test-data', { from: stranger }),
        truffleAssert.ErrorType.REVERT,
        'unauthorized',
      );
    });
  });
});
