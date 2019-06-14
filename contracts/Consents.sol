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

    struct Consentbase {
        // TODO: fill
        mapping(bytes8 => Consent) usersConsents;
    }

    struct Consent {
        bool allowed;
        uint256 at;
    }

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
        modifyConsent(ACTION_TYPE_COLLECTION, userId, app.name, dataType, true);

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
        modifyConsent(ACTION_TYPE_COLLECTION, userId, app.name, dataType, true);

        emit CollectionConsented(userId, app.hashedName, dataType, allowed);
    }

    function consentExchange(
        string memory appName,
        string memory dataType,
        bool allowed
    ) public {
        AppRegistry.App memory app = apps.get(appName);

        bytes8 userId = accounts.getAccountId(msg.sender);
        modifyConsent(ACTION_TYPE_EXCHANGE, userId, app.name, dataType, true);

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
        modifyConsent(ACTION_TYPE_EXCHANGE, userId, app.name, dataType, true);

        emit ExchangeConsented(userId, app.hashedName, dataType, allowed);
    }


    function modifyConsent(
        bytes4 actionType,
        bytes8 userId,
        string memory app,
        string memory dataType,
        bool allowed
    ) internal view {
        require(apps.exists(app), "app does not exist");
        require(dataTypes.exists(dataType), "data type does not exist");

        // if (consent.at != 0 && accounts.isTemporary(userId)) {
        //     // temporary account can't change consent settings that already set.
        //     revert("The account is currently locked.");
        // }
        // consent.allowed = allowed;
        // consent.at = block.number;
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
        // TODO: old code
        // return collections[collectionId].dataCollectionOf[user].isAllowed
        //     && collections[collectionId].dataCollectionOf[user].authorizedAt < blockNumber;
    }

    // TODO: isExchangeAllowed, isExchangeAllowedAt
}
