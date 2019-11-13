pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../utils/StringUtils.sol";

/**
 * @dev RBAC is an abstract contract for implementing 
 * role-based access control for resources in Airbloc.
 */
contract RBAC {
    using StringUtils for string;

    event RoleCreation(bytes8 indexed resourceId, string roleName);
    event RoleRemoval(bytes8 indexed resourceId, string roleName);
    event RoleBound(bytes8 indexed resourceId, address indexed subject, string roleName);
    event RoleUnbound(bytes8 indexed resourceId, address indexed subject, string roleName);

    struct Role {
        string name;
        mapping (string => bool) actions;
    }
    mapping (bytes8 => Role[]) roles;

    // Resource ID => Account (Role Subject) => Bound Role Names
    mapping (bytes8 => mapping (address => string[])) roleBinding;

    /**
     * @dev You should override this method to allow the resource owner to perform any actions.
     */
    function isResourceOwner(bytes8 resourceId, address account) internal view returns (bool);

    /**
     * @return true if given account is able to perform the given action to the resource.
     */
    function isAuthorized(bytes8 resourceId, address account, string memory action) public view returns (bool) {
        if (isResourceOwner(resourceId, account)) {
            // unlimited poweeeeer!!!
            return true;
        }

        string[] storage roleNames = roleBinding[resourceId][account];
        for (uint i = 0; i < roleNames.length; i++) {
            // the reason why we don't using _getRole here:
            // since roleBinding is one-directional mapping to roles, we cannot clear
            // role names in roleBinding on deletion of the role.
            // since it can cause _getRole to always fail, we search the role manually.
            for (uint j = 0; j < roles[resourceId].length; j++) {
                Role storage role = roles[resourceId][j];
                if (role.name.equals(roleNames[i]) && role.actions[action]) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * @dev Creates an empty role to the resource with no actions.
     */
    function createRole(bytes8 resourceId, string memory roleName) public {
        require(isAuthorized(resourceId, msg.sender, "role:manage"), "RBAC: unauthorized");
        require(bytes(roleName).length > 0, "RBAC: invalid role name");

        Role memory role = Role({ name: roleName });

        bool inserted = false;
        for (uint i = 0; i < roles[resourceId].length; i++) {
            // insert to empty slot if there's any
            if (roles[resourceId][i].name.isEmpty()) {
                roles[resourceId][i] = role;
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            // no empty slot; push it
            roles[resourceId].push(role);
        }
        emit RoleCreation(resourceId, roleName);
    }

    /**
     * @dev Grant given action to the role of the resource.
     */
    function grantAction(bytes8 resourceId, string memory roleName, string memory action) public {
        require(isAuthorized(resourceId, msg.sender, "role:manage"), "RBAC: unauthorized");

        Role storage role = _getRole(resourceId, roleName);
        role.actions[action] = true;
    }

    /**
     * @dev Revoke given action to the role of the resource.
     */
    function revokeAction(bytes8 resourceId, string memory roleName, string memory action) public {
        require(isAuthorized(resourceId, msg.sender, "role:manage"), "RBAC: unauthorized");

        Role storage role = _getRole(resourceId, roleName);
        delete(role.actions[action]);
    }

    function _getRole(bytes8 resourceId, string memory roleName) internal view returns (Role storage) {
        for (uint i = 0; i < roles[resourceId].length; i++) {
            Role storage role = roles[resourceId][i];
            if (role.name.equals(roleName)) {
                return role;
            }
        }
        revert("RBAC: role not found");
    }

    /**
     * @dev Bind a role to given account.
     */
    function bindRole(bytes8 resourceId, address subject, string memory roleName) public {
        require(isAuthorized(resourceId, msg.sender, "role:manage"), "RBAC: unauthorized");
        Role storage role = _getRole(resourceId, roleName);

        string[] storage boundRoleNames = roleBinding[resourceId][subject];

        bool inserted = false;
        for (uint i = 0; i < boundRoleNames.length; i++) {
            // insert to empty slot if there's any
            if (boundRoleNames[i].isEmpty()) {
                boundRoleNames[i] = role.name;
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            // no empty slot; push it
            boundRoleNames.push(role.name);
        }
        emit RoleBound(resourceId, subject, roleName);
    }

    /**
     * @dev Unbind a role to given account.
     */
    function unbindRole(bytes8 resourceId, address subject, string memory roleName) public {
        require(isAuthorized(resourceId, msg.sender, "role:manage"), "RBAC: unauthorized");
        Role storage role = _getRole(resourceId, roleName);

        string[] storage boundRoleNames = roleBinding[resourceId][subject];

        bool deleted = false;
        for (uint i = 0; i < boundRoleNames.length; i++) {
            // insert to empty slot if there's any
            if (boundRoleNames[i].equals(role.name)) {
                delete(boundRoleNames[i]);
                deleted = true;
                break;
            }
        }
        if (!deleted) {
            revert("RBAC: role was not bound");
        }
        emit RoleUnbound(resourceId, subject, roleName);
    }

    /**
     * @dev Removes the role in the given resource.
     * TODO: It does not clear role bindings. It can cause various side effects!
     */
    function removeRole(bytes8 resourceId, string memory roleName) public {
        require(isAuthorized(resourceId, msg.sender, "role:manage"), "RBAC: unauthorized");

        for (uint i = 0; i < roles[resourceId].length; i++) {
            Role storage role = roles[resourceId][i];
            if (role.name.equals(roleName)) {
                delete(roles[resourceId][i]);
                break;
            }
        }
        emit RoleRemoval(resourceId, roleName);
    }
}
