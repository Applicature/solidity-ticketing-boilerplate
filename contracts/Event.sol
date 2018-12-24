pragma solidity ^0.4.24;

import "./Managed.sol";
import "./Ticket.sol";


contract Event is Managed {

    struct EventDetails {
        uint256 ticketsAmount;
        uint256 soldTicketsAmount;
        uint256 collectedFunds;
        uint256 startTime;
    }

    EventDetails[] public events;

    event EventCreated(
        uint256 indexed _eventId,
        uint256 _ticketsAmount,
        uint256 _startTime
    );

    constructor(address _management) public Managed(_management){}

    function createEvent(
        uint256 _ticketsAmount,
        uint256 _startTime
    )
        public
        requirePermission(CAN_ADD_EVENTS)
        canCallOnlyRegisteredContract(CONTRACT_MARKETPLACE)
        returns (uint256 _eventId)
    {
        require(
            _ticketsAmount > 0 &&
            _startTime > block.timestamp,
            ERROR_INVALID_INPUT
        );

        _eventId = getEventsAmount();

        events.push(
            EventDetails({
                ticketsAmount: _ticketsAmount,
                soldTicketsAmount: 0,
                collectedFunds: 0,
                startTime: _startTime
            })
        );

        emit EventCreated(_eventId, _ticketsAmount, _startTime);
    }

    function updateEvent(
        uint256 _eventId,
        uint256 _ticketsAmount,
        uint256 _startTime
    )
        public
    {
        require(
            msg.sender == management.eventOrganizersRegistry(_eventId),
            ERROR_ACCESS_DENIED
        );

        require(
            _ticketsAmount >= events[_eventId].soldTicketsAmount &&
            _startTime > block.timestamp &&
            eventHasBeenStarted(_eventId) == false,
            ERROR_INVALID_INPUT
        );

        events[_eventId].ticketsAmount = _ticketsAmount;
        events[_eventId].startTime = _startTime;
    }

    function sellTicket(
        uint256 _eventId,
        uint256 _ticketsAmount,
        uint256 _collectedFundsAmount
    )
        public
        requirePermission(CAN_SELL_TICKETS)
        canCallOnlyRegisteredContract(CONTRACT_MARKETPLACE)
    {
        require(
            eventHasBeenStarted(_eventId) == false &&
            _ticketsAmount <= getAvailableTickets(0),
            ERROR_NOT_AVAILABLE
        );

        events[_eventId].soldTicketsAmount =
            events[_eventId].soldTicketsAmount.add(_ticketsAmount);
        events[_eventId].collectedFunds =
            events[_eventId].collectedFunds.add(_collectedFundsAmount);
    }

    function refundTicket(
        uint256 _eventId,
        uint256 _ticketsAmount,
        uint256 _refundedFundsAmount
    )
        public
        requirePermission(CAN_MAKE_REFUND)
        canCallOnlyRegisteredContract(CONTRACT_MARKETPLACE)
    {
        require(
            eventHasBeenStarted(_eventId) == false &&
            _ticketsAmount <= events[_eventId].soldTicketsAmount &&
            _refundedFundsAmount <= events[_eventId].collectedFunds,
            ERROR_NOT_AVAILABLE
        );

        events[_eventId].soldTicketsAmount =
            events[_eventId].soldTicketsAmount.sub(_ticketsAmount);
        events[_eventId].collectedFunds =
            events[_eventId].collectedFunds.sub(_refundedFundsAmount);
    }

    function withdrawCollectedFunds(
        uint256 _eventId
    )
        public
        requirePermission(CAN_UPDATE_EVENT)
        canCallOnlyRegisteredContract(CONTRACT_MARKETPLACE)
    {
        require(
            eventHasBeenStarted(_eventId) == true &&
            events[_eventId].collectedFunds > 0,
            ERROR_NOT_AVAILABLE
        );

        events[_eventId].collectedFunds = 0;
    }

    function isInitialized()
        public
        view
        returns (bool)
    {
        return (
            address(management) != address(0) &&
            management.contractRegistry(CONTRACT_EVENT) != address(0)
        );
    }

    function getEventsAmount()
        public
        view
        returns(uint256 _eventsAmount)
    {
        return events.length;
    }

    function eventExists(
        uint256 _eventId
    )
        public
        view
        returns(bool)
    {
        return (_eventId < getEventsAmount()) ? true : false;
    }

    function eventHasBeenStarted(
        uint256 _eventId
    )
        public
        view
        returns(bool)
    {
        require(
            eventExists(_eventId),
            ERROR_NOT_AVAILABLE
        );

        return (events[_eventId].startTime < block.timestamp) ? true : false;
    }

    function getCollectedFunds(
        uint256 _eventId
    )
        public
        view
        returns(uint256)
    {
        require(
            eventHasBeenStarted(_eventId) == true,
            ERROR_NOT_AVAILABLE
        );

        return events[_eventId].collectedFunds;
    }

    function getAvailableTickets(
        uint256 _eventId
    )
        public
        view
        returns(uint256)
    {
        require(
            eventHasBeenStarted(_eventId) == false,
            ERROR_NOT_AVAILABLE
        );

        return events[_eventId].ticketsAmount
            .sub(events[_eventId].soldTicketsAmount);
    }

    function getEvent(uint256 _eventId)
        public
        view
        returns(
            address _organizer,
            uint256 _ticketsAmount,
            uint256 _soldTicketsAmount,
            uint256 _collectedFunds,
            uint256 _startTime
        )
    {
        require(
            eventExists(_eventId),
            ERROR_INVALID_INPUT
        );

        EventDetails storage _event = events[_eventId];

        return(
            management.eventOrganizersRegistry(_eventId),
            _event.ticketsAmount,
            _event.soldTicketsAmount,
            _event.collectedFunds,
            _event.startTime
        );
    }
}