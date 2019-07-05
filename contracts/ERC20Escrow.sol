pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./Exchange.sol";
import "./ExchangeLib.sol";
import "./IEscrow.sol";

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
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
    bytes4 public constant TRANSACT_SELECTOR = bytes4(keccak256(bytes(TRANSACT_SIGNATURE)));

    function transact(
        IERC20 token,
        uint256 amount,
        bytes8 offerId
    ) public nonReentrant {
        ExchangeLib.Offer memory offer = ex.getOffer(offerId);
        (address provider, address consumer) = ex.getOfferMembers(offerId);

        // check authority
        require(msg.sender == address(ex), "should have authority");

        // check contract address
        require(offer.escrow.addr == address(this), "invalid contract information");

        // check allowance/balance
        require(amount <= token.allowance(consumer, address(this)), "low allowance");
        require(token.allowance(consumer, address(this)) <= token.balanceOf(consumer), "low balance");

        token.safeTransferFrom(consumer, provider, amount);
    }
}
