pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./Accounts.sol";
import "./AppRegistry.sol";
import "./DataTypeRegistry.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * Consents is a contract managing users' consent for applications
 * doing specific actions (e.g. Data Collecting, Data Exchanging) to data types.
 */
contract Consents {
    event CollectionConsented(
        bytes8 indexed userId,
        bytes32 indexed app,
        string /*indexed*/ dataType,
        bool allowed
    );

    event ExchangeConsented(
        bytes8 indexed userId,
        bytes32 indexed app,
        string /*indexed*/ dataType,
        bool allowed
    );

    struct ConsentBase {
        mapping(string => ConsentBase) dataTypeConsents;
    }

    struct DataTypeConsent {
        bytes8 owner;
        bytes32 app;
        string dataType;
        Consent collection;
        Consent exchange;
    }

    struct Consent {
        bool allowed;
        uint256 at;
    }

    // consents.
    mapping(bytes32 => ConsentBase) private appConsents;
    mapping(bytes8 => ConsentBase) private userConsents;

    // action types for consents.
    bytes4 constant ACTION_TYPE_COLLECTION = bytes4(keccak256("Collection"));
    bytes4 constant ACTION_TYPE_EXCHANGE = bytes4(keccak256("Exchange"));

    Accounts private accounts;
    AppRegistry private apps;
    ControllerRegistry private dataControllers;
    DataTypeRegistry private dataTypes;

    constructor(
        Accounts accountReg,
        AppRegistry appReg,
        ControllerRegistry controllerReg,
        DataTypeRegistry dataTypeReg
    )
        public
    {
        accounts = accountReg;
        apps = appReg;
        dataControllers = controllerReg;
        dataTypes = dataTypeReg;
    }

    modifier onlyDataController() {
        require(dataControllers.exists(msg.sender), 'caller is not a data controller');
        _;
    }

    function consentCollection(
        string memory appName,
        string memory dataType,
        bool allowed
    ) public {
        AppRegistry.App memory app = apps.get(appName);

        bytes8 userId = accounts.getAccountId(msg.sender);
        updateConsent(ACTION_TYPE_COLLECTION, userId, app, dataType, true);

        emit CollectionConsented(userId, app.hashedName, dataType, allowed);
    }

    function consentCollectionByController(
        bytes8 userId,
        string memory appName,
        string memory dataType,
        bool allowed
    ) public onlyDataController {
        AppRegistry.App memory app = apps.get(appName);

        require(accounts.isDelegateOf(msg.sender, userId), "sender must be delegate of this user");
        updateConsent(ACTION_TYPE_COLLECTION, userId, app, dataType, true);

        emit CollectionConsented(userId, app.hashedName, dataType, allowed);
    }

    function consentExchange(
        string memory appName,
        string memory dataType,
        bool allowed
    ) public {
        AppRegistry.App memory app = apps.get(appName);

        bytes8 userId = accounts.getAccountId(msg.sender);
        updateConsent(ACTION_TYPE_EXCHANGE, userId, app, dataType, true);

        emit ExchangeConsented(userId, app.hashedName, dataType, allowed);
    }

    function consentExchangeByController(
        bytes8 userId,
        string memory appName,
        string memory dataType,
        bool allowed
    ) public onlyDataController {
        AppRegistry.App memory app = apps.get(appName);

        require(accounts.isDelegateOf(msg.sender, userId), "sender must be delegate of this user");
        updateConsent(ACTION_TYPE_EXCHANGE, userId, app, dataType, true);

        emit ExchangeConsented(userId, app.hashedName, dataType, allowed);
    }


    function updateConsent(
        bytes4 actionType,
        bytes8 userId,
        AppRegistry.App memory app,
        string memory dataType,
        bool allowed
    ) internal {
        require(app.owner == address(0x0), "app does not exist");
        require(dataTypes.exists(dataType), "data type does not exist");

        ConsentBase storage consent = _get(userId);
        if (actionType == ACTION_TYPE_COLLECTION) {
            consent.collection = Consent({
                allowed: allowed,
                at: block.number
            });
        }

        if (actionType == ACTION_TYPE_EXCHANGE) {
            consent.exchange = Consent({
                allowed: allowed,
                at: block.number
            });
        }
    }

    /**
     * @dev Returns a consent base object.
     * Reverts if the given userId does not exists.
     */
    function getByUser(bytes8 userId) public view returns (ConsentBase memory) {
        require(exists(userId), "consent does not exists");
        return _getByUser(userId);
    }

    /**
     * @dev Returns a consent base object.
     * Reverts if the given app does not exists.
     */
    function getByApp(string memory appName) public view returns (ConsentBase memory) {
        require(exists(userId), "consent does not exists");
        return _getByUser(userId);
    }

    /**
     * @return An storage-reference of consent base object event if it does not exists.
     */
    function _getByUser(bytes8 userId) internal view returns (ConsentBase storage) {
        return userConsents[userId];
    }

    /**
     * @return An storage-reference of consent base object event if it does not exists.
     */
    function _getByApp(bytes8 userId) internal view returns (ConsentBase storage) {
        return userConsents[userId];
    }

    /**
     * @return true if given userId exists.
     */
    function existsByUser(bytes8 userId) public view returns (bool) {
        return _getByUser(userId).owner == bytes8(0x0);
    }

    /**
     * @return true if given userId exists.
     */
    function existsByApp(bytes8 userId) public view returns (bool) {
        return _getByUser(userId).owner == bytes8(0x0);
    }

    function isCollectionAllowed(
        string memory appName,
        string memory dataType,
        bytes8 userId
    ) public view returns (bool) {
        return isCollectionAllowedAt(appName, dataType, userId, block.number);
    }

    function isCollectionAllowedAt(
        string memory appName,
        string memory dataType,
        bytes8 userId,
        uint256 blockNumber
    ) public view returns (bool) {
        Consent memory consent = get(userId).collection;
        return consent.allowed && consent.at < blockNumber;
    }

    // TODO: isExchangeAllowed, isExchangeAllowedAt
}
