pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./Accounts.sol";
import "./AppRegistry.sol";
import "./ConsentsLib.sol";
import "./DataTypeRegistry.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * @author Airbloc Foundation 2019
 * @title Consents is a contract managing users' consent for applications
 * doing specific actions (e.g. Data Collecting, Data Exchanging) to data types.
 */
contract Consents {
    using ConsentsLib for ConsentsLib.Consents;

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

    // consents
    ConsentsLib.Consents private consents;

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

        ConsentsLib.ConsentBase memory consentBase;

        if (!consents.exists(userId, app.name, dataType)) {
            consentBase = consents.newConsent(userId, app.name, dataType);
        } else {
            consentBase = consents.get(userId, app.name, dataType);
        }

        if (actionType == ACTION_TYPE_COLLECTION) {
            consentBase.collection = ConsentsLib.Consent({
                allowed: allowed,
                at: block.number
            });
        }

        if (actionType == ACTION_TYPE_EXCHANGE) {
            consentBase.exchange = ConsentsLib.Consent({
                allowed: allowed,
                at: block.number
            });
        }

        consents.update(consentBase, userId, app.name, dataType);
    }

    function isCollectionAllowed(
        bytes8 userId,
        string memory appName,
        string memory dataType
    ) public view returns (bool) {
        return isCollectionAllowedAt(userId, appName, dataType, block.number);
    }

    function isCollectionAllowedAt(
        bytes8 userId,
        string memory appName,
        string memory dataType,
        uint256 blockNumber
    ) public view returns (bool) {
        ConsentsLib.Consent memory consent = consents.get(userId, appName, dataType).collection;
        return consent.allowed && consent.at < blockNumber;
    }

    function isExchangeAllowed(
        bytes8 userId,
        string memory appName,
        string memory dataType
    ) public view returns (bool) {
        return isExchangeAllowedAt(userId, appName, dataType, block.number);
    }

    function isExchangeAllowedAt(
        bytes8 userId,
        string memory appName,
        string memory dataType,
        uint256 blockNumber
    ) public view returns (bool) {
        ConsentsLib.Consent memory consent = consents.get(userId, appName, dataType).exchange;
        return consent.allowed && consent.at < blockNumber;
    }
}
