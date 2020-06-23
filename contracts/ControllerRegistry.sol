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

    mapping(address => bool) private controllers;

    /**
     * @dev Register given address in controller registry
     */
    function register(address controllerAddr) public onlyOwner {
        require(
            !isController(controllerAddr),
            "ControllerRegistry: already registered"
        );

        controllers[controllerAddr] = true;

        emit Registration(controllerAddr);
    }

    /**
     * @dev Unregister given address in controller registry
     */
    function unregister(address controllerAddr) public onlyOwner {
        require(
            isController(controllerAddr),
            "ControllerRegistry: already unregistered"
        );

        delete controllers[controllerAddr];

        emit Unregistration(controllerAddr);
    }

    /**
     * @return true if given address is controller.
     */
    function isController(address controller) public view returns (bool) {
        return controllers[controller];
    }
}
