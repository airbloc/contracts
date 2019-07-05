pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

contract IEscrow {
    string public constant CONVERT_SIGNATURE = "convert(bytes4,bytes,bytes8)";
    bytes4 public constant CONVERT_SELECTOR = bytes4(keccak256(bytes(CONVERT_SIGNATURE)));

    function convert(bytes4 sign, bytes memory args, bytes8 offerId) public pure returns (bytes memory);
}