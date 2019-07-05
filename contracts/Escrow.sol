pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./Exchange.sol";
import "./ExchangeLib.sol";
import "./ExchangeContract.sol";

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Simple escrow contract for exchange
 * This contract going to be called by ExchangeLib.sol
 */
contract Escrow is ReentrancyGuard, ExchangeContract {
    using SafeERC20 for IERC20;

    Exchange private ex;

    constructor(Exchange exchangeContract) public {
        ex = exchangeContract;
    }

    // convert
    function convert(
        bytes4 sign,
        bytes memory args,
        bytes8 offerId
    ) public pure returns (bytes memory) {
        if (sign == TRANSACT_SELECTOR) {
            (
                address token,
                uint256 amount
            ) = abi.decode(args, (address, uint256));

            return abi.encodeWithSelector(sign, token, amount, offerId);
        }
    }

    // transact
    string public constant TRANSACT_SIGNATURE = "transact(address,uint256,bytes8)";
    bytes4 public constant TRANSACT_SELECTOR = 0x0bd9e0f8;

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
