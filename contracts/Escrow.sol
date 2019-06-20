pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./Exchange.sol";
import "./ExchangeLib.sol";

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Simple escrow contract for exchange
 * This contract going to be called by ExchangeLib.sol
 */
contract Escrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    Exchange private ex;

    constructor(Exchange exchangeContract) public {
        ex = exchangeContract;
    }

    function exchange(
        string memory from,
        string memory to,
        IERC20 token,
        uint256 amount,
        bytes20[] memory dataIds
    ) public {
        bytes4 escrowSign = bytes4(keccak256("transact(address,uin256,bytes8)"));
        bytes memory escrowArgs = abi.encodePacked(token, amount);

        bytes8 offerId = ex.prepare(from, to, address(this), escrowSign, escrowArgs, dataIds);

        // validate
        ExchangeLib.Offer memory offer = ex.getOffer(offerId);
        require(keccak256(abi.encodePacked(offer.from)) == keccak256(abi.encodePacked(from)), "invalid offer");
        require(keccak256(abi.encodePacked(offer.to)) == keccak256(abi.encodePacked(to)), "invalid offer");
        require(offer.escrow.addr == address(this), "invalid offer");

        (address offerFrom,) = ex.getOfferMembers(offerId);
        require(offerFrom == msg.sender, "invalid offer");
    }

    function transact(
        IERC20 token,
        uint256 amount,
        bytes8 offerId
    ) public nonReentrant {
        ExchangeLib.Offer memory offer = ex.getOffer(offerId);
        (address from, address to) = ex.getOfferMembers(offerId);

        // check authority
        require(msg.sender == address(ex), "should have authority");

        // check contract address
        require(offer.escrow.addr == address(this), "invalid contract information");

        // check allowance/balance
        require(amount <= token.allowance(from, address(this)), "low allowance");
        require(token.allowance(from, address(this)) <= token.balanceOf(from), "low balance");

        token.safeTransferFrom(from, to, amount);
    }
}
