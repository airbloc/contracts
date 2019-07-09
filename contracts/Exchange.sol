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
    event OfferPrepared(bytes8 indexed offerId, string providerAppName);

    // offeror - order/cancel
    event OfferPresented(bytes8 indexed offerId, string providerAppName);
    event OfferCanceled(bytes8 indexed offerId, string providerAppName);

    // offeree - settle+receipt
    event OfferSettled(bytes8 indexed offerId, address indexed consumer);
    event OfferReceipt(
        bytes8 indexed offerId,
        string providerAppName,
        address indexed consumer,
        bytes result
    );
    event EscrowExecutionFailed(bytes reason);

    // offeree - reject
    event OfferRejected(bytes8 indexed offerId, address indexed consumer);

    ExchangeLib.Orderbook private orderbook;

    uint256 constant DEFAULT_TIMEOUT_BLOCKS = 60; // block = 900 sec = 15 min
    uint256 constant MAX_OPT_LENGTH = 10;

    AppRegistry private apps;

    constructor(AppRegistry appReg) public {
        apps = appReg;
    }

    /**
     * @param provider provider app name (registered in app registry)
     * @param consumer consumer address
     * @param escrow address of escrow contract
     * @param escrowSign signature of escrow contract's method
     * @param escrowArgs argument of escrow contract's method, (must be decodable using abi.encode())
     * @param dataIds bundle of dataIds you want exchange
     * @return id of prepared offer
     */
    function prepare(
        string memory provider,
        address consumer,
        address escrow,
        bytes4 escrowSign,
        bytes memory escrowArgs,
        bytes20[] memory dataIds
    ) public returns (bytes8) {
        require(apps.exists(provider), "provider app does not exist");
        require(apps.isOwner(provider, msg.sender), "only provider app owner can prepare order");

        bytes8 offerId = orderbook.prepare(
            ExchangeLib.Offer({
                provider: provider,
                consumer: consumer,
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

        emit OfferPrepared(offerId, provider);

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

        require(apps.isOwner(offer.provider, msg.sender), "only provider app owner can update order");

        orderbook.addDataIds(offerId, dataIds);
    }

    /**
     * @dev order prepared offer
     * @param offerId id of prepared offer
     */
    function order(bytes8 offerId) public {
        ExchangeLib.Offer memory offer = orderbook.get(offerId);

        require(apps.isOwner(offer.provider, msg.sender), "only provider app owner can present order");

        orderbook.order(offerId, DEFAULT_TIMEOUT_BLOCKS);

        emit OfferPresented(offerId, offer.provider);
    }

    /**
     * @dev cancel specific offer
     * @param offerId id of proposed offer
     */
    function cancel(bytes8 offerId) public {
        ExchangeLib.Offer memory offer = orderbook.get(offerId);

        require(apps.isOwner(offer.provider, msg.sender), "only provider app owner can cancel order");

        orderbook.cancel(offerId);

        emit OfferCanceled(offerId, offer.provider);
    }

    /**
     * @dev settle specific offer
     * @param offerId id of proposed offer
     */
    function settle(bytes8 offerId) public nonReentrant {
        ExchangeLib.Offer memory offer = orderbook.get(offerId);

        require(msg.sender == offer.consumer, "only consumer can settle order");

        (bool success, bytes memory result) = orderbook.settle(offerId);
        if (!success) {
            emit EscrowExecutionFailed(result);
            return;
        }

        emit OfferSettled(offerId, msg.sender);
        emit OfferReceipt(
            offerId,
            offer.provider,
            offer.consumer,
            result
        );
    }

    /**
     * @dev reject specific offer
     * @param offerId id of proposed offer
     */
    function reject(bytes8 offerId) public {
        ExchangeLib.Offer memory offer = orderbook.get(offerId);

        require(msg.sender == offer.consumer, "only consumer can reject order");

        orderbook.reject(offerId);

        emit OfferRejected(offerId, msg.sender);
    }

    /**
     * @dev check if offer exists
     * @param offerId offer's id to check
     * @return existance of offer
     */
    function offerExists(bytes8 offerId) public view returns (bool) {
        return orderbook.exists(offerId);
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
        return (apps.get(offer.provider).owner, offer.consumer);
     }
}
