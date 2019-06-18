pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

/**
 * @title ConsentsLib is a library which describes consent data structure.
 * Defined structs can work only CRUD actions.
 */
library ConsentsLib {

    /**
     * Consent struct is basic consent rule element
     */
    struct Consent {
        bool allowed;
        uint256 at;
    }

    /**
     * Consents struct is implementation of consent data structure
     * UserId -> AppName -> Action -> DataTypeName
     */
    struct Consents {
        mapping(bytes8 => mapping(string => mapping(uint => mapping(string => Consent)))) consents;
    }

    /**
     * @dev Reverts if the given user identity or data type does not exists.
     * Use this in non-payable or payable method.
     * @param userId user's id registered in accounts contract
     * @param appName app's name registered in app registry
     * @param dataType name of data type registered in data type registry
     * @return Consent object
     */
    function get(
        Consents storage self,
        bytes8 userId,
        string memory appName,
        uint actionType,
        string memory dataType
    ) internal view returns (Consent memory) {
        require(exists(self, userId, appName, actionType, dataType), "consent does not exists");
        return _get(self, userId, appName, actionType, dataType);
    }

    /**
     * @param userId user's id registered in accounts contract
     * @param appName app's name registered in app registry
     * @param dataType name of data type registered in data type registry
     * @return Consent object even if it does not exists.
     */
    function _get(
        Consents storage self,
        bytes8 userId,
        string memory appName,
        uint actionType,
        string memory dataType
    ) internal view returns (Consent storage) {
        return self.consents[userId][appName][actionType][dataType];
    }

    /**
     * @param userId user's id registered in accounts contract
     * @param appName app's name registered in app registry
     * @param dataType name of data type registered in data type registry
     * @return false if the consent does not exist
     */
    function exists(
        Consents storage self,
        bytes8 userId,
        string memory appName,
        uint actionType,
        string memory dataType
    ) internal view returns (bool) {
        return _get(self, userId, appName, actionType, dataType).at != 0;
    }

    /**
     * @dev update consent base of consents struct
     * IMPORTANT : Before calling this method, you must check the authority of caller.
     * @param userId user's id registered in accounts contract
     * @param appName app's name registered in app registry
     * @param actionType type of data actions (e.g. Collection, )
     * @param dataType name of data type registered in data type registry
     */
    function update(
        Consents storage self,
        bytes8 userId,
        string memory appName,
        uint actionType,
        string memory dataType,
        Consent memory consent
    ) internal {
        self.consents[userId][appName][actionType][dataType] = consent;
    }

    /**
     * @dev remove consent about app's data type
     * IMPORTANT : Before calling this method, you must check the authority of caller.
     * @param userId user's id registered in accounts contract
     * @param appName app's name registered in app registry
     * @param dataType name of data type registered in data type registry
     */
    function remove(
        Consents storage self,
        bytes8 userId,
        string memory appName,
        uint actionType,
        string memory dataType
    ) internal {
        delete self.consents[userId][appName][actionType][dataType];
    }
}
