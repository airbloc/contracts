pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

contract ExchangeContract {
    string public constant CONVERT_SIGNATURE = "convert(bytes4,bytes,bytes8)";
    bytes4 public constant CONVERT_SELECTOR = 0xf8411fa9;

    function convert(bytes4 sign, bytes memory args, bytes8 offerId) public pure returns (bytes memory);
}