pragma solidity ^0.4.24;

import "./Managed.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Ticket.sol";
import "./Concert.sol";
import "./FundsDistributor.sol";


contract Marketplace is Managed {

    using SafeMath for uint256;

    event TicketPurchased(
        uint256 _concertId,
        uint256 indexed _ticketId,
        address indexed _buyer,
        uint256 _ticketPrice
    );

    event TicketResold(
        uint256 _concertId,
        uint256 indexed _ticketId,
        address indexed _reseller,
        address indexed _buyer,
        uint256 _ticketPrice
    );

    event Refund(
        address _ticketOwner,
        uint256 _concertId,
        uint256 _ticketId
    );

    constructor(address _management) public Managed(_management){}

    function withdrawConcertFunds(
        uint256 _concertId
    )
        public
        requireContractExistsInRegistry(CONTRACT_CONCERT)
    {
        Concert concert = Concert(
            management.contractRegistry(CONTRACT_CONCERT)
        );

        require(
            management.concertOrganizersRegistry(_concertId) == msg.sender,
            ERROR_ACCESS_DENIED
        );

        uint256 value = concert.getCollectedFunds(_concertId);

        require(
            address(this).balance >= value,
            ERROR_NOT_AVAILABLE
        );

        msg.sender.transfer(value);
        concert.withdrawCollectedFunds(_concertId);
    }

    function addNewConcert(
        string _name,
        string _symbol,
        uint256 _ticketsAmount,
        uint256 _startTime
    )
        public
        requireNotContractSender()
        requireContractExistsInRegistry(CONTRACT_CONCERT)
    {
        Concert concert = Concert(
            management.contractRegistry(CONTRACT_CONCERT)
        );

        uint256 _concertId = concert.createConcert(_ticketsAmount, _startTime);

        Ticket ticket = new Ticket(management, _name, _symbol);

        management.registerNewConcert(_concertId, msg.sender, address(ticket));
    }

    function buyTicketFromOrganizer(
        uint256 _concertId,
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
        requireContractExistsInRegistry(CONTRACT_CONCERT)
    {
        address recoveredAddress = verifyPurchase(
            msg.sender,
            _concertId,
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
            _concertId,
            _resellProfitShare,
            _percentageAbsMax,
            _initialPrice
        );
    }

    function buyTicketFromReseller(
        uint256 _concertId,
        uint256 _ticketId
    )
        public
        payable
        requireNotContractSender()
        requireContractExistsInRegistry(CONTRACT_CONCERT)
        requireContractExistsInRegistry(CONTRACT_DISTRIBUTOR)
    {
        Concert concert = Concert(
            management.contractRegistry(CONTRACT_CONCERT)
        );

        require(
            concert.concertHasStarted(_concertId) == false,
            ERROR_NOT_AVAILABLE
        );

        FundsDistributor distributor = FundsDistributor(
            management.contractRegistry(CONTRACT_DISTRIBUTOR)
        );

        distributor.distributeResaleFunds.value(msg.value)(
            _concertId,
            _ticketId
        );

        Ticket ticket = Ticket(management.ticketRegistry(_concertId));

        address previousOwner = ticket.resellTicket(_ticketId, msg.sender);

        emit TicketResold(
            _concertId,
            _ticketId,
            previousOwner,
            msg.sender,
            msg.value
        );
    }

    function refund(
        uint256 _concertId,
        uint256 _ticketId,
        uint256 _refundPercentage,
        uint256 _percentageAbsMax,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    )
        public
        requireNotContractSender()
        requireContractExistsInRegistry(CONTRACT_CONCERT)
    {
        require(
            _refundPercentage <= _percentageAbsMax,
            ERROR_INVALID_INPUT
        );

        address recoveredAddress = verifyRefund(
            msg.sender,
            _concertId,
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
            _concertId,
            _ticketId,
            _refundPercentage,
            _percentageAbsMax
        );
    }

    function verifyPurchase(
        address _sender,
        uint256 _concertId,
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
                _concertId,
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
        uint256 _concertId,
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
                _concertId,
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
            management.contractRegistry(CONTRACT_CONCERT) != address(0)
        );
    }

    function internalBuyTicketFromOrganizer(
        address _sender,
        uint256 _concertId,
        uint256 _resellProfitShare,
        uint256 _percentageAbsMax,
        uint256 _initialPrice
    )
        internal
        requireContractExistsInRegistry(CONTRACT_CONCERT)
        returns (uint256 _ticketId)
    {
        Concert concert = Concert(
            management.contractRegistry(CONTRACT_CONCERT)
        );

        Ticket ticket = Ticket(management.ticketRegistry(_concertId));

        ticket.createTicket(
            _sender,
            _initialPrice,
            _resellProfitShare,
            _percentageAbsMax
        );

        concert.sellTicket(_concertId, 1, _initialPrice);

        emit TicketPurchased(
            _concertId,
            _ticketId,
            _sender,
            _initialPrice
        );
    }

    function internalRefund(
        uint256 _concertId,
        uint256 _ticketId,
        uint256 _refundPercentage,
        uint256 _percentageAbsMax
    )
        internal
        requireContractExistsInRegistry(CONTRACT_CONCERT)
    {
        Concert concert = Concert(
            management.contractRegistry(CONTRACT_CONCERT)
        );

        Ticket ticket = Ticket(management.ticketRegistry(_concertId));

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

        concert.refundTicket(_concertId, 1, value);

        if (value > 0){
            ticketOwner.transfer(value);
        }

        ticket.burnTicket(ticketOwner, _ticketId);

        emit Refund(ticketOwner, _concertId, _ticketId);
    }
}