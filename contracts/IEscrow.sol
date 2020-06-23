pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;


contract IEscrow {
    function convert(
        bytes4 sign,
        bytes memory args,
        bytes8 offerId
    ) public view returns (bytes memory);
}
