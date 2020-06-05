pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;


library FeePayerUtils {
    /**
     * @dev "0x0a" is precompiled address that returns fee payer of transaction.
     * This methods works like wrapper of precompiled contract.
     * @return fee payer of this transaction
     */
    function get() public returns (address addr) {
        assembly {
            let freemem := mload(0x40)
            let start_addr := add(freemem, 12)
            if iszero(call(gas, 0x0a, 0, 0, 0, start_addr, 20)) {
                invalid()
            }
            addr := mload(freemem)
        }
    }
}
