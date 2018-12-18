pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Token.sol";
import "./Managed.sol";


contract Ticket is ERC721Token, Managed {

    struct TicketDetails {
        uint256 resellProfitShare;
        uint256 percentageAbsMax;
        uint256 initialPrice;
        uint256 previousPrice;
        uint256 resalePrice;
    }

    mapping(uint256 => TicketDetails) public ticketsDetails;

    constructor(
        address _management,
        string _name,
        string _symbol
    )
        public
        ERC721Token(_name, _symbol)
        Managed(_management)
    {
    }

    function createTicket(
        address _tokenOwner,
        uint256 _initialPrice,
        uint256 _resellProfitShare,
        uint256 _percentageAbsMax
    )
        public
        requirePermission(CAN_SELL_TICKETS)
        canCallOnlyRegisteredContract(CONTRACT_MARKETPLACE)
        returns (uint256 _ticketId)
    {
        require(
            management.isContract(_tokenOwner) == false &&
            _percentageAbsMax >= _resellProfitShare,
            ERROR_ACCESS_DENIED
        );

        _ticketId = allTokens.length;
        _mint(_tokenOwner, _ticketId);

        ticketsDetails[_ticketId] = TicketDetails({
            resellProfitShare: _resellProfitShare,
            percentageAbsMax: _percentageAbsMax,
            initialPrice: _initialPrice,
            previousPrice: _initialPrice,
            resalePrice: 0
        });
    }

    function resellTicket(
        uint256 _ticketId,
        address _newTicketOwner
    )
        public
        requirePermission(CAN_SELL_TICKETS)
        canCallOnlyRegisteredContract(CONTRACT_MARKETPLACE)
        returns (address _previousTicketOwner)
    {
        require(
            isForResale(_ticketId) == true &&
            management.isContract(_newTicketOwner) == false,
            ERROR_ACCESS_DENIED
        );

        _previousTicketOwner = ownerOf(_ticketId);

        removeTokenFrom(_previousTicketOwner, _ticketId);
        addTokenTo(_newTicketOwner, _ticketId);

        ticketsDetails[_ticketId].previousPrice =
            ticketsDetails[_ticketId].resalePrice;
        ticketsDetails[_ticketId].resalePrice = 0;
    }

    function setResalePrice(
        uint256 _ticketId,
        uint256 _resalePrice
    )
        public
    {
        require(
            ownerOf(_ticketId) == msg.sender &&
            (_resalePrice == 0 || _resalePrice > ticketsDetails[_ticketId].previousPrice),
            ERROR_INVALID_INPUT
        );

        ticketsDetails[_ticketId].resalePrice = _resalePrice;
    }

    function burnTicket(address _holder, uint256 _tokenId)
        public
        requirePermission(CAN_BURN_TICKETS)
        canCallOnlyRegisteredContract(CONTRACT_MARKETPLACE)
        returns (uint256)
    {
        require(
            exists(_tokenId),
            ERROR_INVALID_INPUT
        );

        _burn(_holder, _tokenId);
        delete ticketsDetails[_tokenId];
    }

    function approve(address, uint256) public {
        require(false, ERROR_ACCESS_DENIED);
    }

    function setApprovalForAll(address, bool) public {
        require(false, ERROR_ACCESS_DENIED);
    }

    function transferFrom(
        address,
        address,
        uint256
    )
        public
    {
        require(false, ERROR_ACCESS_DENIED);
    }

    function isForResale(
        uint256 _ticketId
    )
        public
        view
        returns (bool)
    {
        require(
            exists(_ticketId),
            ERROR_INVALID_INPUT
        );

        return ticketsDetails[_ticketId].resalePrice != 0 ? true : false;
    }

    function getCustomerTicketsIds(
        address _customer
    )
        public
        view
        returns(uint256[] _ticketsIds)
    {
        return ownedTokens[_customer];
    }

    function getTicket(
        uint256 _ticketId
    )
        public
        view
        returns(
            address _ticketOwner,
            uint256 _resellProfitShare,
            uint256 _percentageAbsMax,
            uint256 _initialPrice,
            uint256 _previousPrice,
            uint256 _resalePrice
        )
    {
        require(
            exists(_ticketId),
            ERROR_INVALID_INPUT
        );

        TicketDetails storage ticketDetails = ticketsDetails[_ticketId];

        return(
            ownerOf(_ticketId),
            ticketDetails.resellProfitShare,
            ticketDetails.percentageAbsMax,
            ticketDetails.initialPrice,
            ticketDetails.previousPrice,
            ticketDetails.resalePrice
        );
    }
}