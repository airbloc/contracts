const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

// configure chai
chai.use(chaiAsPromised);
exports.expect = chai.expect;
exports.assert = chai.assert;
