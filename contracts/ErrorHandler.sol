pragma solidity ^0.5.0;

/**
 * @title ErrorHandler contract contains error handling method.
 * which works with return-value of native-call.
 * For details : https://github.com/ethereum/EIPs/issues/838
 */
contract ErrorHandler {
    event Reverted(string reason);
    function Error(string memory reason) public {
        emit Reverted(reason);
    }
}