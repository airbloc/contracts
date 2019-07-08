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

const Web3 = require('web3');

const web3 = new Web3();

const ErrorSelector = '0x08c379a0';
function decodeErrorReason(data) {
  if (!data.startsWith(ErrorSelector)) {
    return '';
  }
  const returnData = data.slice(10); // remove selector

  return web3.eth.abi.decodeParameter('string', `0x${returnData}`);
}
exports.decodeErrorReason = decodeErrorReason;
