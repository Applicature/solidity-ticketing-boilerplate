pragma solidity ^0.4.24;


contract Constants {

    // Permissions bit constants
    uint256 public constant CAN_SELL_TICKETS = 0;
    uint256 public constant CAN_MAKE_REFUND = 1;
    uint256 public constant CAN_UPDATE_EVENT = 2;
    uint256 public constant CAN_BURN_TICKETS = 3;
    uint256 public constant CAN_SIGN_TRANSACTION = 4;
    uint256 public constant CAN_ADD_EVENTS = 5;
    uint256 public constant CAN_DISTRIBUTE_FUNDS = 6;

    // Contract Registry keys
    uint256 public constant CONTRACT_EVENT = 0;
    uint256 public constant CONTRACT_MARKETPLACE = 1;
    uint256 public constant CONTRACT_DISTRIBUTOR = 2;

    // Other constants
    uint256 public constant SECTION_ROW_SEAT = 3;

    // Error messages
    string public constant ERROR_ACCESS_DENIED = "ERROR_ACCESS_DENIED";
    string public constant ERROR_INVALID_INPUT = "ERROR_INVALID_INPUT";
    string public constant ERROR_NO_CONTRACT = "ERROR_NO_CONTRACT";
    string public constant ERROR_NOT_AVAILABLE = "ERROR_NOT_AVAILABLE";
}