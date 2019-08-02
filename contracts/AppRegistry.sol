pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

/**
 * AppRegistry is a contract for managing apps (Data Providers).
 *
 * In the future, in order to register application,
 * a data provider must stake ABL to this contract as a colletral.
 */
contract AppRegistry {

    event Registration(address indexed appAddr, string appName);
    event Unregistration(address indexed appAddr, string appName);

    event AppOwnerTransferred(
        address indexed appAddr, string appName,
        address indexed oldOwner, address newOwner);

    struct App {
        string name;
        address owner;
        address addr;
    }

    mapping(string => App) apps;
    mapping(address => string) appAddrToName;

    /**
     * @dev Creates a new application.
     */
    function register(string memory appName) public {
        require(!exists(appName), "AppRegistry: app name already exist");

        App storage app = _get(appName);
        app.name = appName;
        app.owner = msg.sender;
        app.addr = address(bytes20(keccak256(abi.encodePacked(appName))));
        appAddrToName[app.addr] = app.name;

        emit Registration(app.addr, app.name);
    }

    /**
     * @dev Removes an application.
     */
    function unregister(string memory appName) public {
        require(isOwner(appName, msg.sender), "AppRegistry: unauthorized");

        App memory app = get(appName);
        delete apps[appName];
        delete appAddrToName[app.addr];

        emit Unregistration(app.addr, app.name);
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
     * @return An storage-reference of application object even if it does not exist.
     */
    function _get(string memory appName) internal view returns (App storage) {
        return apps[appName];
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

        emit AppOwnerTransferred(app.addr, appName, oldOwner, newOwner);
    }
}
