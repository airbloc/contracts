pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

library ConsentsLib {
    struct ConsentBase {
        mapping(string => ConsentBase) dataTypeConsents;
    }

    struct DataTypeConsent {
        bytes8 owner;
        bytes32 app;
        string dataType;
        Consent collection;
        Consent exchange;
    }

    struct Consent {
        bool allowed;
        uint256 at;
    }

    struct Consents {
        mapping(bytes32 => ConsentBase) appConsents;
        mapping(bytes8 => ConsentBase) userConsents;
    }

    function get(
        Consents storage self,
        bytes8 userId
    ) public returns (ConsentBase storage) {
        
    }

    function get(
        Consents storage self,
        string memory appName
    ) public returns (ConsentBase storage) {

    }
}