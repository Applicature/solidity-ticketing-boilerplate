pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Managed.sol";
import "./EventTicketsRegistry.sol";


contract FundsDistributor is Managed {

    using SafeMath for uint256;

    event FundsDistributed(
        address _organizer,
        uint256 _organizersProfit
    );

    constructor(address _management) public Managed(_management){}

    function distributeResaleFunds(
        uint256 _eventId,
        uint256 _ticketId
    )
        public
        payable
        requirePermission(CAN_DISTRIBUTE_FUNDS)
        canCallOnlyRegisteredContract(CONTRACT_MARKETPLACE)
    {
        EventTicketsRegistry ticketsRegistry =
            EventTicketsRegistry(management.ticketRegistry(_eventId));

        address ticketOwner;
        uint256 resellProfitShare;
        uint256 percentageAbsMax;
        uint256 initialPrice;
        uint256 previousPrice;
        uint256 resalePrice;

        (
            ticketOwner,
            resellProfitShare,
            percentageAbsMax,
            initialPrice,
            previousPrice,
            resalePrice
        ) = ticketsRegistry.getTicket(_ticketId);

        // @TODO: move condition to marketplace logic or to event logic
        require(
            resalePrice == msg.value,
            ERROR_NOT_AVAILABLE
        );

        uint256 organizersProfit = (resalePrice.sub(previousPrice))
            .mul(resellProfitShare)
            .div(percentageAbsMax);

        address organizer = management.eventOrganizersRegistry(_eventId);
        organizer.transfer(organizersProfit);

        ticketOwner.transfer(resalePrice.sub(organizersProfit));

        emit FundsDistributed(
            organizer,
            organizersProfit
        );
    }

    function isInitialized()
        public
        view
        returns (bool)
    {
        return (
            address(management) != address(0) &&
            management.contractRegistry(CONTRACT_DISTRIBUTOR) != address(0)
        );
    }
}

