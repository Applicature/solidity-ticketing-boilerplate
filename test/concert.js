const utils = require("./utils");
const BigNumber = require("bignumber.js");

const CAN_SELL_TICKETS = 0;
const CAN_MAKE_REFUND = 1;
const CAN_UPDATE_EVENT = 2;
const CAN_ADD_EVENTS = 5;

const CONTRACT_EVENT = 0;
const CONTRACT_MARKETPLACE = 1;

const Management = artifacts.require("contracts/Management.sol");
const Event = artifacts.require("contracts/tests/EventTest.sol");
const eventStart = parseInt(new Date().getTime() / 1000) + 3600;

contract("Event", accounts => {
    let management;
    let eventInstance;

    beforeEach(async () => {
        management = await Management.new();
        eventInstance = await Event.new(management.address);
    });

    describe("check createEvent", () => {
        it("should successfully create event", async () => {
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(100, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            const ticketInstance = accounts[1];
            await management.registerNewEvent(0, accounts[0], ticketInstance);

            const event = await eventInstance.getEvent.call(0);

            await assert.equal(event[0], accounts[0], "event has wrong owner");
            await assert.equal(event[1], 100, "event has wrong ticketsAmount");
            await assert.equal(event[2], 0, "event has wrong soldTicketsAmount");
            await assert.equal(event[3], 0, "event has wrong collectedFunds");
            await assert.equal(event[4], eventStart, "event has wrong startTime");
        });

        it("should fail as caller has no permissions", async () => {
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(100, eventStart)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");

            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await eventInstance.createEvent(100, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");
        });

        it("should fail as caller is not registered", async () => {
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(100, eventStart)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);
            await eventInstance.createEvent(100, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");
        });

        it("should fail as ticketsAmount is 0", async () => {
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(0, eventStart)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");

            await eventInstance.createEvent(100, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");
        });

        it("should fail as startTime is less than now", async () => {
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(100, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");

            await eventInstance.createEvent(100, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");
        });
    });

    describe("check updateEvent", () => {
        it("should successfully update event", async () => {
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(100, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            const ticketInstance = accounts[1];
            await management.registerNewEvent(0, accounts[0], ticketInstance);

            let event = await eventInstance.getEvent.call(0);
            await assert.equal(event[1], 100, "event has wrong ticketsAmount");

            await eventInstance.updateEvent(0, 200, eventStart)
                .then(utils.receiptShouldSucceed);
            event = await eventInstance.getEvent.call(0);
            await assert.equal(event[1], 200, "event has wrong ticketsAmount");
        });

        it("should fail as caller is not an owner", async () => {
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(100, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            const ticketInstance = accounts[1];
            await management.registerNewEvent(0, accounts[1], ticketInstance);

            let event = await eventInstance.getEvent.call(0);
            await assert.equal(event[0], accounts[1], "event has wrong owner");
            await assert.equal(event[1], 100, "event has wrong ticketsAmount");

            await eventInstance.updateEvent(0, 200, eventStart)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            event = await eventInstance.getEvent.call(0);
            await assert.equal(event[1].valueOf(), 100, "event has wrong ticketsAmount");

            await eventInstance.updateEvent(0, 200, eventStart, { from: accounts[1] })
                .then(utils.receiptShouldSucceed);
            event = await eventInstance.getEvent.call(0);
            await assert.equal(event[1], 200, "event has wrong ticketsAmount");
        });

        it("should fail as soldTicketsAmount is bigger than new ticketsAmount", async () => {
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(100, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            const ticketInstance = accounts[1];
            await management.registerNewEvent(0, accounts[0], ticketInstance);

            let event = await eventInstance.getEvent.call(0);
            await assert.equal(event[1], 100, "event has wrong ticketsAmount");

            await eventInstance.updateSoldTickets(0, 60)
                .then(utils.receiptShouldSucceed);
            await eventInstance.updateEvent(0, 50, eventStart)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(event[1], 100, "event has wrong ticketsAmount");

            await eventInstance.updateEvent(0, 70, eventStart)
                .then(utils.receiptShouldSucceed);
            event = await eventInstance.getEvent.call(0);
            await assert.equal(event[1], 70, "event has wrong ticketsAmount");
        });

        it("should fail as new startTime is less than now", async () => {
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(100, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            const ticketInstance = accounts[1];
            await management.registerNewEvent(0, accounts[0], ticketInstance);

            let event = await eventInstance.getEvent.call(0);
            await assert.equal(event[4].valueOf(), eventStart, "event has wrong startTime");

            await eventInstance.updateEvent(0, 100, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            event = await eventInstance.getEvent.call(0);
            await assert.equal(event[4].valueOf(), eventStart, "event has wrong startTime");

            await eventInstance.updateEvent(0, 100, new BigNumber(eventStart).add(10))
                .then(utils.receiptShouldSucceed);
            event = await eventInstance.getEvent.call(0);
            await assert.equal(event[4].valueOf(), new BigNumber(eventStart).add(10),
                "event has wrong startTime");
        });

        it("should fail as event has started", async () => {
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(100, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            const ticketInstance = accounts[1];
            await management.registerNewEvent(0, accounts[0], ticketInstance);

            let event = await eventInstance.getEvent.call(0);
            await assert.equal(event[4].valueOf(), eventStart, "event has wrong startTime");

            await eventInstance.updateStartTime(0, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventHasBeenStarted.call(0), true, "event has not started");

            await eventInstance.updateEvent(0, 50, eventStart)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(event[1].valueOf(), 100, "event has wrong ticketsAmount");

            await eventInstance.updateStartTime(0, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventHasBeenStarted.call(0), false, "event has started");

            await eventInstance.updateEvent(0, 50, new BigNumber(eventStart).add(10))
                .then(utils.receiptShouldSucceed);
            event = await eventInstance.getEvent.call(0);
            await assert.equal(event[1], 50, "event has wrong ticketsAmount");
        });
    });

    describe("check sellTicket", () => {
        it("should successfully sell a ticket", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(1, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await assert.equal(await eventInstance.getAvailableTickets.call(0), 1,
                "availableTicketsAmount is not equal");
            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await assert.equal(await eventInstance.getAvailableTickets.call(0), 0,
                "availableTicketsAmount is not equal");
            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
        });

        it("should fail as event does not exist", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await eventInstance.createEvent(1, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await assert.equal(await eventInstance.getAvailableTickets.call(0), 1,
                "availableTicketsAmount is not equal");
            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as caller is not registered", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(1, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[1]);
            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);
            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as caller has no permissions", async () => {
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(1, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as event has already started", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(1, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await assert.equal(await eventInstance.getAvailableTickets.call(0), 1,
                "availableTicketsAmount is not equal");

            await eventInstance.updateStartTime(0, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventHasBeenStarted.call(0), true, "event has not started");
            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await eventInstance.updateStartTime(0, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventHasBeenStarted.call(0), false, "event has started");
            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);
        });
    });

    describe("check refundTicket", () => {
        it("should successfully refund a ticket", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_MAKE_REFUND, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(1, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await assert.equal(await eventInstance.getAvailableTickets.call(0), 1,
                "availableTicketsAmount is not equal");
            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await eventInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as event has already started", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_MAKE_REFUND, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(1, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await assert.equal(await eventInstance.getAvailableTickets.call(0), 1,
                "availableTicketsAmount is not equal");
            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await eventInstance.updateStartTime(0, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventHasBeenStarted.call(0), true, "event has not started");
            await eventInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await eventInstance.updateStartTime(0, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventHasBeenStarted.call(0), false, "event has started");
            await eventInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as soldTicketsAmount is less than tickets to refund", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_MAKE_REFUND, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(1, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await eventInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await eventInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as collectedFundsAmount is less than funds to refund", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_MAKE_REFUND, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(1, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await eventInstance.refundTicket(0, 1, 110)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await eventInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as caller has no permissions", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(1, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await eventInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await management.setPermission(accounts[0], CAN_MAKE_REFUND, true);
            await eventInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as caller is not registered", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.setPermission(accounts[0], CAN_MAKE_REFUND, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(1, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[1]);
            await eventInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);
            await eventInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldSucceed);
        });
    });

    describe("check withdrawCollectedFunds", () => {
        it("should successfully refund a ticket", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_UPDATE_EVENT, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(1, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await assert.equal(await eventInstance.getAvailableTickets.call(0), 1,
                "availableTicketsAmount is not equal");
            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await assert.equal(await eventInstance.eventHasBeenStarted.call(0), false, "event has started");
            await eventInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await eventInstance.updateStartTime(0, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventHasBeenStarted.call(0), true, "event has not started");

            await eventInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldSucceed);
            await eventInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
        });

        it("should fail as caller has no permissions", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(1, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await eventInstance.updateStartTime(0, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventHasBeenStarted.call(0), true, "event has not started");

            await eventInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await management.setPermission(accounts[0], CAN_UPDATE_EVENT, true);
            await eventInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as caller is not registered", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.setPermission(accounts[0], CAN_UPDATE_EVENT, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(1, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await eventInstance.updateStartTime(0, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventHasBeenStarted.call(0), true, "event has not started");

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[1]);
            await eventInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);
            await eventInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldSucceed);
        });
    });

    describe("check withdrawCollectedFunds", () => {
        it("should successfully withdraw funds", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_UPDATE_EVENT, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(1, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await assert.equal(await eventInstance.getAvailableTickets.call(0), 1,
                "availableTicketsAmount is not equal");
            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await assert.equal(await eventInstance.eventHasBeenStarted.call(0), false, "event has started");
            await eventInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await eventInstance.updateStartTime(0, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventHasBeenStarted.call(0), true, "event has not started");

            await eventInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldSucceed);
            await eventInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
        });
    });

    describe("check getters", () => {
        it("check isInitialized", async () => {
            await assert.equal(await eventInstance.isInitialized.call(), false, "event is registered");

            await management.registerContract(CONTRACT_EVENT, eventInstance.address);
            await assert.equal(await eventInstance.isInitialized.call(), true, "event is not registered");

            eventInstance = await Event.new(0);
            await assert.equal(await eventInstance.isInitialized.call(), false, "event is registered");
        });

        it("check getCollectedFunds", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(1, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await eventInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await assert.equal(await eventInstance.eventHasBeenStarted.call(0), false, "event has started");
            await eventInstance.getCollectedFunds(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await eventInstance.updateStartTime(0, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventHasBeenStarted.call(0), true, "event has not started");

            await assert.equal(await eventInstance.getCollectedFunds(0), 100, "collectedFunds is not equal");
        });
    });
});
