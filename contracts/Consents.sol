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
        uint8 allowed;
    }

    function getAllowed(ConsentData memory consentData) internal pure returns (bool) {
        return consentData.allowed > 0;
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
            consentData
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
                consentData[index]
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
            consentData
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
                consentData[index]
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
            getAllowed(consentData)
        );
        require(
            userId == accounts.getAccountIdFromSignature(keccak256(message), passwordSignature),
            "Consents: password mismatch"
        );

        _updateConsent(
            userId,
            appName,
            consentData
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
                getAllowed(consentData[index])
            );
            require(
                userId == accounts.getAccountIdFromSignature(keccak256(message), passwordSignature),
                "Consents: password mismatch"
            );

            _updateConsent(
                userId,
                appName,
                consentData[index]
            );
        }
    }

    function _updateConsent(
        bytes8 userId,
        string memory appName,
        ConsentData memory consentData
    ) internal {
        require(accounts.exists(userId), "Consents: user does not exist");
        require(apps.exists(appName), "Consents: app does not exist");
        require(dataTypes.exists(consentData.dataType), "Consents: data type does not exist");

        bool allowed = getAllowed(consentData);

        ConsentsLib.Consent memory consentInfo = ConsentsLib.Consent({
            allowed: allowed,
            at: block.number
        });
        consents.update(userId, appName, uint(consentData.action), consentData.dataType, consentInfo);
        emit Consented(consentData.action, userId, apps.get(appName).addr, appName, consentData.dataType, allowed);
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
