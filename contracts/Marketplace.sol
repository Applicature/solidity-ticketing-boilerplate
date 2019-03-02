pragma solidity ^0.4.24;

import "./Managed.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./EventTicketsRegistry.sol";
import "./Event.sol";
import "./FundsDistributor.sol";


contract Marketplace is Managed {

    using SafeMath for uint256;

    event TicketPurchased(
        uint256 _eventId,
        uint256 indexed _ticketId,
        address indexed _buyer,
        uint256 _ticketPrice
    );

    event TicketResold(
        uint256 _eventId,
        uint256 indexed _ticketId,
        address indexed _reseller,
        address indexed _buyer,
        uint256 _ticketPrice
    );

    event Refund(
        address _ticketOwner,
        uint256 _eventId,
        uint256 _ticketId
    );

    constructor(address _management) public Managed(_management){}

    function withdrawEventFunds(
        uint256 _eventId
    )
        public
        requireContractExistsInRegistry(CONTRACT_EVENT)
    {
        Event _event = Event(
            management.contractRegistry(CONTRACT_EVENT)
        );

        require(
            management.eventOrganizersRegistry(_eventId) == msg.sender,
            ERROR_ACCESS_DENIED
        );

        uint256 value = _event.getCollectedFunds(_eventId);

        require(
            address(this).balance >= value,
            ERROR_NOT_AVAILABLE
        );

        _event.withdrawCollectedFunds(_eventId);

        msg.sender.transfer(value);
    }

    function addNewEvent(
        string _name,
        string _symbol,
        uint256 _ticketsAmount,
        uint256 _startTime
    )
        public
        requireNotContractSender()
        requireContractExistsInRegistry(CONTRACT_EVENT)
    {
        Event _event = Event(
            management.contractRegistry(CONTRACT_EVENT)
        );

        uint256 _eventId = _event.createEvent(_ticketsAmount, _startTime);

        EventTicketsRegistry eventTicketRegistry =
            new EventTicketsRegistry(management, _name, _symbol);

        management.registerNewEvent(
            _eventId, msg.sender, address(eventTicketRegistry)
        );
    }

    function buyTicketFromOrganizer(
        uint256 _eventId,
        uint256 _resellProfitShare,
        uint256 _percentageAbsMax,
        uint256[SECTION_ROW_SEAT] _seat,
        uint256 _initialPrice,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    )
        public
        payable
        requireNotContractSender()
        requireContractExistsInRegistry(CONTRACT_EVENT)
    {
        address recoveredAddress = verifyPurchase(
            msg.sender,
            _eventId,
            _resellProfitShare,
            _percentageAbsMax,
            _seat,
            _initialPrice,
            _v,
            _r,
            _s
        );

        require(
            hasPermission(recoveredAddress, CAN_SIGN_TRANSACTION),
            ERROR_ACCESS_DENIED
        );

        internalBuyTicketFromOrganizer(
            msg.sender,
            _eventId,
            _resellProfitShare,
            _percentageAbsMax,
            _initialPrice
        );
    }

    function buyTicketFromReseller(
        uint256 _eventId,
        uint256 _ticketId
    )
        public
        payable
        requireNotContractSender()
        requireContractExistsInRegistry(CONTRACT_EVENT)
        requireContractExistsInRegistry(CONTRACT_DISTRIBUTOR)
    {
        Event _event = Event(
            management.contractRegistry(CONTRACT_EVENT)
        );

        require(
            _event.eventHasBeenStarted(_eventId) == false,
            ERROR_NOT_AVAILABLE
        );

        FundsDistributor distributor = FundsDistributor(
            management.contractRegistry(CONTRACT_DISTRIBUTOR)
        );

        distributor.distributeResaleFunds.value(msg.value)(
            _eventId,
            _ticketId
        );

        EventTicketsRegistry ticket =
            EventTicketsRegistry(management.ticketRegistry(_eventId));

        address previousOwner = ticket.resellTicket(_ticketId, msg.sender);

        emit TicketResold(
            _eventId,
            _ticketId,
            previousOwner,
            msg.sender,
            msg.value
        );
    }

    function refund(
        uint256 _eventId,
        uint256 _ticketId,
        uint256 _refundPercentage,
        uint256 _percentageAbsMax,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    )
        public
        requireNotContractSender()
        requireContractExistsInRegistry(CONTRACT_EVENT)
    {
        require(
            _refundPercentage <= _percentageAbsMax,
            ERROR_INVALID_INPUT
        );

        address recoveredAddress = verifyRefund(
            msg.sender,
            _eventId,
            _ticketId,
            _refundPercentage,
            _percentageAbsMax,
            _v,
            _r,
            _s
        );

        require(
            hasPermission(recoveredAddress, CAN_SIGN_TRANSACTION),
            ERROR_ACCESS_DENIED
        );

        internalRefund(
            _eventId,
            _ticketId,
            _refundPercentage,
            _percentageAbsMax
        );
    }

    function verifyPurchase(
        address _sender,
        uint256 _eventId,
        uint256 _resellProfitShare,
        uint256 _percentageAbsMax,
        uint256[SECTION_ROW_SEAT] _seat,
        uint256 _initialPrice,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    )
        public
        pure
        returns (address)
    {
        bytes32 hash = keccak256(
            abi.encodePacked(
                _sender,
                _eventId,
                _resellProfitShare,
                _percentageAbsMax,
                _seat[0],
                _seat[1],
                _seat[2],
                _initialPrice
            )
        );

        bytes memory prefix = "\x19Ethereum Signed Message:\n32";

        return ecrecover(
            keccak256(abi.encodePacked(prefix, hash)),
            _v,
            _r,
            _s
        );
    }

    function verifyRefund(
        address _sender,
        uint256 _eventId,
        uint256 _ticketId,
        uint256 _refundPercentage,
        uint256 _percentageAbsMax,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    )
        public
        pure
        returns (address)
    {
        bytes32 hash = keccak256(
            abi.encodePacked(
                _sender,
                _eventId,
                _ticketId,
                _refundPercentage,
                _percentageAbsMax
            )
        );

        bytes memory prefix = "\x19Ethereum Signed Message:\n32";

        return ecrecover(
            keccak256(abi.encodePacked(prefix, hash)),
            _v,
            _r,
            _s
        );
    }

    function isInitialized()
        public
        view
        returns (bool)
    {
        return (
            address(management) != address(0) &&
            management.contractRegistry(CONTRACT_MARKETPLACE) != address(0) &&
            management.contractRegistry(CONTRACT_DISTRIBUTOR) != address(0) &&
            management.contractRegistry(CONTRACT_EVENT) != address(0)
        );
    }

    function internalBuyTicketFromOrganizer(
        address _sender,
        uint256 _eventId,
        uint256 _resellProfitShare,
        uint256 _percentageAbsMax,
        uint256 _initialPrice
    )
        internal
        requireContractExistsInRegistry(CONTRACT_EVENT)
        returns (uint256 _ticketId)
    {
        Event _event = Event(
            management.contractRegistry(CONTRACT_EVENT)
        );

        EventTicketsRegistry ticket =
            EventTicketsRegistry(management.ticketRegistry(_eventId));

        ticket.createTicket(
            _sender,
            _initialPrice,
            _resellProfitShare,
            _percentageAbsMax
        // @TODO: pass information about seat location
        );

        _event.sellTicket(_eventId, 1, _initialPrice);

        emit TicketPurchased(
            _eventId,
            _ticketId,
            _sender,
            _initialPrice
        // @TODO: pass information about seat location
        );
    }

    function internalRefund(
        uint256 _eventId,
        uint256 _ticketId,
        uint256 _refundPercentage,
        uint256 _percentageAbsMax
    )
        internal
        requireContractExistsInRegistry(CONTRACT_EVENT)
    {
        Event _event = Event(
            management.contractRegistry(CONTRACT_EVENT)
        );

        EventTicketsRegistry ticket =
            EventTicketsRegistry(management.ticketRegistry(_eventId));

        address ticketOwner;
        uint256 resellProfitShare;
        uint256 percentageAbsMax;
        uint256 initialPrice;
        uint256 previousPrice;
        uint256 newPrice;

        (
            ticketOwner,
            resellProfitShare,
            percentageAbsMax,
            initialPrice,
            previousPrice,
            newPrice
        ) = ticket.getTicket(_ticketId);

        uint256 value = initialPrice
            .mul(_refundPercentage)
            .div(_percentageAbsMax);

        _event.refundTicket(_eventId, 1, value);

        if (value > 0){
            ticketOwner.transfer(value);
        }

        ticket.burnTicket(ticketOwner, _ticketId);

        emit Refund(ticketOwner, _eventId, _ticketId);
    }
}