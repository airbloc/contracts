const truffleAssert = require('truffle-assertions');
const { expect, getFirstEvent, createPasswordSignature } = require('./test-utils');

const Accounts = artifacts.require('Accounts');
const ControllerRegistry = artifacts.require('ControllerRegistry');

// test constants
const IDENTITY_PREIMAGE = web3.utils.keccak256('test@airbloc.org');
const IDENTITY_HASH = web3.utils.keccak256(IDENTITY_PREIMAGE);
const PASSWORD = 'AiRbLoC';

// enums (from Accounts.AccountStatus)
const ACCOUNT_STATUS_TEMPORARY = 1;
const ACCOUNT_STATUS_CREATED = 2;

contract('Accounts', async (ethAccounts) => {
  const [contractOwner, user, controller, stranger] = ethAccounts;
  let accounts;
  let controllers;

  before(async () => {
    controllers = await ControllerRegistry.new({ from: contractOwner });
    await controllers.register(controller, { from: contractOwner });
  });

  beforeEach(async () => {
    accounts = await Accounts.new(controllers.address);
  });

  describe('#create()', () => {
    it('should done correctly', async () => {
      const result = await accounts.create({ from: user });
      truffleAssert.eventEmitted(result, 'SignUp', event => event.owner === user);
    });

    it('should fail when it called twice', async () => {
      await accounts.create({ from: user });

      await truffleAssert.fails(
        accounts.create({ from: user }),
        truffleAssert.ErrorType.REVERT,
        'only one account',
      );
    });
  });

  describe('#createTemporary()', () => {
    it('should create temporary account with temporary state', async () => {
      const result = await accounts.createTemporary(IDENTITY_HASH, { from: controller });
      truffleAssert.eventEmitted(result, 'TemporaryCreated', event => event.proxy === controller);

      const { accountId } = getFirstEvent(result);
      const account = await accounts.getAccount(accountId);
      expect(account.status).to.be.equal(String(ACCOUNT_STATUS_TEMPORARY));
    });

    it('should fail when it is called by non-controllers', async () => {
      await truffleAssert.fails(
        accounts.createTemporary(IDENTITY_HASH, { from: stranger }),
        truffleAssert.ErrorType.REVERT,
      );
    });

    it('should fail when given ID already exists', async () => {
      await accounts.createTemporary(IDENTITY_HASH, { from: controller });
      await truffleAssert.fails(
        accounts.createTemporary(IDENTITY_HASH, { from: controller }),
        truffleAssert.ErrorType.REVERT,
        'already exists',
      );
    });
  });

  describe('#isTemporary()', () => {
    it('should return true for temporary account', async () => {
      const result = await accounts.createTemporary(IDENTITY_HASH, { from: controller });
      const { accountId } = getFirstEvent(result);

      await expect(accounts.isTemporary(accountId)).to.eventually.be.true;
    });

    it('should return false for created account', async () => {
      const result = await accounts.create({ from: user });
      const { accountId } = getFirstEvent(result);

      await expect(accounts.isTemporary(accountId)).to.eventually.be.false;
    });

    it('should return false for unknown account', async () => {
      const unknownId = '0xdeadbeefdeadbeef';
      await expect(accounts.isTemporary(unknownId)).to.eventually.be.false;
    });
  });

  describe('#unlockTemporary()', () => {
    let accountId;
    beforeEach(async () => {
      const result = await accounts.createTemporary(IDENTITY_HASH, { from: controller });
      ({ accountId } = getFirstEvent(result));
    });

    it('should done correctly', async () => {
      const passwordSig = createPasswordSignature([IDENTITY_PREIMAGE, user], PASSWORD);
      const unlockResult = await accounts.unlockTemporary(IDENTITY_PREIMAGE, user, passwordSig, {
        from: controller,
      });
      truffleAssert.eventEmitted(unlockResult, 'Unlocked', event => event.accountId.slice(0, 18) === accountId);

      const account = await accounts.getAccount(accountId);
      expect(account.status).to.be.equal(String(ACCOUNT_STATUS_CREATED));
      expect(account.owner).to.be.equal(user);
    });

    it('should fail when it is called by non-controllers', async () => {
      const passwordSig = createPasswordSignature([IDENTITY_PREIMAGE, user], PASSWORD);
      await truffleAssert.fails(
        accounts.unlockTemporary(IDENTITY_PREIMAGE, user, passwordSig, { from: stranger }),
        truffleAssert.ErrorType.REVERT,
      );
    });

    it('should fail when it is not called by original data controller', async () => {
      const notOriginalController = stranger;
      await controllers.register(notOriginalController, { from: contractOwner });

      const passwordSig = createPasswordSignature([IDENTITY_PREIMAGE, user], PASSWORD);
      await truffleAssert.fails(
        accounts.unlockTemporary(IDENTITY_PREIMAGE, user, passwordSig, {
          from: notOriginalController,
        }),
        truffleAssert.ErrorType.REVERT,
      );
    });

    it('should fail if given wallet address is already registered', async () => {
      await accounts.create({ from: user });

      const passwordSig = createPasswordSignature([IDENTITY_PREIMAGE, user], PASSWORD);
      await truffleAssert.fails(
        accounts.unlockTemporary(IDENTITY_PREIMAGE, user, passwordSig, { from: controller }),
        truffleAssert.ErrorType.REVERT,
      );
    });
  });

  describe('#setDelegate()', () => {
    it('should done correctly', async () => {
      await accounts.create({ from: user });
      await accounts.setDelegate(controller, { from: user });
    });
  });

  describe('#isDelegateOf()', () => {
    let accountId;
    beforeEach(async () => {
      const result = await accounts.create({ from: user });
      ({ accountId } = getFirstEvent(result));

      await accounts.setDelegate(controller, { from: user });
    });

    it('should return true when the delegate is calling', async () => {
      await expect(accounts.isDelegateOf(controller, accountId)).to.eventually.be.true;
    });

    it('should return false if caller is not the delegate', async () => {
      await expect(accounts.isDelegateOf(stranger, accountId)).to.eventually.be.false;
    });
  });

  describe('#getAccountIdFromSignature()', () => {
    let accountId;
    beforeEach(async () => {
      const result = await accounts.createTemporary(IDENTITY_HASH, { from: controller });
      ({ accountId } = getFirstEvent(result));

      const passwordSig = createPasswordSignature([IDENTITY_PREIMAGE, user], PASSWORD);
      await accounts.unlockTemporary(IDENTITY_PREIMAGE, user, passwordSig, { from: controller });
    });

    it('should return correct ID', async () => {
      const messageHash = web3.utils.soliditySha3('someParam');
      const passwordSig = createPasswordSignature(['someParam'], PASSWORD);

      await expect(accounts.getAccountIdFromSignature(messageHash, passwordSig))
        .to.be.eventually.equals(accountId);
    });

    it('should fail if the wrong password is given', async () => {
      const messageHash = web3.utils.keccak256('someParam');
      const passwordSig = createPasswordSignature(['someParam'], 'WRONG_PASSWORD');

      await truffleAssert.fails(
        accounts.getAccountIdFromSignature(messageHash, passwordSig),
        truffleAssert.ErrorType.REVERT,
        'password mismatch',
      );
    });
  });

  describe('#getAccount()', () => {
    it('should return correct data', async () => {
      const { accountId } = getFirstEvent(await accounts.create({ from: user }));
      const account = await accounts.getAccount(accountId);

      expect(account.owner).to.be.equal(user);
      expect(account.status).to.be.equal(String(ACCOUNT_STATUS_CREATED));
    });

    it('should fail if unknown ID is given', async () => {
      const unknownId = '0xdeadbeefcafebabe';
      await truffleAssert.fails(
        accounts.getAccount(unknownId),
        truffleAssert.ErrorType.REVERT,
        'not exist',
      );
    });
  });

  describe('#getAccountId()', () => {
    it('should return correct ID', async () => {
      const { accountId } = getFirstEvent(await accounts.create({ from: user }));
      await expect(accounts.getAccountId(user)).to.eventually.be.equal(accountId);
    });

    it('should fail if unknown address is given', async () => {
      await truffleAssert.fails(
        accounts.getAccountId(stranger),
        truffleAssert.ErrorType.REVERT,
        'unknown',
      );
    });
  });
});
