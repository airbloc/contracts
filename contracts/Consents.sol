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
        bytes32 indexed app,
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

    function consent(
        ActionTypes action,
        string memory appName,
        string memory dataType,
        bool allowed
    ) public {
        require(apps.exists(appName), "Consents: app does not exist");
        bytes8 userId = accounts.getAccountId(msg.sender);
        _updateConsent(action, userId, appName, dataType, allowed);
    }

    function consentByController(
        ActionTypes action,
        bytes8 userId,
        string memory appName,
        string memory dataType,
        bool allowed
    ) public onlyDataController {
        require(apps.exists(appName), "Consents: app does not exist");
        require(accounts.isControllerOf(msg.sender, userId), "Consents: sender must be delegate of this user");

        if (consents.exists(userId, appName, uint(action), dataType)) {
            revert("Consents: controllers can't modify users' consent without password");
        }
        _updateConsent(action, userId, appName, dataType, allowed);
    }

    function modifyConsentByController(
        ActionTypes action,
        bytes8 userId,
        string memory appName,
        string memory dataType,
        bool allowed,
        bytes memory passwordSignature
    ) public onlyDataController {
        require(apps.exists(appName), "Consents: app does not exist");
        require(accounts.isControllerOf(msg.sender, userId), "Consents: sender must be delegate of this user");

        // changing an already given consent requires a password key
        bytes memory message = abi.encodePacked(uint8(action), userId, appName, dataType, allowed);
        require(
            userId == accounts.getAccountIdFromSignature(keccak256(message), passwordSignature),
            "Consents: password mismatch"
        );
        _updateConsent(action, userId, appName, dataType, allowed);
    }

    function _updateConsent(
        ActionTypes action,
        bytes8 userId,
        string memory appName,
        string memory dataType,
        bool allowed
    ) internal {
        require(accounts.exists(userId), "Consents: user does not exist");
        require(apps.exists(appName), "Consents: app does not exist");
        require(dataTypes.exists(dataType), "Consents: data type does not exist");

        ConsentsLib.Consent memory consent = ConsentsLib.Consent({
            allowed: allowed,
            at: block.number
        });
        consents.update(userId, appName, uint(action), dataType, consent);
        emit Consented(action, userId, apps.get(appName).hashedName, appName, dataType, allowed);
    }

    function isAllowed(
        ActionTypes action,
        bytes8 userId,
        string memory appName,
        string memory dataType
    ) public view returns (bool) {
        ConsentsLib.Consent memory consent = consents.get(userId, appName, uint(action), dataType);
        return consent.allowed;
    }

    function isAllowedAt(
        ActionTypes action,
        bytes8 userId,
        string memory appName,
        string memory dataType,
        uint256 blockNumber
    ) public view returns (bool) {
        ConsentsLib.Consent memory consent = consents.getPastConsent(userId, appName, uint(action), dataType, blockNumber);
        return consent.allowed;
    }
}
