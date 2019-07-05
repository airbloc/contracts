const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

// configure chai
chai.use(chaiAsPromised);
exports.expect = chai.expect;
exports.assert = chai.assert;

/**
 * @param {Object} txResult Truffle Transaction Result (Not Web3 standard TxResult)
 * @returns {Object | null} event data if anything is emitted. Otherwise returns {@code null}.
 */
function getFirstEvent(txResult) {
  const { logs } = txResult;
  if (!logs || logs.length === 0) return null;
  return logs[0].args;
}
exports.getFirstEvent = getFirstEvent;

/**
 * Creates a password signature, created by Accounts and used on Airbloc contracts.
 *
 * @param {Array} args Contract call arguments (except last passwordSignature parameter)
 * @param {String} password Password. Will derive a private key from it.
 */
function createPasswordSignature(args, password) {
  // in production, we need to use PBKDF2.
  // this is test purpose - DO NOT USE Keccak256 as an KDF in production.
  const kdf = web3.utils.keccak256;
  const passwordKey = web3.eth.accounts.privateKeyToAccount(kdf(password));

  const message = web3.utils.soliditySha3(...args);
  const { signature } = passwordKey.sign(message);
  return signature;
}
exports.createPasswordSignature = createPasswordSignature;
