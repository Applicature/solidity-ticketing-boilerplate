pragma solidity ^0.4.24;

import "../Event.sol";


contract EventTest is Event {

    constructor(address _management) public Event(_management){}

    function updateSoldTickets(
        uint256 _eventId,
        uint256 _newValue
    )
        public
    {
        events[_eventId].soldTicketsAmount = _newValue;
    }

    function updateStartTime(
        uint256 _eventId,
        uint256 _newValue
    )
        public
    {
        events[_eventId].startTime = _newValue;
    }

    function getCollectedFundsTest(
        uint256 _eventId
    )
        public
        view
        returns(uint256)
    {
        return events[_eventId].collectedFunds;
    }
}