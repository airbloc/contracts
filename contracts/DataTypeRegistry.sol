pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract DataTypeRegistry is Ownable {

    event Registration(string name);
    event Unregistration(string name);

    struct DataType {
        string name;
        address owner;
        bytes32 schemaHash;
    }

    mapping(bytes32 => DataType) dataTypes;

    /**
     * @param name Unique name of the data type. (e.g. "gps-data")
     * @param schemaHash SHA256 hash of the JSON schema of the data type.
     */
    function register(string memory name, bytes32 schemaHash) public {
        require(!exists(name), "data type name already exists");

        DataType storage dataType = _get(name);
        dataType.name = name;
        dataType.owner = msg.sender;
        dataType.schemaHash = schemaHash;

        emit Registration(name);
    }

    /**
     * @dev Returns an application object.
     * Reverts if the given name does not exist.
     */
    function get(string memory name) public view returns (DataType memory) {
        require(exists(name), "data type does not exist");
        return _get(name);
    }

    /**
     * @return An storage-reference of DataType object even if it does not exist.
     */
    function _get(string memory name) internal view returns (DataType storage) {
        bytes32 hashOfName = keccak256(abi.encodePacked(name));
        return dataTypes[hashOfName];
    }

    /**
     * @return true if given app name exists.
     */
    function exists(string memory name) public view returns (bool) {
        return _get(name).owner != address(0x0);
    }

    /**
     * @return true if the caller is an owner of given app.
     */
    function isOwner(string memory name, address owner) public view returns (bool) {
        return get(name).owner == owner;
    }

    function unregister(string memory name) public {
        require(isOwner(name, msg.sender), "unauthorized");

        bytes32 hashedName = keccak256(abi.encodePacked(name));
        delete dataTypes[hashedName];

        emit Unregistration(name);
    }
}
