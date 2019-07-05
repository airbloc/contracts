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
