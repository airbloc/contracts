pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./Exchange.sol";
import "./ExchangeLib.sol";
import "./IEscrow.sol";

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Simple escrow contract for exchange
 * This contract going to be called by ExchangeLib.sol
 */
contract ERC20Escrow is IEscrow, ReentrancyGuard {
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
    ) public view returns (bytes memory) {
        require(ex.offerExists(offerId), "ERC20Escrow: offer does not exists");

        if (sign == getTransactSelector()) {
            (
                address token,
                uint256 amount
            ) = abi.decode(args, (address, uint256));

            return abi.encodeWithSelector(sign, token, amount, offerId);
        }

        revert("ERC20Escrow: invalid selector");
    }

    function transact(
        IERC20 token,
        uint256 amount,
        bytes8 offerId
    ) public nonReentrant {
        ExchangeLib.Offer memory offer = ex.getOffer(offerId);
        (address provider, address consumer) = ex.getOfferMembers(offerId);

        // check authority
        require(msg.sender == address(ex), "ERC20Escrow: only exchange contract can execute this method");

        // check contract address
        require(offer.escrow.addr == address(this), "ERC20Escrow: invalid contract information");

        // check allowance/balance
        require(amount <= token.allowance(consumer, address(this)), "ERC20Escrow: low allowance");
        require(token.allowance(consumer, address(this)) <= token.balanceOf(consumer), "ERC20Escrow: low balance");

        token.safeTransferFrom(consumer, provider, amount);
    }

    function getTransactSelector() public pure returns (bytes4) {
        return this.transact.selector;
    }
}
