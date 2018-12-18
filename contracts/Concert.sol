pragma solidity ^0.4.24;

import "./Managed.sol";
import "./Ticket.sol";


contract Concert is Managed {

    struct ConcertDetails {
        uint256 ticketsAmount;
        uint256 soldTicketsAmount;
        uint256 collectedFunds;
        uint256 startTime;
    }

    ConcertDetails[] public concerts;

    event ConcertCreated(
        uint256 indexed _concertId,
        uint256 _ticketsAmount,
        uint256 _startTime
    );

    constructor(address _management) public Managed(_management){}

    function createConcert(
        uint256 _ticketsAmount,
        uint256 _startTime
    )
        public
        requirePermission(CAN_ADD_CONCERTS)
        canCallOnlyRegisteredContract(CONTRACT_MARKETPLACE)
        returns (uint256 _concertId)
    {
        require(
            _ticketsAmount > 0 &&
            _startTime > block.timestamp,
            ERROR_INVALID_INPUT
        );

        _concertId = getConcertsAmount();

        concerts.push(
            ConcertDetails({
                ticketsAmount: _ticketsAmount,
                soldTicketsAmount: 0,
                collectedFunds: 0,
                startTime: _startTime
            })
        );

        emit ConcertCreated(_concertId, _ticketsAmount, _startTime);
    }

    function updateConcert(
        uint256 _concertId,
        uint256 _ticketsAmount,
        uint256 _startTime
    )
        public
    {
        require(
            msg.sender == management.concertOrganizersRegistry(_concertId),
            ERROR_ACCESS_DENIED
        );

        require(
            _ticketsAmount >= concerts[_concertId].soldTicketsAmount &&
            _startTime > block.timestamp &&
            concertHasStarted(_concertId) == false,
            ERROR_INVALID_INPUT
        );

        concerts[_concertId].ticketsAmount = _ticketsAmount;
        concerts[_concertId].startTime = _startTime;
    }

    function sellTicket(
        uint256 _concertId,
        uint256 _ticketsAmount,
        uint256 _collectedFundsAmount
    )
        public
        requirePermission(CAN_SELL_TICKETS)
        canCallOnlyRegisteredContract(CONTRACT_MARKETPLACE)
    {
        require(
            concertHasStarted(_concertId) == false &&
            _ticketsAmount <= getAvailableTickets(0),
            ERROR_NOT_AVAILABLE
        );

        concerts[_concertId].soldTicketsAmount =
            concerts[_concertId].soldTicketsAmount.add(_ticketsAmount);
        concerts[_concertId].collectedFunds =
            concerts[_concertId].collectedFunds.add(_collectedFundsAmount);
    }

    function refundTicket(
        uint256 _concertId,
        uint256 _ticketsAmount,
        uint256 _refundedFundsAmount
    )
        public
        requirePermission(CAN_MAKE_REFUND)
        canCallOnlyRegisteredContract(CONTRACT_MARKETPLACE)
    {
        require(
            concertHasStarted(_concertId) == false &&
            _ticketsAmount <= concerts[_concertId].soldTicketsAmount &&
            _refundedFundsAmount <= concerts[_concertId].collectedFunds,
            ERROR_NOT_AVAILABLE
        );

        concerts[_concertId].soldTicketsAmount =
            concerts[_concertId].soldTicketsAmount.sub(_ticketsAmount);
        concerts[_concertId].collectedFunds =
            concerts[_concertId].collectedFunds.sub(_refundedFundsAmount);
    }

    function withdrawCollectedFunds(
        uint256 _concertId
    )
        public
        requirePermission(CAN_UPDATE_CONCERT)
        canCallOnlyRegisteredContract(CONTRACT_MARKETPLACE)
    {
        require(
            concertHasStarted(_concertId) == true &&
            concerts[_concertId].collectedFunds > 0,
            ERROR_NOT_AVAILABLE
        );

        concerts[_concertId].collectedFunds = 0;
    }

    function isInitialized()
        public
        view
        returns (bool)
    {
        return (
            address(management) != address(0) &&
            management.contractRegistry(CONTRACT_CONCERT) != address(0)
        );
    }

    function getConcertsAmount()
        public
        view
        returns(uint256 _concertsAmount)
    {
        return concerts.length;
    }

    function concertExists(
        uint256 _concertId
    )
        public
        view
        returns(bool)
    {
        return (_concertId < getConcertsAmount()) ? true : false;
    }

    function concertHasStarted(
        uint256 _concertId
    )
        public
        view
        returns(bool)
    {
        require(
            concertExists(_concertId),
            ERROR_NOT_AVAILABLE
        );

        return (concerts[_concertId].startTime < block.timestamp)
            ? true
            : false;
    }

    function getCollectedFunds(
        uint256 _concertId
    )
        public
        view
        returns(uint256)
    {
        require(
            concertHasStarted(_concertId) == true,
            ERROR_NOT_AVAILABLE
        );

        return concerts[_concertId].collectedFunds;
    }

    function getAvailableTickets(
        uint256 _concertId
    )
        public
        view
        returns(uint256)
    {
        require(
            concertHasStarted(_concertId) == false,
            ERROR_NOT_AVAILABLE
        );

        return concerts[_concertId].ticketsAmount
            .sub(concerts[_concertId].soldTicketsAmount);
    }

    function getConcert(uint256 _concertId)
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
            concertExists(_concertId),
            ERROR_INVALID_INPUT
        );

        ConcertDetails storage concert = concerts[_concertId];

        return(
            management.concertOrganizersRegistry(_concertId),
            concert.ticketsAmount,
            concert.soldTicketsAmount,
            concert.collectedFunds,
            concert.startTime
        );
    }
}