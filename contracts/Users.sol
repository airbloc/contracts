pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./ControllerRegistry.sol";
import "./rbac/RBAC.sol";


contract Users is RBAC {
    using SafeMath for uint256;
    using ECDSA for bytes32;
    
    string constant public ROLE_DATA_CONTROLLER = "dataController";
    string constant public ACTION_CONSENT_CREATE = "consent:create";
    string constant public ACTION_CONSENT_MODIFY = "consent:modify";
    string constant public ACTION_USER_TRANSFER_OWNERSHIP = "user:transferOwnership";
    
    event SignUp(address indexed owner, bytes8 userId);
    event TemporaryCreated(address indexed proxy, bytes32 indexed identityHash, bytes8 userId);
    event Unlocked(bytes32 indexed identityHash, bytes8 indexed userId, address newOwner);

    enum UserStatus {
        NONE,
        TEMPORARY,
        CREATED
    }

    struct User {
        address owner;
        address controller;
        UserStatus status;
    }

    mapping (bytes8 => User) public users;
    mapping (address => bytes8) private addressToUser;
    
    mapping (bytes32 => bytes8) public identityHashToUser;

    uint256 public numberOfUsers;

    ControllerRegistry private dataControllers;

    constructor(ControllerRegistry controllerReg) public {
        dataControllers = controllerReg;
    }

    modifier onlyDataController() {
        require(dataControllers.isController(msg.sender), "Users: caller is not a data controller");
        _;
    }
    
    function isResourceOwner(bytes8 userId, address account) internal view returns (bool) {
        return userId == addressToUser[account] || address(this) == account;
    }
    
    function createInitialRole(bytes8 userId) internal {
        createRole(userId, ROLE_DATA_CONTROLLER);
        grantAction(userId, ROLE_DATA_CONTROLLER, ACTION_CONSENT_CREATE);
        // TODO: Add more actions for role "dataController"
        // TODO: Add more roles for resource "userId"
    }

    function create() external returns (bytes8) {
        require(
            addressToUser[msg.sender] == bytes8(0),
            "Users: you can make only one user per one Klaytn Account");

        // generate userId & insert information to User struct
        bytes8 userId = generateId(bytes32(0), msg.sender);
        users[userId].owner = msg.sender;
        users[userId].status = UserStatus.CREATED;
        
        // create initial role for given userId
        createInitialRole(userId);

        addressToUser[msg.sender] = userId;
        emit SignUp(msg.sender, userId);
        return userId;
    }

    function createTemporary(bytes32 identityHash)
        public
        onlyDataController
        returns (bytes8)
    {
        require(
            identityHashToUser[identityHash] == bytes8(0), 
            "Users: user already exists");

        // generate userId & insert information to User struct
        bytes8 userId = generateId(identityHash, msg.sender);
        users[userId].controller = msg.sender;
        users[userId].status = UserStatus.TEMPORARY;
        
        // create initial role for given userId
        createInitialRole(userId);
        bindRole(userId, msg.sender, ROLE_DATA_CONTROLLER);

        identityHashToUser[identityHash] = userId;
        emit TemporaryCreated(msg.sender, identityHash, userId);
        return userId;
    }

    function unlockTemporary(bytes32 identityPreimage, address newOwner)
        public
        onlyDataController
    {
        // check that keccak256(identityPreimage) == user.identityHash
        bytes32 identityHash = keccak256(abi.encodePacked(identityPreimage));
        bytes8 userId = identityHashToUser[identityHash];

        require(isTemporary(userId), "Users: it's not temporary user");
        User storage user = users[userId];

        require(
            msg.sender == user.controller,
            "Users: user must be unlocked through the designated data controller");
        require(
            addressToUser[newOwner] == bytes8(0),
            "Users: you can make only one user per one Klaytn Account");
        user.owner = newOwner;
        addressToUser[newOwner] = userId;

        bytes memory message = abi.encodePacked(identityPreimage, newOwner);
        user.status = UserStatus.CREATED;

        emit Unlocked(identityHash, userId, newOwner);
    }
    
//    function addController(address controller) external {
//        bytes8 userId = addressToUser[msg.sender];
//
//        // the controller and the proxy cannot modify controller.
//        // a controller can be set only through the user owner's direct transaction.
//        require(dataControllers.exists(controller), "Users: given address is not a data controller");
//        require(userId != bytes8(0x0), "Users: user does not exist");
//        require(!isAuthorized(userId, controller, ROLE_DATA_CONTROLLER), "Users: given address is already authorized");
//        
//        bindRole(userId, controller, ROLE_DATA_CONTROLLER);
//    }
//
//    function removeController(address controller) external {
//        bytes8 userId = addressToUser[msg.sender];
//
//        // the controller and the proxy cannot modify controller.
//        // a controller can be set only through the user owner's direct transaction.
//        require(dataControllers.exists(controller), "Users: given address is not a data controller");
//        require(userId != bytes8(0x0), "Users: user does not exist");
//        require(isAuthorized(userId, controller, ROLE_DATA_CONTROLLER), "Users: given address is already unauthorized");
//        
//        unbindRole(userId, controller, ROLE_DATA_CONTROLLER);
//    }
    
    function setController(address newController) external {
        bytes8 userId = addressToUser[msg.sender];
        
        // the controller and the proxy cannot modify controller.
        // a controller can be set only through the user owner's direct transaction.
        require(dataControllers.isController(newController), "Users: given address is not a data controller");
        require(userId != bytes8(0), "Users: user does not exist");
        
        User storage user = users[userId];
        if (user.controller != address(0x0)) {
            unbindRole(userId, user.controller, ROLE_DATA_CONTROLLER);
        }
        bindRole(userId, newController, ROLE_DATA_CONTROLLER);
        user.controller = newController;
    }

    function getUser(bytes8 userId) public view returns (User memory) {
        require(exists(userId), "Users: user does not exist");
        return users[userId];
}

    function getUserByIdentityHash(bytes32 identityHash) public view returns (User memory) {
        return getUser(identityHashToUser[identityHash]);
    }

    function getUserId(address sender) public view returns (bytes8) {
        bytes8 userId = addressToUser[sender];
        require(users[userId].status != UserStatus.NONE, "Users: unknown address");
        return userId;
    }

    function getUserIdByIdentityHash(bytes32 identityHash) public view returns (bytes8) {
        return identityHashToUser[identityHash];
    }

    function isTemporary(bytes8 userId) public view returns (bool) {
        return users[userId].status == UserStatus.TEMPORARY;
    }

    function isControllerOf(address sender, bytes8 userId) public view returns (bool) {
        return isAuthorized(userId, sender, ROLE_DATA_CONTROLLER);
    }

    function generateId(bytes32 uniqueData, address creator) internal view returns (bytes8) {
        bytes memory seed = abi.encodePacked(creator, block.number, uniqueData);
        return bytes8(keccak256(seed));
    }

    function exists(bytes8 userId) public view returns (bool) {
        return users[userId].status != UserStatus.NONE;
    }
}
