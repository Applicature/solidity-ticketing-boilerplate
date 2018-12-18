pragma solidity ^0.4.24;

import "../Concert.sol";


contract ConcertTest is Concert {

    constructor(address _management) public Concert(_management){}

    function updateSoldTickets(
        uint256 _concertId,
        uint256 _newValue
    )
        public
    {
        concerts[_concertId].soldTicketsAmount = _newValue;
    }

    function updateStartTime(
        uint256 _concertId,
        uint256 _newValue
    )
        public
    {
        concerts[_concertId].startTime = _newValue;
    }

    function getCollectedFundsTest(
        uint256 _concertId
    )
        public
        view
        returns(uint256)
    {
        return concerts[_concertId].collectedFunds;
    }
}