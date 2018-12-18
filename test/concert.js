const utils = require("./utils");
const BigNumber = require("bignumber.js");

const CAN_SELL_TICKETS = 0;
const CAN_MAKE_REFUND = 1;
const CAN_UPDATE_CONCERT = 2;
const CAN_ADD_CONCERTS = 5;

const CONTRACT_CONCERT = 0;
const CONTRACT_MARKETPLACE = 1;

const Management = artifacts.require("contracts/Management.sol");
const Concert = artifacts.require("contracts/tests/ConcertTest.sol");
const concertStart = parseInt(new Date().getTime() / 1000) + 3600;

contract("Concert", accounts => {
    let management;
    let concertInstance;

    beforeEach(async () => {
        management = await Management.new();
        concertInstance = await Concert.new(management.address);
    });

    describe("check createConcert", () => {
        it("should successfully create concert", async () => {
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(100, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            const ticketInstance = accounts[1];
            await management.registerNewConcert(0, accounts[0], ticketInstance);

            const concert = await concertInstance.getConcert.call(0);

            await assert.equal(concert[0], accounts[0], "concert has wrong owner");
            await assert.equal(concert[1], 100, "concert has wrong ticketsAmount");
            await assert.equal(concert[2], 0, "concert has wrong soldTicketsAmount");
            await assert.equal(concert[3], 0, "concert has wrong collectedFunds");
            await assert.equal(concert[4], concertStart, "concert has wrong startTime");
        });

        it("should fail as caller has no permissions", async () => {
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(100, concertStart)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");

            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await concertInstance.createConcert(100, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");
        });

        it("should fail as caller is not registered", async () => {
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(100, concertStart)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);
            await concertInstance.createConcert(100, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");
        });

        it("should fail as ticketsAmount is 0", async () => {
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(0, concertStart)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");

            await concertInstance.createConcert(100, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");
        });

        it("should fail as startTime is less than now", async () => {
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(100, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");

            await concertInstance.createConcert(100, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");
        });
    });

    describe("check updateConcert", () => {
        it("should successfully update concert", async () => {
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(100, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            const ticketInstance = accounts[1];
            await management.registerNewConcert(0, accounts[0], ticketInstance);

            let concert = await concertInstance.getConcert.call(0);
            await assert.equal(concert[1], 100, "concert has wrong ticketsAmount");

            await concertInstance.updateConcert(0, 200, concertStart)
                .then(utils.receiptShouldSucceed);
            concert = await concertInstance.getConcert.call(0);
            await assert.equal(concert[1], 200, "concert has wrong ticketsAmount");
        });

        it("should fail as caller is not an owner", async () => {
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(100, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            const ticketInstance = accounts[1];
            await management.registerNewConcert(0, accounts[1], ticketInstance);

            let concert = await concertInstance.getConcert.call(0);
            await assert.equal(concert[0], accounts[1], "concert has wrong owner");
            await assert.equal(concert[1], 100, "concert has wrong ticketsAmount");

            await concertInstance.updateConcert(0, 200, concertStart)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            concert = await concertInstance.getConcert.call(0);
            await assert.equal(concert[1].valueOf(), 100, "concert has wrong ticketsAmount");

            await concertInstance.updateConcert(0, 200, concertStart, { from: accounts[1] })
                .then(utils.receiptShouldSucceed);
            concert = await concertInstance.getConcert.call(0);
            await assert.equal(concert[1], 200, "concert has wrong ticketsAmount");
        });

        it("should fail as soldTicketsAmount is bigger than new ticketsAmount", async () => {
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(100, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            const ticketInstance = accounts[1];
            await management.registerNewConcert(0, accounts[0], ticketInstance);

            let concert = await concertInstance.getConcert.call(0);
            await assert.equal(concert[1], 100, "concert has wrong ticketsAmount");

            await concertInstance.updateSoldTickets(0, 60)
                .then(utils.receiptShouldSucceed);
            await concertInstance.updateConcert(0, 50, concertStart)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(concert[1], 100, "concert has wrong ticketsAmount");

            await concertInstance.updateConcert(0, 70, concertStart)
                .then(utils.receiptShouldSucceed);
            concert = await concertInstance.getConcert.call(0);
            await assert.equal(concert[1], 70, "concert has wrong ticketsAmount");
        });

        it("should fail as new startTime is less than now", async () => {
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(100, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            const ticketInstance = accounts[1];
            await management.registerNewConcert(0, accounts[0], ticketInstance);

            let concert = await concertInstance.getConcert.call(0);
            await assert.equal(concert[4].valueOf(), concertStart, "concert has wrong startTime");

            await concertInstance.updateConcert(0, 100, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            concert = await concertInstance.getConcert.call(0);
            await assert.equal(concert[4].valueOf(), concertStart, "concert has wrong startTime");

            await concertInstance.updateConcert(0, 100, new BigNumber(concertStart).add(10))
                .then(utils.receiptShouldSucceed);
            concert = await concertInstance.getConcert.call(0);
            await assert.equal(concert[4].valueOf(), new BigNumber(concertStart).add(10),
                "concert has wrong startTime");
        });

        it("should fail as concert has started", async () => {
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(100, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            const ticketInstance = accounts[1];
            await management.registerNewConcert(0, accounts[0], ticketInstance);

            let concert = await concertInstance.getConcert.call(0);
            await assert.equal(concert[4].valueOf(), concertStart, "concert has wrong startTime");

            await concertInstance.updateStartTime(0, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertHasStarted.call(0), true, "concert has not started");

            await concertInstance.updateConcert(0, 50, concertStart)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(concert[1].valueOf(), 100, "concert has wrong ticketsAmount");

            await concertInstance.updateStartTime(0, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertHasStarted.call(0), false, "concert has started");

            await concertInstance.updateConcert(0, 50, new BigNumber(concertStart).add(10))
                .then(utils.receiptShouldSucceed);
            concert = await concertInstance.getConcert.call(0);
            await assert.equal(concert[1], 50, "concert has wrong ticketsAmount");
        });
    });

    describe("check sellTicket", () => {
        it("should successfully sell a ticket", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(1, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            await assert.equal(await concertInstance.getAvailableTickets.call(0), 1,
                "availableTicketsAmount is not equal");
            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await assert.equal(await concertInstance.getAvailableTickets.call(0), 0,
                "availableTicketsAmount is not equal");
            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
        });

        it("should fail as concert does not exist", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await concertInstance.createConcert(1, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            await assert.equal(await concertInstance.getAvailableTickets.call(0), 1,
                "availableTicketsAmount is not equal");
            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as caller is not registered", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(1, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[1]);
            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);
            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as caller has no permissions", async () => {
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(1, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as concert has already started", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(1, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            await assert.equal(await concertInstance.getAvailableTickets.call(0), 1,
                "availableTicketsAmount is not equal");

            await concertInstance.updateStartTime(0, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertHasStarted.call(0), true, "concert has not started");
            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await concertInstance.updateStartTime(0, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertHasStarted.call(0), false, "concert has started");
            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);
        });
    });

    describe("check refundTicket", () => {
        it("should successfully refund a ticket", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_MAKE_REFUND, true);
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(1, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            await assert.equal(await concertInstance.getAvailableTickets.call(0), 1,
                "availableTicketsAmount is not equal");
            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await concertInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as concert has already started", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_MAKE_REFUND, true);
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(1, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            await assert.equal(await concertInstance.getAvailableTickets.call(0), 1,
                "availableTicketsAmount is not equal");
            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await concertInstance.updateStartTime(0, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertHasStarted.call(0), true, "concert has not started");
            await concertInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await concertInstance.updateStartTime(0, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertHasStarted.call(0), false, "concert has started");
            await concertInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as soldTicketsAmount is less than tickets to refund", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_MAKE_REFUND, true);
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(1, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            await concertInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await concertInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as collectedFundsAmount is less than funds to refund", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_MAKE_REFUND, true);
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(1, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await concertInstance.refundTicket(0, 1, 110)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await concertInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as caller has no permissions", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(1, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await concertInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await management.setPermission(accounts[0], CAN_MAKE_REFUND, true);
            await concertInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as caller is not registered", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.setPermission(accounts[0], CAN_MAKE_REFUND, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(1, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[1]);
            await concertInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);
            await concertInstance.refundTicket(0, 1, 90)
                .then(utils.receiptShouldSucceed);
        });
    });

    describe("check withdrawCollectedFunds", () => {
        it("should successfully refund a ticket", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_UPDATE_CONCERT, true);
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(1, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            await assert.equal(await concertInstance.getAvailableTickets.call(0), 1,
                "availableTicketsAmount is not equal");
            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await assert.equal(await concertInstance.concertHasStarted.call(0), false, "concert has started");
            await concertInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await concertInstance.updateStartTime(0, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertHasStarted.call(0), true, "concert has not started");

            await concertInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldSucceed);
            await concertInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
        });

        it("should fail as caller has no permissions", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(1, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await concertInstance.updateStartTime(0, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertHasStarted.call(0), true, "concert has not started");

            await concertInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await management.setPermission(accounts[0], CAN_UPDATE_CONCERT, true);
            await concertInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldSucceed);
        });

        it("should fail as caller is not registered", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.setPermission(accounts[0], CAN_UPDATE_CONCERT, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(1, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await concertInstance.updateStartTime(0, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertHasStarted.call(0), true, "concert has not started");

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[1]);
            await concertInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);
            await concertInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldSucceed);
        });
    });

    describe("check withdrawCollectedFunds", () => {
        it("should successfully withdraw funds", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_UPDATE_CONCERT, true);
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(1, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            await assert.equal(await concertInstance.getAvailableTickets.call(0), 1,
                "availableTicketsAmount is not equal");
            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await assert.equal(await concertInstance.concertHasStarted.call(0), false, "concert has started");
            await concertInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await concertInstance.updateStartTime(0, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertHasStarted.call(0), true, "concert has not started");

            await concertInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldSucceed);
            await concertInstance.withdrawCollectedFunds(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
        });
    });

    describe("check getters", () => {
        it("check isInitialized", async () => {
            await assert.equal(await concertInstance.isInitialized.call(), false, "concert is registered");

            await management.registerContract(CONTRACT_CONCERT, concertInstance.address);
            await assert.equal(await concertInstance.isInitialized.call(), true, "concert is not registered");

            concertInstance = await Concert.new(0);
            await assert.equal(await concertInstance.isInitialized.call(), false, "concert is registered");
        });

        it("check getCollectedFunds", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_ADD_CONCERTS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await concertInstance.concertExists.call(0), false, "concert exists");
            await concertInstance.createConcert(1, concertStart)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertExists.call(0), true, "concert does not exist");

            await concertInstance.sellTicket(0, 1, 100)
                .then(utils.receiptShouldSucceed);

            await assert.equal(await concertInstance.concertHasStarted.call(0), false, "concert has started");
            await concertInstance.getCollectedFunds(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await concertInstance.updateStartTime(0, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await concertInstance.concertHasStarted.call(0), true, "concert has not started");

            await assert.equal(await concertInstance.getCollectedFunds(0), 100, "collectedFunds is not equal");
        });
    });
});
