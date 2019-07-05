pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./AppRegistry.sol";
import "./ExchangeLib.sol";

import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Exchange contract is exchange feature implementation of airbloc protocol.
 * This makes users of protocol to exchange data each other.
 */
contract Exchange is ReentrancyGuard {
    using ExchangeLib for ExchangeLib.Offer;
    using ExchangeLib for ExchangeLib.Orderbook;

    // offeror - prepare
    event OfferPrepared(bytes8 indexed offerId, address by, uint256 at);

    // offeror - order/cancel
    event OfferPresented(bytes8 indexed offerId, address by, uint256 at);
    event OfferCanceled(bytes8 indexed offerId, address by, uint256 at);

    // offeree - settle+receipt
    event OfferSettled(bytes8 indexed offerId, address by, uint256 at);
    event OfferReceipt(
        bytes8 indexed offerId,
        bytes32 indexed from,
        address indexed to,
        bytes result,
        uint256 at
    );
    event OfferReceiptFail(bytes data);

    // offeree - reject
    event OfferRejected(bytes8 indexed offerId, address by, uint256 at);

    ExchangeLib.Orderbook private orderbook;

    uint256 constant DEFAULT_TIMEOUT = 240; // block = 3600 sec = 60 min = 1 hour
    uint256 constant MAX_OPT_LENGTH = 10;

    AppRegistry private apps;

    constructor(AppRegistry appReg) public {
        apps = appReg;
    }

    /**
     * @param to offeree app name (registered in app regsitry)
     * @param escrow address of escrow contract
     * @param escrowSign signature of escrow contract's method
     * @param escrowArgs argument of escrow contract's method, (must be decodable (use abi.encode() )
     * @param dataIds bundle of dataIds you want exchange
     * @return id of prepared offer
     */
    function prepare(
        string memory from,
        address to,
        address escrow,
        bytes4 escrowSign,
        bytes memory escrowArgs,
        bytes20[] memory dataIds
    ) public returns (bytes8) {
        require(apps.exists(from), "offeror app does not exist");
        require(msg.sender == apps.get(from).owner, "should have required authority");

        bytes8 offerId = orderbook.prepare(
            ExchangeLib.Offer({
                from: from,
                to: to,
                dataIds: dataIds,
                at: 0,
                until: 0,
                escrow: ExchangeLib.Escrow({
                    addr: escrow,
                    sign: escrowSign,
                    args: escrowArgs
                }),
                status: ExchangeLib.OfferStatus.NEUTRAL
            })
        );

        emit OfferPrepared(offerId, msg.sender, block.number);

        return offerId;
    }

    /**
     * @param offerId id of prepared offer
     * @param dataIds bundle of dataIds you want add
     */
    function addDataIds(
        bytes8 offerId,
        bytes20[] memory dataIds
    ) public {
        ExchangeLib.Offer memory offer = orderbook.get(offerId);

        require(apps.isOwner(offer.from, msg.sender), "should have required authority");

        orderbook.addDataIds(offerId, dataIds);
    }

    /**
     * @dev order prepared offer
     * @param offerId id of prepared offer
     */
    function order(bytes8 offerId) public {
        ExchangeLib.Offer memory offer = orderbook.get(offerId);

        require(apps.isOwner(offer.from, msg.sender), "should have required authority");

        orderbook.order(offerId, DEFAULT_TIMEOUT);

        emit OfferPresented(offerId, msg.sender, block.number);
    }

    /**
     * @dev cancel specific offer
     * @param offerId id of proposed offer
     */
    function cancel(bytes8 offerId) public {
        ExchangeLib.Offer memory offer = orderbook.get(offerId);

        require(apps.isOwner(offer.from, msg.sender), "should have required authority");

        orderbook.cancel(offerId);

        emit OfferCanceled(offerId, msg.sender, block.number);
    }

    /**
     * @dev settle specific offer
     * @param offerId id of proposed offer
     */
    function settle(bytes8 offerId) public nonReentrant {
        ExchangeLib.Offer memory offer = orderbook.get(offerId);

        require(msg.sender == offer.to, "should have required authority");

        (bool success, bytes memory result) = orderbook.settle(offerId);

        if (success) {
            emit OfferSettled(offerId, msg.sender, block.number);
            emit OfferReceipt(
                offerId,
                apps.get(offer.from).hashedName,
                offer.to,
                result, block.number
            );
        } else {
            emit OfferReceiptFail(result);
        }
    }

    /**
     * @dev reject specific offer
     * @param offerId id of proposed offer
     */
    function reject(bytes8 offerId) public {
        ExchangeLib.Offer memory offer = orderbook.get(offerId);

        require(msg.sender == offer.to, "should have required authority");

        orderbook.reject(offerId);

        emit OfferRejected(offerId, msg.sender, block.number);
    }

    /**
     * @param offerId offer's id you want to get
     * @return offer object
     */
    function getOffer(bytes8 offerId) public view returns (ExchangeLib.Offer memory) {
        return orderbook.get(offerId);
    }

    /**
     * @param offerId offer's id you want to get
     * @return owners of from, to apps
     */
     function getOfferMembers(bytes8 offerId) public view returns (address, address) {
        ExchangeLib.Offer memory offer = orderbook.get(offerId);
        return (apps.get(offer.from).owner, offer.to);
     }
}
