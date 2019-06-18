pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./AppRegistry.sol";
import "./ExchangeLib.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";


contract Exchange is ReentrancyGuard {
    using ExchangeLib for ExchangeLib.Offer;
    using ExchangeLib for ExchangeLib.Orderbook;

    // offeror - prepare
    event OfferPrepared(bytes8 indexed _offerId, address _by, uint256 _at);

    // offeror - order/cancel
    event OfferPresented(bytes8 indexed _offerId, address _by, uint256 _at);
    event OfferCanceled(bytes8 indexed _offerId, address _by, uint256 _at);

    // offeree - settle+receipt
    event OfferSettled(bytes8 indexed _offerId, address _by, uint256 _at);
    event OfferReceipt(
        bytes8 indexed _offerId,
        bytes32 indexed _from,
        bytes32 indexed _to,
        bytes _result,
        uint256 _at
    );

    // offeree - reject
    event OfferRejected(bytes8 indexed _offerId, address _by, uint256 _at);

    ExchangeLib.Orderbook private orderbook;

    uint256 constant DEFAULT_TIMEOUT = 240; // block = 3600 sec = 60 min = 1 hour
    uint256 constant MAX_OPT_LENGTH = 10;

    AppRegistry private apps;

    constructor(AppRegistry _apps) public {
        apps = _apps;
    }

    /**
     * @dev escrow's method must have bytes8 argument last of them.
     * ex) testEscrowMethod(uint256 arg1, bytes32 arg2, [bytes8 offerId] <- must have);
     * @param _to offeree app name (registered in app regsitry)
     * @param _escrow address of escrow contract
     * @param _escrowSign signature of escrow contract's method
     * @param _escrowArgs argument of escrow contract's method
     * @param _dataIds bundle of dataIds you want exchange
     * @return id of prepared offer
     */
    function prepare(
        string memory _from,
        string memory _to,
        address _escrow,
        bytes4 _escrowSign,
        bytes memory _escrowArgs,
        bytes20[] memory _dataIds
    ) public returns (bytes8) {
        require(apps.exists(_from), "offeror app does not exists");
        require(apps.exists(_to), "offeree app does not exist");

        bytes8 offerId = orderbook.prepare(
            ExchangeLib.Offer({
                from: _from,
                to: _to,
                dataIds: _dataIds,
                at: 0,
                until: 0,
                escrow: ExchangeLib.Escrow({
                    addr: _escrow,
                    sign: _escrowSign,
                    args: _escrowArgs
                }),
                status: ExchangeLib.OfferStatus.NEUTRAL
            })
        );

        emit OfferPrepared(offerId, msg.sender, block.number);

        return offerId;
    }

    /**
     * @param _offerId id of prepared offer
     * @param _dataIds bundle of dataIds you want add
     */
    function addDataIds(
        bytes8 _offerId,
        bytes20[] memory _dataIds
    ) public {
        ExchangeLib.Offer memory offer = orderbook.get(_offerId);

        require(msg.sender == apps.get(offer.from).owner, "should have required authority");

        orderbook.addDataIds(_offerId, _dataIds);
    }

    /**
     * @dev order prepared offer
     * @param _offerId id of prepared offer
     */
    function order(bytes8 _offerId) public {
        ExchangeLib.Offer memory offer = orderbook.get(_offerId);

        require(msg.sender == apps.get(offer.from).owner, "should have required authority");

        orderbook.order(_offerId, DEFAULT_TIMEOUT);

        emit OfferPresented(_offerId, msg.sender, block.number);
    }

    /**
     * @dev cancel specific offer
     * @param _offerId id of proposed offer
     */
    function cancel(bytes8 _offerId) public {
        ExchangeLib.Offer memory offer = orderbook.get(_offerId);

        require(msg.sender == apps.get(offer.from).owner, "should have required authority");

        orderbook.cancel(_offerId);

        emit OfferCanceled(_offerId, msg.sender, block.number);
    }

    /**
     * @dev settle specific offer
     * @param _offerId id of proposed offer
     */
    function settle(bytes8 _offerId) public nonReentrant {
        ExchangeLib.Offer memory offer = orderbook.get(_offerId);

        require(msg.sender == apps.get(offer.to).owner, "should have required authority");

        bytes memory result = orderbook.settle(_offerId);

        emit OfferSettled(_offerId, msg.sender, block.number);
        emit OfferReceipt(
            _offerId,
            apps.get(offer.to).hashedName,
            apps.get(offer.from).hashedName,
            result, block.number
        );
    }

    /**
     * @dev reject specific offer
     * @param _offerId id of proposed offer
     */
    function reject(bytes8 _offerId) public {
        ExchangeLib.Offer memory offer = orderbook.get(_offerId);

        require(msg.sender == apps.get(offer.to).owner, "should have required authority");

        orderbook.reject(_offerId);

        emit OfferRejected(_offerId, msg.sender, block.number);
    }

    /**
     * @param _offerId offer's id you want to get
     * @return offer object
     */
    function getOffer(bytes8 _offerId)
        public
        view
        returns (ExchangeLib.Offer memory)
    {
        return orderbook.get(_offerId);
    }
}
