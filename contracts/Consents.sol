pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./Users.sol";
import "./AppRegistry.sol";
import "./ConsentsLib.sol";
import "./DataTypeRegistry.sol";

/**
 * @title Consents is a contract managing users' consent for applications
 * doing specific actions (e.g. Data Collecting, Data Exchanging) to data types.
 */
contract Consents {
    using ConsentsLib for ConsentsLib.Consents;

    enum ActionTypes {
        Collection,
        Exchange
    }

    event Consented(
        ActionTypes indexed action,
        bytes8 indexed userId,
        bytes8 indexed appId,
        string appName,
        string dataType,
        bool allowed
    );

    uint256 constant public CONSENT_DATA_MAX_LENGTH = 128;

    // consents
    ConsentsLib.Consents private consents;

    Users private users;
    AppRegistry private apps;
    ControllerRegistry private dataControllers;
    DataTypeRegistry private dataTypes;

    constructor(
        Users userReg,
        AppRegistry appReg,
        ControllerRegistry controllerReg,
        DataTypeRegistry dataTypeReg
    )
        public
    {
        users = userReg;
        apps = appReg;
        dataControllers = controllerReg;
        dataTypes = dataTypeReg;
    }

    struct ConsentData {
        ActionTypes action;
        string dataType;
        bool allow;
    }

    /**
     * @dev checks authority of msg.sender
     * There are two actions related with this contract
     * - consent:create
     * - consent:modify
     * If app does exist, this method checks sender has authority about consent:modify
     * If app does not exist, this method checks sender has authority about consent:create
     * @param userId id of user
     * @param appName name of app registered in AppRegistry
     * @param authConsentCreate sender's authority about consent:create
     * @param authConsentModify sender's authority about consent:modify
     * @param consentData consent data for search existing consent information
     */
    function _checkAuthority(
        bytes8 userId,
        string memory appName,
        bool authConsentCreate,
        bool authConsentModify,
        ConsentData memory consentData
    ) internal view {
        bool consentExists = consents.exists(
            userId,
            appName,
            uint(consentData.action),
            consentData.dataType
        );
        if (consentExists) {
            require(authConsentModify, "Consents: sender must be authorized before modify consent");
        } else {
            require(authConsentCreate, "Consents: sender must be authorized before create consent");
        }
    }

    /**
     * @param userId id of user
     * @param appName name of app registered in AppRegistry
     * @param consentData consent data for update consent information
     */
    function _updateConsent(
        bytes8 userId,
        string memory appName,
        ConsentData memory consentData
    ) internal {
        require(dataTypes.exists(consentData.dataType), "Consents: data type does not exist");

        ConsentsLib.Consent memory consentInfo = ConsentsLib.Consent({
            allowed: consentData.allow,
            at: block.number
        });
        consents.update(userId, appName, uint(consentData.action), consentData.dataType, consentInfo);

        emit Consented(
            consentData.action,
            userId,
            apps.getId(appName),
            appName,
            consentData.dataType,
            consentData.allow
        );
    }

    /**
     * @dev upsert consent information
     * @param userId id of user
     * @param appName name of app registered in AppRegistry
     * @param consentData new consent data to update
     */
    function consent(
        bytes8 userId,
        string memory appName,
        ConsentData memory consentData
    ) public {
        require(users.exists(userId), "Consents: user does not exist");
        require(apps.exists(appName), "Consents: app does not exist");

        bool authConsentCreate = users.isAuthorized(userId, msg.sender, users.ACTION_CONSENT_CREATE());
        bool authConsentModify = users.isAuthorized(userId, msg.sender, users.ACTION_CONSENT_MODIFY());

        _checkAuthority(
            userId,
            appName,
            authConsentCreate,
            authConsentModify,
            consentData
        );
        _updateConsent(userId, appName, consentData);
    }

    // /**
    //  * @dev this method is wrapper method of consent(bytes8, string memory, ConsentData memory)
    //  * It finds userId from msg.sender and use as parameter of wrapped method
    //  * @param appName name of app registered in AppRegistry
    //  * @param consentData new consent data to update
    //  */
    // function consent(
    //     string memory appName,
    //     ConsentData memory consentData
    // ) public {
    //     consent(users.getId(msg.sender), appName, consentData);
    // }

    /**
     * @dev upsert many consent information at once
     * @param userId id of user
     * @param appName name of app registered in AppRegistry
     * @param consentData new consent data list to update
     */
    function consentMany(
        bytes8 userId,
        string memory appName,
        ConsentData[] memory consentData
    ) public {
        require(users.exists(userId), "Consents: user does not exist");
        require(apps.exists(appName), "Consents: app does not exist");
        require(consentData.length < CONSENT_DATA_MAX_LENGTH, "Consents: input length exceeds");

        bool authConsentCreate = users.isAuthorized(userId, msg.sender, users.ACTION_CONSENT_CREATE());
        bool authConsentModify = users.isAuthorized(userId, msg.sender, users.ACTION_CONSENT_MODIFY());

        for (uint index = 0; index < consentData.length; index++) {
            _checkAuthority(
                userId,
                appName,
                authConsentCreate,
                authConsentModify,
                consentData[index]
            );
            _updateConsent(userId, appName, consentData[index]);
        }
    }

    // /**
    //  * @dev this method is wrapper method of consentMany(bytes8, string memory, ConsentData[] memory)
    //  * It finds userId from msg.sender and use as parameter of wrapped method
    //  * @param appName name of app registered in AppRegistry
    //  * @param consentData new consent data list to update
    //  */
    // function consentMany(
    //     string memory appName,
    //     ConsentData[] memory consentData
    // ) public {
    //     consentMany(users.getId(msg.sender), appName, consentData);
    // }

    /**
     * @param userId id of user
     * @param appName name of app registered in AppRegistry
     * @param action action type in ActionTypes
     * @param dataType data type registered in DataTypeRegsitry
     * @return current allowance of given consent information
     */
    function isAllowed(
        bytes8 userId,
        string memory appName,
        ActionTypes action,
        string memory dataType
    ) public view returns (bool) {
        ConsentsLib.Consent memory consentInfo = consents.get(userId, appName, uint(action), dataType);
        return consentInfo.allowed;
    }

    /**
     * @param userId id of user
     * @param appName name of app registered in AppRegistry
     * @param action action type in ActionTypes
     * @param dataType data type registered in DataTypeRegsitry
     * @param blockNumber blockNumber
     * @return allowance of given consent information at specific block number
     */
    function isAllowedAt(
        bytes8 userId,
        string memory appName,
        ActionTypes action,
        string memory dataType,
        uint256 blockNumber
    ) public view returns (bool) {
        ConsentsLib.Consent memory consentInfo = consents.getPastConsent(userId, appName, uint(action), dataType, blockNumber);
        return consentInfo.allowed;
    }
}
