pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./Constants.sol";


contract Management is Ownable, Constants {

    // Contract Registry
    mapping(uint256 => address) public contractRegistry;

    mapping(address => uint256[]) public eventsRegistry;

    mapping(uint256 => address) public eventOrganizersRegistry;

    mapping(uint256 => address) public ticketRegistry;

    // Permissions
    mapping(address => mapping(uint256 => bool)) public permissions;

    event PermissionsSet(address subject, uint256 permission, bool value);

    event ContractRegistered(uint256 _key, address _target);

    event EventRegistered(address _owner, uint256 _eventId);

    event TicketRegistered(uint256 _eventId, address _ticket);

    function setPermission(
        address _address,
        uint256 _permission,
        bool _value
    )
        public
        onlyOwner
    {
        permissions[_address][_permission] = _value;

        emit PermissionsSet(_address, _permission, _value);
    }

    function registerContract(
        uint256 _key,
        address _target
    )
        public
        onlyOwner
    {
        contractRegistry[_key] = _target;
        emit ContractRegistered(_key, _target);
    }

    function registerNewEvent(
        uint256 _eventId,
        address _organizer,
        address _ticket
    )
        public
    {
        require(
            permissions[msg.sender][CAN_ADD_EVENTS] &&
            contractRegistry[CONTRACT_MARKETPLACE] == msg.sender,
            ERROR_ACCESS_DENIED
        );

        eventsRegistry[msg.sender].push(_eventId);
        eventOrganizersRegistry[_eventId] = _organizer;
        emit EventRegistered(_organizer, _eventId);

        ticketRegistry[_eventId] = _ticket;
        emit TicketRegistered(_eventId, _ticket);
    }

    function isContract(address _addr) public view returns (bool) {
        uint32 size;
        /* solium-disable-next-line security/no-inline-assembly */
        assembly {
            size := extcodesize(_addr)
        }
        return (size > 0);
    }
}