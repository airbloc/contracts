pragma solidity ^0.5.0;


library StringUtils {
    function equals(string memory a, string memory b)
        public
        pure
        returns (bool)
    {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }

    function isEmpty(string memory a) public pure returns (bool) {
        return bytes(a).length == 0;
    }
}
