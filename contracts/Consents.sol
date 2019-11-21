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

    modifier onlyDataController() {
        require(dataControllers.isController(msg.sender), "Consents: caller is not a data controller");
        _;
    }

    struct ConsentData {
        ActionTypes action;
        string dataType;
        bool allow;
    }

    function consent(
        bytes8 userId,
        string memory appName,
        ConsentData memory consentData
    ) public {
        require(apps.exists(appName), "Consents: app does not exist");
        require(
            users.isAuthorized(userId, msg.sender, users.ACTION_CONSENT_CREATE()),
            "Consents: sender must be authorized before create consent");

        bool consentExists = consents.exists(
            userId,
            appName,
            uint(consentData.action),
            consentData.dataType
        );
        if (consentExists) {
            require(
                users.isAuthorized(userId, msg.sender, users.ACTION_CONSENT_MODIFY()),
                "Consents: sender must be authorized before modify consent");
        }
        
        _updateConsent(userId, appName, consentData);
    }

    function consentMany(
        bytes8 userId,
        string memory appName,
        ConsentData[] memory consentData
    ) public {
        bool authConsentCreate = users.isAuthorized(userId, msg.sender, users.ACTION_CONSENT_CREATE());
        bool authConsentModify = users.isAuthorized(userId, msg.sender, users.ACTION_CONSENT_MODIFY());
        
        require(apps.exists(appName), "Consents: app does not exist");
        require(consentData.length < 64, "Consents: input length exceeds");
        require(authConsentCreate, "Consents: sender must be authorized before create consent");

        for (uint index = 0; index < consentData.length; index++) {
            if (!authConsentModify) {
                bool consentExists = consents.exists(
                    userId,
                    appName,
                    uint(consentData[index].action),
                    consentData[index].dataType
                );
                require(!consentExists, "Consents: sender must be authorized before modify consent");
            }

            _updateConsent(userId, appName, consentData[index]);
        }
    }

    function _updateConsent(
        bytes8 userId,
        string memory appName,
        ConsentData memory consentData
    ) internal {
        require(users.exists(userId), "Consents: user does not exist");
        require(apps.exists(appName), "Consents: app does not exist");
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

    function isAllowed(
        bytes8 userId,
        string memory appName,
        ActionTypes action,
        string memory dataType
    ) public view returns (bool) {
        ConsentsLib.Consent memory consentInfo = consents.get(userId, appName, uint(action), dataType);
        return consentInfo.allowed;
    }

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
