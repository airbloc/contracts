pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./rbac/RBAC.sol";


/**
 * AppRegistry is a contract for managing apps (Data Providers).
 *
 * In the future, in order to register application,
 * a data provider must stake ABL to this contract as a colletral.
 */
contract AppRegistry is RBAC {

    event Registration(bytes8 indexed appId, string appName);
    event Unregistration(bytes8 indexed appId, string appName);

    event AppOwnerTransferred(
        bytes8 indexed appId, string appName,
        address indexed oldOwner, address newOwner);

    struct App {
        string name;
        address owner;
    }

    mapping(bytes8 => App) private apps;
    mapping(string => bytes8) private nameToApp;

    function isResourceOwner(bytes8 appId, address account) internal view returns (bool) {
        return apps[appId].owner == account;
    }

    /**
     * @dev Creates a new application.
     */
    function register(string memory appName) public returns (bytes8) {
        require(!exists(appName), "AppRegistry: app correspond to this name already registered");

        bytes8 appId = generateId(appName);
        nameToApp[appName] = appId;

        App storage app = _get(appName);
        app.name = appName;
        app.owner = msg.sender;

        emit Registration(appId, appName);
        return appId;
    }

    /**
     * @dev Removes an application.
     */
    function unregister(string memory appName) public {
        require(isOwner(appName, msg.sender), "AppRegistry: unauthorized");

        bytes8 appId = getId(appName);
        delete apps[appId];
        delete nameToApp[appName];

        emit Unregistration(appId, appName);
    }

    /**
     * @dev generates appId.
     */
    function generateId(string memory appName) internal pure returns (bytes8) {
        return bytes8(keccak256(abi.encodePacked(appName)));
    }

    /**
     * @dev Returns an application object.
     * Reverts if the given name does not exist.
     */
    function get(string memory appName) public view returns (App memory) {
        require(exists(appName), "AppRegistry: app does not exist");
        return _get(appName);
    }

    /**
     * @dev Returns an application id.
     */
    function getId(string memory appName) public view returns (bytes8) {
        return nameToApp[appName];
    }

    /**
     * @return An storage-reference of application object even if it does not exist.
     */
    function _get(string memory appName) internal view returns (App storage) {
        return apps[getId(appName)];
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
        require(isOwner(appName, msg.sender), "AppRegistry: only owner can transfer ownership");

        App storage app = _get(appName);
        address oldOwner = app.owner;
        app.owner = newOwner;

        emit AppOwnerTransferred(getId(appName), appName, oldOwner, newOwner);
    }
}
