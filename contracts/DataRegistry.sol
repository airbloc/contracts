pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;


contract DataRegistry {
    function register() public returns (bytes8);

    function unregister() public;

    function get() public;

    function getId() public returns (bytes8);
}
