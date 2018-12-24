const utils = require("./utils");
const BigNumber = require("bignumber.js");

const CAN_SELL_TICKETS = 0;
const CAN_ADD_EVENTS = 5;
const CAN_DISTRIBUTE_FUNDS = 6;

const CONTRACT_MARKETPLACE = 1;
const CONTRACT_DISTRIBUTOR = 2;

const Management = artifacts.require("contracts/Management.sol");
const Ticket = artifacts.require("contracts/Ticket.sol");
const Distributor = artifacts.require("contracts/FundsDistributor.sol");
const Event = artifacts.require("contracts/Event.sol");

const eventStart = parseInt(new Date().getTime() / 1000) + 3600;

contract("Distributor", accounts => {
    let management;
    let distributor;
    let eventInstance;
    let ticketInstance;

    beforeEach(async () => {
        management = await Management.new();
        distributor = await Distributor.new(management.address);
        eventInstance = await Event.new(management.address);
        ticketInstance = await Ticket.new(management.address, "TICKET", "TKT");
    });

    describe("check distributeResaleFunds", () => {
        it("should successfully distribute resale funds", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_DISTRIBUTE_FUNDS, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(100, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await management.registerNewEvent(0, accounts[2], ticketInstance.address);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 1e18, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await ticketInstance.setResalePrice(0, 2e18, { from: accounts[1] }).then(utils.receiptShouldSucceed);

            const previousOrganizerBalance = await utils.getEtherBalance(accounts[2]).valueOf();
            const previousOldOwnerBalance = await utils.getEtherBalance(accounts[1]).valueOf();

            await distributor.distributeResaleFunds(0, 0, { value: web3.toWei(2, "ether") })
                .then(utils.receiptShouldSucceed);

            const currentOrganizerBalance = await utils.getEtherBalance(accounts[2]).valueOf();
            const currentOldOwnerBalance = await utils.getEtherBalance(accounts[1]).valueOf();

            await assert.equal(new BigNumber(previousOrganizerBalance).add((2e18 - 1e18) * 10 / 100).valueOf(),
                currentOrganizerBalance, "old owner eth balance is not equal");
            await assert.equal(new BigNumber(previousOldOwnerBalance).add(2e18 - (2e18 - 1e18) * 10 / 100).valueOf(),
                currentOldOwnerBalance, "old owner eth balance is not equal");
        });

        it("should fail as there is no such event", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_DISTRIBUTE_FUNDS, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(100, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 1e18, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await ticketInstance.setResalePrice(0, 2e18, { from: accounts[1] }).then(utils.receiptShouldSucceed);

            await distributor.distributeResaleFunds(0, 0, { value: web3.toWei(2, "ether") })
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
        });

        it("should fail as ticket resalePrice and msg.value are not equal", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_DISTRIBUTE_FUNDS, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(100, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await management.registerNewEvent(0, accounts[2], ticketInstance.address);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 1e18, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await ticketInstance.setResalePrice(0, 3e18, { from: accounts[1] }).then(utils.receiptShouldSucceed);

            await distributor.distributeResaleFunds(0, 0, { value: web3.toWei(2, "ether") })
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
        });

        it("should fail as caller has no permissions", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(100, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await management.registerNewEvent(0, accounts[2], ticketInstance.address);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 1e18, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await ticketInstance.setResalePrice(0, 2e18, { from: accounts[1] }).then(utils.receiptShouldSucceed);

            await distributor.distributeResaleFunds(0, 0, { value: web3.toWei(2, "ether") })
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await management.setPermission(accounts[0], CAN_DISTRIBUTE_FUNDS, true);
            await distributor.distributeResaleFunds(0, 0, { value: web3.toWei(2, "ether") })
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as caller is not registered", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_DISTRIBUTE_FUNDS, true);
            await management.setPermission(accounts[0], CAN_ADD_EVENTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await eventInstance.createEvent(100, eventStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            await management.registerNewEvent(0, accounts[2], ticketInstance.address);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 1e18, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await ticketInstance.setResalePrice(0, 2e18, { from: accounts[1] }).then(utils.receiptShouldSucceed);

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[1]);
            await distributor.distributeResaleFunds(0, 0, { value: web3.toWei(2, "ether") })
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);
            await distributor.distributeResaleFunds(0, 0, { value: web3.toWei(2, "ether") })
                .then(utils.receiptShouldSucceed);
        });
    });

    describe("check isInitialized", () => {
        it("check isInitialized", async () => {
            await assert.equal(await distributor.isInitialized.call(), false, "distributor is registered");

            await management.registerContract(CONTRACT_DISTRIBUTOR, distributor.address);
            await assert.equal(await distributor.isInitialized.call(), true, "distributor is not registered");

            distributor = await Distributor.new(0);
            await assert.equal(await distributor.isInitialized.call(), false, "distributor is registered");
        });
    });
});
