pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * AppRegistry is a contract for managing apps (Data Providers).
 *
 * In the future, in order to register application,
 * a data provider must stake ABL to this contract as a colletral.
 */
contract AppRegistry is Ownable {

    event Registration(string name);
    event AppOwnerTransferred(string name, address indexed oldOwner, address newOwner);
    event Unregistration(string name);

    struct App {
        string name;
        address owner;
    }

    mapping(bytes32 => App) apps;

    /**
     * @dev Creates a new application.
     */
    function register(string memory appName) public {
        require(!exists(appName), "app name already exists");

        App storage app = _get(appName);
        app.name = appName;
        app.owner = msg.sender;

        emit Registration(appName);
    }

    /**
     * @dev Returns an application object.
     * Reverts if the given name does not exist.
     */
    function get(string memory appName) public view returns (App memory) {
        require(exists(appName), "app does not exist");
        return _get(appName);
    }

    /**
     * @return An storage-reference of application object even if it does not exist.
     */
    function _get(string memory appName) internal view returns (App storage) {
        bytes32 hashedName = keccak256(abi.encodePacked(appName));
        return apps[hashedName];
    }

    /**
     * @return true if given app name exists.
     */
    function exists(string memory appName) public view returns (bool) {
        return _get(appName).owner != address(0x0);
    }

    /**
     * @return true if the caller is an owner of given app.
     */
    function isOwner(string memory appName, address owner) public view returns (bool) {
        return get(appName).owner == owner;
    }

    /**
     * @dev Transfers an ownership of app to other account.
     */
    function transferAppOwner(string memory appName, address newOwner) public {
        require(isOwner(appName, msg.sender), "only owner can transfer ownership");

        App storage app = _get(appName);
        address oldOwner = app.owner;
        app.owner = newOwner;

        emit AppOwnerTransferred(appName, oldOwner, newOwner);
    }

    /**
     * @dev Removes an application.
     */
    function unregister(string memory appName) public {
        require(isOwner(appName, msg.sender), "unauthorized");

        bytes32 hashedName = keccak256(abi.encodePacked(appName));
        delete apps[hashedName];

        emit Unregistration(appName);
    }
}
