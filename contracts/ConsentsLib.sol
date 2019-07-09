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
     * Change history of users' consent over time.
     * Because of MDP Data Registration Challenge in DataRegistry,
     * we need make the changelog accessible in Solidity runtime.
     */
    struct ConsentHistory {
        mapping (uint => Consent) records;
        uint numRecords;
    }

    /**
     * Consents struct is implementation of consent data structure
     * UserId -> AppName -> Action -> DataTypeName
     */
    struct Consents {
        mapping(bytes8 => mapping(string => mapping(uint => mapping(string => ConsentHistory)))) consents;
    }

    /**
     * @dev Reverts if the given user identity or data type does not exists.
     * Use this in non-payable or payable method.
     *
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
     * @dev Returns a consent record at a moment.
     * Reverts if any consent record exists in given user and data,
     *
     * but does not revert if consent record is not available at that moment. (e.g. too past)
     * instead, it will return most oldest consent record.
     *
     * @param userId user's id registered in accounts contract
     * @param appName app's name registered in app registry
     * @param dataType name of data type registered in data type registry
     * @return Consent object
     */
    function getPastConsent(
        Consents storage self,
        bytes8 userId,
        string memory appName,
        uint actionType,
        string memory dataType,
        uint256 at
    ) internal view returns (Consent memory) {
        require(exists(self, userId, appName, actionType, dataType), "consent does not exists");

        // find past consent record
        ConsentsLib.ConsentHistory storage history = self.consents[userId][appName][actionType][dataType];
        for (uint i = history.numRecords - 1; i >= 0; i--) {
            if (history.records[i].at <= at) {
                return history.records[i];
            }
        }
        // not found in the criteria; return most oldest record
        return history.records[0];
    }

    /**
     * @return User's consent (most latest record) even if it does not exists.
     */
    function _get(
        Consents storage self,
        bytes8 userId,
        string memory appName,
        uint actionType,
        string memory dataType
    ) internal view returns (Consent storage) {
        ConsentsLib.ConsentHistory storage history = self.consents[userId][appName][actionType][dataType];
        return history.records[history.numRecords - 1];
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
     * @dev Updates users' consent. Actually, it appends a consent record onto the history.
     * IMPORTANT: Before calling this method, you must check the authority of caller.

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
        ConsentsLib.ConsentHistory storage history = self.consents[userId][appName][actionType][dataType];
        history.records[history.numRecords++] = consent;
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
