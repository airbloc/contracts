pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./ControllerRegistry.sol";
import "./rbac/RBAC.sol";
import "./utils/FeePayerUtils.sol";


contract Users is RBAC {
    using SafeMath for uint256;
    using ECDSA for bytes32;

    string constant public ROLE_DATA_CONTROLLER = "dataController";
    string constant public ROLE_TEMP_DATA_CONTROLLER = "temporaryDataController";
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

    modifier onlyFeePaidByDataController() {
        require(dataControllers.isController(FeePayerUtils.get()), "Users: caller is not fee paid by data controller");
        _;
    }

    function isResourceOwner(bytes8 userId, address account) internal view returns (bool) {
        return userId == addressToUser[account];
    }

    /**
     * @dev createInitialRole creates initial roles for user and grant actions to them
     * @param userId unique id of created user
     */
    function createInitialRole(bytes8 userId) internal {
        _createRole(userId, ROLE_DATA_CONTROLLER);
        _grantAction(userId, ROLE_DATA_CONTROLLER, ACTION_CONSENT_CREATE);
        _grantAction(userId, ROLE_DATA_CONTROLLER, ACTION_CONSENT_MODIFY);

        _createRole(userId, ROLE_TEMP_DATA_CONTROLLER);
        _grantAction(userId, ROLE_TEMP_DATA_CONTROLLER, ACTION_CONSENT_CREATE);
    }

    /**
     * @return unique id of created user
     */
    function create() external returns (bytes8) {
        require(
            addressToUser[msg.sender] == bytes8(0x0),
            "Users: you can make only one user per one Klaytn Account");

        // generate userId & insert information to User struct
        bytes8 userId = generateId(bytes32(0x0), msg.sender);
        users[userId].owner = msg.sender;
        users[userId].status = UserStatus.CREATED;
        addressToUser[msg.sender] = userId;

        // create initial role for given userId
        createInitialRole(userId);

        emit SignUp(msg.sender, userId);
        return userId;
    }

    /**
     * @dev IdentityHash can be used these situations - getter methods, unlocking user
     * @param identityHash hashed identity information of user
     * @return unique id of created temporary user
     */
    function createTemporary(bytes32 identityHash)
        public
        onlyFeePaidByDataController
        returns (bytes8)
    {
        require(
            identityHashToUser[identityHash] == bytes8(0x0),
            "Users: user already exists");

        // generate userId & insert information to User struct
        bytes8 userId = generateId(identityHash, msg.sender);
        users[userId].controller = msg.sender;
        users[userId].status = UserStatus.TEMPORARY;
        identityHashToUser[identityHash] = userId;

        // create initial role for given userId
        createInitialRole(userId);
        _bindRole(userId, msg.sender, ROLE_TEMP_DATA_CONTROLLER);

        emit TemporaryCreated(msg.sender, identityHash, userId);
        return userId;
    }

    /**
     * @dev unlocks means transfer ownership from data controller to origin account
     * @param identityPreimage previous hash value of registered identityHash
     * @param newOwner owner account of original user
     */
    function unlockTemporary(bytes32 identityPreimage, address newOwner)
        public
        onlyFeePaidByDataController
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
        user.status = UserStatus.CREATED;
        addressToUser[newOwner] = userId;

        // unbind temporary controller role
        _unbindRole(userId, msg.sender, ROLE_TEMP_DATA_CONTROLLER);

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

    /**
     * @dev change user's controller to newController
     * @param newController controller's address which user want to change
     */
    function setController(address newController) external {
        bytes8 userId = addressToUser[msg.sender];

        // the controller and the proxy cannot modify controller.
        // a controller can be set only through the user owner's direct transaction.
        require(dataControllers.isController(newController), "Users: given address is not a data controller");
        require(userId != bytes8(0), "Users: user does not exist");

        User storage user = users[userId];
        require(user.controller != newController, "Users: given address is already a controller of user");
        if (user.controller != address(0x0)) {
            _unbindRole(userId, user.controller, ROLE_DATA_CONTROLLER);
        }
        _bindRole(userId, newController, ROLE_DATA_CONTROLLER);
        user.controller = newController;
    }

    /**
     * @param uniqueData salt parameter for generating hash
     * @param creator creator of id
     * @return unique id of user
     */
    function generateId(bytes32 uniqueData, address creator) internal view returns (bytes8) {
        bytes memory seed = abi.encodePacked(creator, block.number, uniqueData);
        return bytes8(keccak256(seed));
    }

    /**
     * @param userId id of user
     * @return storage struct of user
     */
    function _get(bytes8 userId) internal view returns (User storage) {
        return users[userId];
    }

    /**
     * @dev Reverts when user does not exist
     * @param userId id of user
     * @return read-only(memory) struct of User correspond with given id
     */
    function get(bytes8 userId) public view returns (User memory) {
        require(exists(userId), "Users: user does not exist");
        return _get(userId);
    }

    /**
     * @dev Reverts when user does not exist
     * @param identityHash identityHash of user
     * @return memory struct of User correspond with given identityHash
     */
    function getByIdentityHash(bytes32 identityHash) public view returns (User memory) {
        return get(getIdByIdentityHash(identityHash));
    }

    /**
     * @dev Reverts when user does not exist & invalid userId
     * @param owner address of user's owner
     * @return 8-length byte id that matches with given address and its owner
     */
    function getId(address owner) public view returns (bytes8) {
        bytes8 userId = addressToUser[owner];
        require(userId != bytes8(0x0), "Users: unknown owner address");
        return userId;
    }

    /**
     * @dev Reverts when user does not exist & invalid identityHash
     * @param identityHash identityHash of user
     * @return 8-length byte id that matches with given identityHash
     */
    function getIdByIdentityHash(bytes32 identityHash) public view returns (bytes8) {
        bytes8 userId = identityHashToUser[identityHash];
        require(userId != bytes8(0x0), "Users: unknown identity hash");
        return userId;
    }

    /**
     * @dev Reverts when user does not exist
     * @param userId id of user
     * @return given user's status is temporary or not
     */
    function isTemporary(bytes8 userId) public view returns (bool) {
        return _get(userId).status == UserStatus.TEMPORARY;
    }

    /**
     * @dev Reverts when user does not exist
     * @param controller data controller's address of user
     * @param userId id of user
     * @return given user's controller is given controller or not
     */
    function isControllerOf(address controller, bytes8 userId) public view returns (bool) {
        return get(userId).controller == controller;
    }

    /**
     * @param userId id of user
     * @return existance of user correpond with given userId.
     */
    function exists(bytes8 userId) public view returns (bool) {
        return _get(userId).status != UserStatus.NONE;
    }
}
