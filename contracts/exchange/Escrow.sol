pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../Exchange.sol";
import "../ExchangeLib.sol";
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

    Exchange private exchange;

    constructor(Exchange exchangeContract) public {
        exchange = exchangeContract;
    }

    function transact(
        IERC20 token,
        uint256 amount,
        bytes8 offerId
    ) public nonReentrant {
        ExchangeLib.Offer memory offer = exchange.getOffer(offerId);
        (address from, address to) = exchange.getOfferMembers(offerId);

        // check authority
        require(msg.sender == address(exchange), "should have authority");

        // check contract address
        require(offer.escrow.addr == address(this), "invalid contract information");

        // check allowance/balance
        require(amount <= token.allowance(from, address(this)), "low allowance");
        require(token.allowance(from, address(this)) <= token.balanceOf(from), "low balance");

        token.safeTransferFrom(from, to, amount);
    }
}
