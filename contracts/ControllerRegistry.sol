pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * ControllerRegistry is a contract for managing data controllers.
 * In the initial version, it will be operated as a permissioned manner.
 */
contract ControllerRegistry is Ownable {

    event Registration(address indexed controller);
    event Unregistration(address indexed controller);

    struct DataController {
        address controller;

        // TODO: list
        mapping(bytes8 => bool) delegatingUsers;
        uint256 usersCount;
    }

    mapping(address => DataController) public controllers;

    /**
     * @dev Creates a new application.
     */
    function register(address controllerAddr) public onlyOwner {
        require(!exists(controllerAddr), "already registered");

        DataController storage controller = controllers[controllerAddr];
        controller.controller = controllerAddr;
        controller.usersCount = 0;

        emit Registration(controllerAddr);
    }

    /**
     * @dev Returns an application object.
     * Reverts if the given name does not exist.
     */
    function get(address controller) internal view returns (DataController storage) {
        require(exists(controller), "controller does not exist");
        return controllers[controller];
    }

    /**
     * @return true if given app name exists.
     */
    function exists(address controller) public view returns (bool) {
        return get(controller).controller != address(0x0);
    }
}
