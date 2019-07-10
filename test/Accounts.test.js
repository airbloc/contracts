const { expectEvent, expectRevert } = require('openzeppelin-test-helpers');
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
      const { logs } = await accounts.create({ from: user });
      expectEvent.inLogs(logs, 'SignUp', { owner: user });
    });

    it('should fail when it called twice', async () => {
      await accounts.create({ from: user });
      await expectRevert(
        accounts.create({ from: user }),
        'Accounts: you can make only one account per one Ethereum Account',
      );
    });
  });

  describe('#createTemporary()', () => {
    it('should create temporary account with temporary state', async () => {
      const { logs } = await accounts.createTemporary(IDENTITY_HASH, { from: controller });
      const { args: { accountId } } = expectEvent.inLogs(logs, 'TemporaryCreated', { proxy: controller });

      const account = await accounts.getAccount(accountId);
      expect(account.status).to.be.equal(String(ACCOUNT_STATUS_TEMPORARY));
    });

    it('should fail when it is called by non-controllers', async () => {
      await expectRevert(
        accounts.createTemporary(IDENTITY_HASH, { from: stranger }),
        'Accounts: caller is not a data controller',
      );
    });

    it('should fail when given ID already exists', async () => {
      await accounts.createTemporary(IDENTITY_HASH, { from: controller });
      await expectRevert(
        accounts.createTemporary(IDENTITY_HASH, { from: controller }),
        'Accounts: account already exists',
      );
    });
  });

  describe('#isTemporary()', () => {
    it('should return true for temporary account', async () => {
      const { logs } = await accounts.createTemporary(IDENTITY_HASH, { from: controller });
      const { args: { accountId } } = expectEvent.inLogs(logs, 'TemporaryCreated', { proxy: controller });

      await expect(accounts.isTemporary(accountId)).to.eventually.be.true;
    });

    it('should return false for created account', async () => {
      const { logs } = await accounts.create({ from: user });
      const { args: { accountId } } = expectEvent.inLogs(logs, 'SignUp', { owner: user });

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
      const { logs } = await accounts.createTemporary(IDENTITY_HASH, { from: controller });
      ({ args: { accountId } } = expectEvent.inLogs(logs, 'TemporaryCreated', { proxy: controller }));
    });

    it('should done correctly', async () => {
      const passwordSig = createPasswordSignature([IDENTITY_PREIMAGE, user], PASSWORD);
      const { logs } = await accounts.unlockTemporary(IDENTITY_PREIMAGE, user, passwordSig, {
        from: controller,
      });
      expectEvent.inLogs(logs, 'Unlocked', { accountId: `${accountId.padEnd(66, '0')}` });

      const account = await accounts.getAccount(accountId);
      expect(account.status).to.be.equal(String(ACCOUNT_STATUS_CREATED));
      expect(account.owner).to.be.equal(user);
    });

    it('should fail when it is called by non-controllers', async () => {
      const passwordSig = createPasswordSignature([IDENTITY_PREIMAGE, user], PASSWORD);
      await expectRevert(
        accounts.unlockTemporary(IDENTITY_PREIMAGE, user, passwordSig, { from: stranger }),
        'Accounts: caller is not a data controller',
      );
    });

    it('should fail when it is not called by original data controller', async () => {
      const notOriginalController = stranger;
      await controllers.register(notOriginalController, { from: contractOwner });

      const passwordSig = createPasswordSignature([IDENTITY_PREIMAGE, user], PASSWORD);
      await expectRevert(
        accounts.unlockTemporary(IDENTITY_PREIMAGE, user, passwordSig, {
          from: notOriginalController,
        }),
        'Accounts: account must be unlocked through the designated data controller',
      );
    });

    it('should fail if given wallet address is already registered', async () => {
      await accounts.create({ from: user });

      const passwordSig = createPasswordSignature([IDENTITY_PREIMAGE, user], PASSWORD);
      await expectRevert(
        accounts.unlockTemporary(IDENTITY_PREIMAGE, user, passwordSig, { from: controller }),
        'Accounts: you can make only one account per one Ethereum Account',
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
      const { logs } = await accounts.create({ from: user });
      ({ args: { accountId } } = expectEvent.inLogs(logs, 'SignUp', { owner: user }));

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
      const { logs } = await accounts.createTemporary(IDENTITY_HASH, { from: controller });
      ({ args: { accountId } } = expectEvent.inLogs(logs, 'TemporaryCreated', { proxy: controller }));

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

      await expectRevert(
        accounts.getAccountIdFromSignature(messageHash, passwordSig),
        'Accounts: password mismatch',
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
      await expectRevert(accounts.getAccount(unknownId), 'Accounts: account does not exist');
    });
  });

  describe('#getAccountId()', () => {
    it('should return correct ID', async () => {
      const { accountId } = getFirstEvent(await accounts.create({ from: user }));
      await expect(accounts.getAccountId(user)).to.eventually.be.equal(accountId);
    });

    it('should fail if unknown address is given', async () => {
      await expectRevert(accounts.getAccountId(stranger), 'Accounts: unknown address');
    });
  });
});
