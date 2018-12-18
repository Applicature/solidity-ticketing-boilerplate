pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Managed.sol";
import "./Ticket.sol";


contract FundsDistributor is Managed {

    using SafeMath for uint256;

    event FundsDistributed(
        address _organizer,
        uint256 _organizersProfit
    );

    constructor(address _management) public Managed(_management){}

    function distributeResaleFunds(
        uint256 _concertId,
        uint256 _ticketId
    )
        public
        payable
        requirePermission(CAN_DISTRIBUTE_FUNDS)
        canCallOnlyRegisteredContract(CONTRACT_MARKETPLACE)
    {
        Ticket ticket = Ticket(management.ticketRegistry(_concertId));

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
        ) = ticket.getTicket(_ticketId);

        require(
            resalePrice == msg.value,
            ERROR_NOT_AVAILABLE
        );

        uint256 organizersProfit = (resalePrice.sub(previousPrice))
            .mul(resellProfitShare)
            .div(percentageAbsMax);

        address organizer = management.concertOrganizersRegistry(_concertId);
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
