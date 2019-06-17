pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

/**
 * @author Airbloc Foundation 2019
 * @title Consents library for consents.sol
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
     * ConsentBase contains all informations about user's consent.
     */
    struct ConsentBase {
        bytes8 owner;
        string app;
        string dataType;
        Consent collection;
        Consent exchange;
    }

    /**
     * InputPackage contains input data related in consent methods
     */
    struct InputPackage {
        bytes8 userId;
        string appName;
        string dataType;
    }

    /**
     * Consents struct is implementation of consent data structure
     * UserId -> AppName -> DataTypeName -> ConsentBase
     */
    struct Consents {
        mapping(bytes8 => mapping(string => mapping(string => ConsentBase))) consents;
    }

    /**
     * @dev register new consent information
     * @param input package of needed input
     */
    function newConsent(
        Consents storage self,
        InputPackage memory input
    ) public returns (ConsentBase memory){
        ConsentBase storage base = _get(self, input);

        base.owner = input.userId;
        base.app = input.appName;
        base.dataType = input.dataType;

        return base;
    }

    /**
     * @dev Reverts if the given user identity or data type does not exists.
     * Use this in non-payable or payable method.
     * @param input package of needed input
     * @return ConsentBase object
     */
    function get(
        Consents storage self,
        InputPackage memory input
    ) public view returns (ConsentBase memory) {
        require(exists(self, input), "app does not exists");
        return _get(self, input);
    }

    /**
     * @param input package of needed input
     * @return ConsentBase storage object even if it does not exists.
     */
    function _get(
        Consents storage self,
        InputPackage memory input
    ) internal view returns (ConsentBase storage) {
        return self.consents[input.userId][input.appName][input.dataType];
    }

    /**
     * @param input package of needed input
     * @return false if consents does not exists
     */
    function exists(
        Consents storage self,
        InputPackage memory input
    ) public view returns (bool) {
        return _get(self, input).owner != bytes8(0x0);
    }

    /**
     * @dev update consent base of consents struct
     * IMPORTANT : Before calling this method, you must check the authority of caller.
     * @param base ConsentBase object which you want update
     * @param input package of needed input
     */
    function update(
        Consents storage self,
        ConsentBase memory base,
        InputPackage memory input
    ) public {
        self.consents[input.userId][input.appName][input.dataType] = base;
    }

    /**
     * @dev remove consent about app's data type
     * IMPORTANT : Before calling this method, you must check the authority of caller.
     * @param userId user's id registered in accounts contract
     * @param appName app's name registered in app registry
     * @param dataType name of data type registered in data type registry
     */
    function removeConsent(
        Consents storage self,
        bytes8 userId,
        string memory appName,
        string memory dataType
    ) public {
        delete self.consents[userId][appName][dataType];
    }
}