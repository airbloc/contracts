pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

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
        bytes4  sign;
        bytes   args;
    }

    function exec(
        Escrow storage _escrow,
        bytes32 _offerId
    ) internal returns (bool, bytes memory) {
        bytes memory data = abi.encode(_offerId);
        if (_escrow.args.length > 0) {
            data = abi.encodePacked(
                _escrow.args,
                _offerId
            );
        }
        data = abi.encodePacked(_escrow.sign, data);
        return _escrow.addr.call(data);
    }

    struct Offer {
        string from;
        string to;
        bytes20[] dataIds;
        uint256 at;
        uint256 until;
        Escrow escrow;
        OfferStatus status;
    }

    struct Orderbook {
        mapping(bytes8 => Offer) orders;
    }

    function prepare(
        Orderbook storage self,
        Offer memory _offer
    ) internal returns (bytes8) {
        require(_offer.at == 0, "offer.at should be zero in neutral state");
        require(_offer.until == 0, "offer.until should be zero in neutral state");
        require(_offer.status == OfferStatus.NEUTRAL, "neutral state only");
        require(_offer.escrow.addr.isContract(), "not contract address");

        bytes8 offerId = bytes8(
            keccak256(
                abi.encodePacked(
                    _offer.at,
                    msg.sender,
                    _offer.from,
                    _offer.to,
                    _offer.escrow.addr
                )
            )
        );

        _offer.status = OfferStatus.NEUTRAL;
        self.orders[offerId] = _offer;

        return offerId;
    }

    function addDataIds(
        Orderbook storage self,
        bytes8 _offerId,
        bytes20[] memory _dataIds
    ) internal {
        Offer storage offer = _get(self, _offerId);

        require(offer.status == OfferStatus.NEUTRAL, "neutral state only");
        require(offer.dataIds.length + _dataIds.length <= 255, "dataIds length exceeded (max 255)");

        for (uint8 i = 0; i < _dataIds.length; i++) {
            offer.dataIds.push(_dataIds[i]);
        }
    }

    function order(
        Orderbook storage self,
        bytes8 _offerId,
        uint256 timeout
    ) internal {
        Offer storage offer = _get(self, _offerId);

        require(offer.status == OfferStatus.NEUTRAL, "neutral state only");

        offer.at = block.number;
        offer.until = block.number + timeout;
        offer.status = OfferStatus.PENDING;
    }

    function cancel(
        Orderbook storage self,
        bytes8 _offerId
    ) internal {
        Offer storage offer = _get(self, _offerId);

        require(offer.status == OfferStatus.PENDING, "pending state only");

        offer.status = OfferStatus.CANCELED;
    }

    // settle and open
    function settle(
        Orderbook storage self,
        bytes8 _offerId
    ) internal returns (bytes memory) {
        Offer storage offer = _get(self, _offerId);
        Escrow storage escrow = offer.escrow;

        require(block.number <= offer.until, "outdated order");
        require(offer.status == OfferStatus.PENDING, "pending state only");

        offer.status = OfferStatus.SETTLED;

        (bool success, bytes memory result) = exec(escrow, _offerId);

        require(success, "failed to call escrow contract");

        return result;
    }

    function reject(
        Orderbook storage self,
        bytes8 _offerId
    ) internal {
        Offer storage offer = _get(self, _offerId);

        require(offer.status == OfferStatus.PENDING, "pending state only");

        offer.status = OfferStatus.REJECTED;
    }

    function get(
        Orderbook storage self,
        bytes8 _offerId
    ) internal view returns (Offer memory) {
        require(exists(self, _offerId), "offer does not exist");
        return _get(self, _offerId);
    }

    function _get(
        Orderbook storage self,
        bytes8 _offerId
    ) internal view returns (Offer storage) {
        return self.orders[_offerId];
    }

    function exists(
        Orderbook storage self,
        bytes8 _offerId
    ) internal view returns (bool) {
        return _get(self, _offerId).escrow.addr != address(0x0);
    }
}
