pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./IEscrow.sol";

import "openzeppelin-solidity/contracts/utils/Address.sol";


library ExchangeLib {
    using Address for address;

    /**
     * Flow of exchange order
     * NONE -> NEUTRAL -> PENDING |-> SETTLED
     *    prepare     order       |-> CANCELED
     *                            |-> REJECTED
     */
    enum OfferStatus {NEUTRAL, PENDING, CANCELED, SETTLED, REJECTED}

    struct Escrow {
        address addr;
        bytes4 sign;
        bytes args;
    }

    function exec(Escrow storage escrow, bytes8 offerId)
        internal
        returns (bool, bytes memory)
    {
        bytes memory escrowCalldata = IEscrow(escrow.addr).convert(
            escrow.sign,
            escrow.args,
            offerId
        );

        return escrow.addr.call(escrowCalldata);
    }

    struct Offer {
        string provider;
        address consumer;
        bytes20[] dataIds;
        uint256 at;
        uint256 until;
        Escrow escrow;
        OfferStatus status;
    }

    struct Orderbook {
        mapping(bytes8 => Offer) orders;
    }

    function prepare(Orderbook storage self, Offer memory offer)
        internal
        returns (bytes8)
    {
        require(
            offer.dataIds.length <= 128,
            "ExchangeLib: dataIds length exceeded (max 128)"
        );
        require(
            offer.at == 0,
            "ExchangeLib: offer.at should be zero in neutral state"
        );
        require(
            offer.until == 0,
            "ExchangeLib: offer.until should be zero in neutral state"
        );
        require(
            offer.escrow.addr.isContract(),
            "ExchangeLib: not contract address"
        );
        require(
            offer.status == OfferStatus.NEUTRAL,
            "ExchangeLib: neutral state only"
        );

        bytes8 offerId = bytes8(
            keccak256(
                abi.encodePacked(
                    offer.at,
                    msg.sender,
                    offer.provider,
                    offer.consumer,
                    offer.escrow.addr
                )
            )
        );

        offer.status = OfferStatus.NEUTRAL;
        self.orders[offerId] = offer;

        return offerId;
    }

    function addDataIds(
        Orderbook storage self,
        bytes8 offerId,
        bytes20[] memory dataIds
    ) internal {
        Offer storage offer = get(self, offerId);

        require(
            offer.status == OfferStatus.NEUTRAL,
            "ExchangeLib: neutral state only"
        );
        require(
            offer.dataIds.length + dataIds.length <= 128,
            "ExchangeLib: dataIds length exceeded (max 128)"
        );

        for (uint8 i = 0; i < dataIds.length; i++) {
            offer.dataIds.push(dataIds[i]);
        }
    }

    function order(
        Orderbook storage self,
        bytes8 offerId,
        uint256 timeout
    ) internal {
        Offer storage offer = get(self, offerId);

        require(
            offer.status == OfferStatus.NEUTRAL,
            "ExchangeLib: neutral state only"
        );

        offer.at = block.number;
        offer.until = block.number + timeout;
        offer.status = OfferStatus.PENDING;
    }

    function cancel(Orderbook storage self, bytes8 offerId) internal {
        Offer storage offer = get(self, offerId);

        require(
            offer.status == OfferStatus.PENDING,
            "ExchangeLib: pending state only"
        );

        offer.status = OfferStatus.CANCELED;
    }

    // settle
    function settle(Orderbook storage self, bytes8 offerId)
        internal
        returns (bool, bytes memory)
    {
        Offer storage offer = get(self, offerId);
        Escrow storage escrow = offer.escrow;

        require(block.number <= offer.until, "ExchangeLib: outdated order");
        require(
            offer.status == OfferStatus.PENDING,
            "ExchangeLib: pending state only"
        );

        (bool success, bytes memory returnData) = exec(escrow, offerId);
        if (!success) {
            return (false, returnData);
        }

        offer.status = OfferStatus.SETTLED;

        return (true, returnData);
    }

    function reject(Orderbook storage self, bytes8 offerId) internal {
        Offer storage offer = get(self, offerId);

        require(
            offer.status == OfferStatus.PENDING,
            "ExchangeLib: pending state only"
        );

        offer.status = OfferStatus.REJECTED;
    }

    function get(Orderbook storage self, bytes8 offerId)
        internal
        view
        returns (Offer storage)
    {
        return self.orders[offerId];
    }

    function exists(Orderbook storage self, bytes8 offerId)
        internal
        view
        returns (bool)
    {
        return get(self, offerId).escrow.addr != address(0x0);
    }
}
