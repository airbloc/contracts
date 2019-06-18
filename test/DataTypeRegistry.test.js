const truffleAssert = require('truffle-assertions');
const { expect } = require('./test-utils');

const DataTypeRegistry = artifacts.require('DataTypeRegistry');

contract('DataTypeRegistry', async (accounts) => {
  const [me, stranger] = accounts;

  // test data
  const dataSchema = '{"type": "string", "default": "This is test lul"}';
  const schemaHash = web3.utils.sha3(dataSchema);

  it('should register', async () => {
    const dataTypes = await DataTypeRegistry.new();

    const result = await dataTypes.register('test-data', schemaHash);
    truffleAssert.eventEmitted(result, 'Registration', event => event.name === 'test-data');
  });

  it('should fail to register if the name duplicates', async () => {
    const dataTypes = await DataTypeRegistry.new();
    await dataTypes.register('test-data', schemaHash);

    await truffleAssert.fails(
      dataTypes.register('test-data', schemaHash),
      truffleAssert.ErrorType.REVERT,
      'already exists',
    );
  });

  it('should able to get registered app data', async () => {
    const dataTypes = await DataTypeRegistry.new();
    await dataTypes.register('test-data', schemaHash);

    const dataType = await dataTypes.get('test-data');
    expect(dataType.name).to.equal('test-data');
    expect(dataType.schemaHash).to.equal(schemaHash);
    expect(dataType.owner).to.equal(me);
  });

  it('should able to check existance', async () => {
    const dataTypes = await DataTypeRegistry.new();
    await dataTypes.register('test-data', schemaHash);

    await expect(dataTypes.exists('test-data')).to.eventually.be.true;
    await expect(dataTypes.exists('wrong-test-data')).to.eventually.be.false;
  });

  it('should unregister', async () => {
    const dataTypes = await DataTypeRegistry.new();
    await dataTypes.register('test-data', schemaHash);

    const result = await dataTypes.unregister('test-data');
    truffleAssert.eventEmitted(result, 'Unregistration', event => event.name === 'test-data');
  });

  it('should fail to unregister if it is not by the owner', async () => {
    const dataTypes = await DataTypeRegistry.new();
    await dataTypes.register('test-data', schemaHash);

    await truffleAssert.fails(
      dataTypes.unregister('test-data', { from: stranger }),
      truffleAssert.ErrorType.REVERT,
      'unauthorized',
    );
  });
});
