pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./Accounts.sol";
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
        address indexed appAddr,
        string appName,
        string dataType,
        bool allowed
    );

    // consents
    ConsentsLib.Consents private consents;

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
        require(dataControllers.exists(msg.sender), "Consents: caller is not a data controller");
        _;
    }

    struct ConsentData {
        ActionTypes action;
        string dataType;
        bool allowed;
    }

    function consent(
        string memory appName,
        ConsentData memory consentData
    ) public {
        require(apps.exists(appName), "Consents: app does not exist");
        bytes8 userId = accounts.getAccountId(msg.sender);
        _updateConsent(
            userId,
            appName,
            consentData.action,
            consentData.dataType,
            consentData.allowed
        );
    }

    function consentMany(
        string memory appName,
        ConsentData[] memory consentData
    ) public {
        require(apps.exists(appName), "Consents: app does not exist");
        require(consentData.length < 64, "Consents: input length exceeds");

        bytes8 userId = accounts.getAccountId(msg.sender);
        for (uint index = 0; index < consentData.length; index++) {
            _updateConsent(
                userId,
                appName,
                consentData[index].action,
                consentData[index].dataType,
                consentData[index].allowed
            );
        }
    }

    function consentByController(
        bytes8 userId,
        string memory appName,
        ConsentData memory consentData
    ) public onlyDataController {
        require(apps.exists(appName), "Consents: app does not exist");
        require(accounts.isControllerOf(msg.sender, userId), "Consents: sender must be delegate of this user");

        bool consentExists = consents.exists(
            userId,
            appName,
            uint(consentData.action),
            consentData.dataType
        );
        if (consentExists) {
            revert("Consents: controllers can't modify users' consent without password");
        }

        _updateConsent(
            userId,
            appName,
            consentData.action,
            consentData.dataType,
            consentData.allowed
        );
    }

    function consentManyByController(
        bytes8 userId,
        string memory appName,
        ConsentData[] memory consentData
    ) public onlyDataController{
        require(apps.exists(appName), "Consents: app does not exist");
        require(consentData.length < 64, "Consents: input length exceeds");
        require(accounts.isControllerOf(msg.sender, userId), "Consents: sender must be delegate of this user");

        for (uint index = 0; index < consentData.length; index++) {
            bool consentExists = consents.exists(
                userId,
                appName,
                uint(consentData[index].action),
                consentData[index].dataType
            );
            if (consentExists) {
                revert("Consents: controllers can't modify users' consent without password");
            }

            _updateConsent(
                userId,
                appName,
                consentData[index].action,
                consentData[index].dataType,
                consentData[index].allowed
            );
        }
    }

    function modifyConsentByController(
        bytes8 userId,
        string memory appName,
        ConsentData memory consentData,
        bytes memory passwordSignature
    ) public onlyDataController {
        require(apps.exists(appName), "Consents: app does not exist");
        require(accounts.isControllerOf(msg.sender, userId), "Consents: sender must be delegate of this user");

        // changing an already given consent requires a password key
        bytes memory message = abi.encodePacked(
            userId,
            appName,
            uint8(consentData.action),
            consentData.dataType,
            consentData.allowed
        );
        require(
            userId == accounts.getAccountIdFromSignature(keccak256(message), passwordSignature),
            "Consents: password mismatch"
        );

        _updateConsent(
            userId,
            appName,
            consentData.action,
            consentData.dataType,
            consentData.allowed
        );
    }

    function modifyConsentManyByController(
        bytes8 userId,
        string memory appName,
        ConsentData[] memory consentData,
        bytes memory passwordSignature
    ) public onlyDataController {
        require(apps.exists(appName), "Consents: app does not exist");
        require(consentData.length < 64, "Consents: input length exceeds");
        require(accounts.isControllerOf(msg.sender, userId), "Consents: sender must be delegate of this user");

        for (uint index = 0; index < consentData.length; index++) {
            // changing an already given consent requires a password key
            bytes memory message = abi.encodePacked(
                userId,
                appName,
                uint8(consentData[index].action),
                consentData[index].dataType,
                consentData[index].allowed
            );
            require(
                userId == accounts.getAccountIdFromSignature(keccak256(message), passwordSignature),
                "Consents: password mismatch"
            );

            _updateConsent(
                userId,
                appName,
                consentData[index].action,
                consentData[index].dataType,
                consentData[index].allowed
            );
        }
    }

    function _updateConsent(
        bytes8 userId,
        string memory appName,
        ActionTypes action,
        string memory dataType,
        bool allowed
    ) internal {
        require(accounts.exists(userId), "Consents: user does not exist");
        require(apps.exists(appName), "Consents: app does not exist");
        require(dataTypes.exists(dataType), "Consents: data type does not exist");

        ConsentsLib.Consent memory consentInfo = ConsentsLib.Consent({
            allowed: allowed,
            at: block.number
        });
        consents.update(userId, appName, uint(action), dataType, consentInfo);
        emit Consented(action, userId, apps.get(appName).addr, appName, dataType, allowed);
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
