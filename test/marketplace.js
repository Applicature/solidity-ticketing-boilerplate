const abi = require("ethereumjs-abi");
const utils = require("./utils");
const BigNumber = require("bignumber.js");
const BN = require("bn.js");

const CAN_SELL_TICKETS = 0;
const CAN_MAKE_REFUND = 1;
const CAN_UPDATE_EVENT = 2;
const CAN_BURN_TICKETS = 3;
const CAN_SIGN_TRANSACTION = 4;
const CAN_ADD_EVENTS = 5;
const CAN_DISTRIBUTE_FUNDS = 6;

const CONTRACT_EVENT = 0;
const CONTRACT_MARKETPLACE = 1;
const CONTRACT_DISTRIBUTOR = 2;

const Management = artifacts.require("contracts/Management.sol");
const Ticket = artifacts.require("contracts/EventTicketsRegistry.sol");
const Event = artifacts.require("contracts/tests/EventTest.sol");
const Distributor = artifacts.require("contracts/FundsDistributor.sol");
const Marketplace = artifacts.require("contracts/Marketplace.sol");

const precision = new BigNumber("1000000000000000000");
const eventStart = parseInt(new Date().getTime() / 1000) + 3600;

async function makeTransaction (
    instance,
    eventId,
    resellProfitShare,
    percentageAbsMax,
    seat,
    initialPrice,
    sign,
    senderAddress
) {
    const h = abi.soliditySHA3(
        ["address", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
        [
            new BN(senderAddress.substr(2), 16),
            eventId,
            resellProfitShare,
            percentageAbsMax,
            seat[0],
            seat[1],
            seat[2],
            initialPrice
        ]
    );
    const sig = web3.eth.sign(sign, h.toString("hex")).slice(2);
    const r = `0x${sig.slice(0, 64)}`;
    const s = `0x${sig.slice(64, 128)}`;
    const v = web3.toDecimal(sig.slice(128, 130)) + 27;
    const data = abi.simpleEncode(
        "buyTicketFromOrganizer(uint256,uint256,uint256,uint256[3],uint256,uint8,bytes32,bytes32)",
        eventId,
        resellProfitShare,
        percentageAbsMax,
        seat,
        initialPrice,
        v,
        r,
        s
    );

    return instance.sendTransaction({ value: initialPrice, from: senderAddress, data: data.toString("hex") });
}

async function makeRefundTransaction (
    instance,
    eventId,
    ticketId,
    refundPercentage,
    percentageAbsMax,
    sign,
    senderAddress
) {
    const h = abi.soliditySHA3(
        ["address", "uint256", "uint256", "uint256", "uint256"],
        [new BN(senderAddress.substr(2), 16), eventId, ticketId, refundPercentage, percentageAbsMax]
    );
    const sig = web3.eth.sign(sign, h.toString("hex")).slice(2);
    const r = `0x${sig.slice(0, 64)}`;
    const s = `0x${sig.slice(64, 128)}`;
    const v = web3.toDecimal(sig.slice(128, 130)) + 27;
    const data = abi.simpleEncode(
        "refund(uint256,uint256,uint256,uint256,uint8,bytes32,bytes32)",
        eventId,
        ticketId,
        refundPercentage,
        percentageAbsMax,
        v,
        r,
        s
    );

    return instance.sendTransaction({ from: senderAddress, data: data.toString("hex") });
}

contract("Marketplace", accounts => {
    let management;
    let marketplace;
    let eventInstance;
    let distributor;

    beforeEach(async () => {
        management = await Management.new();
        marketplace = await Marketplace.new(management.address);
        eventInstance = await Event.new(management.address);
        distributor = await Distributor.new(management.address);
    });

    describe("check addNewEvent", () => {
        it("should successfully add new event", async () => {
            await management.setPermission(marketplace.address, CAN_ADD_EVENTS, true);
            await management.setPermission(marketplace.address, CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, marketplace.address);
            await management.registerContract(CONTRACT_EVENT, eventInstance.address);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await assert.equal(await management.ticketRegistry.call(0), 0, "ticketInstance is defined");

            await marketplace.addNewEvent("TICKET", "TKT", 100, eventStart).then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            const event = await eventInstance.getEvent.call(0);

            await assert.equal(event[0], accounts[0], "event has wrong owner");
            await assert.equal(event[1], 100, "event has wrong ticketsAmount");
            await assert.equal(event[2], 0, "event has wrong soldTicketsAmount");
            await assert.equal(event[3], 0, "event has wrong collectedFunds");
            await assert.equal(event[4], eventStart, "event has wrong startTime");

            await assert.notEqual(await management.ticketRegistry.call(0), 0, "ticketInstance is not defined");
        });

        it("should fail as event does not exist in registry", async () => {
            await management.setPermission(marketplace.address, CAN_ADD_EVENTS, true);
            await management.setPermission(marketplace.address, CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, marketplace.address);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await assert.equal(await management.ticketRegistry.call(0), 0, "ticketInstance is defined");

            await marketplace.addNewEvent("TICKET", "TKT", 100, eventStart)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");

            await assert.equal(await management.ticketRegistry.call(0), 0, "ticketInstance is defined");
        });
    });

    describe("check buyTicketFromOrganizer", () => {
        it("should successfully buy a ticket", async () => {
            await management.setPermission(marketplace.address, CAN_ADD_EVENTS, true);
            await management.setPermission(marketplace.address, CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, marketplace.address);
            await management.registerContract(CONTRACT_EVENT, eventInstance.address);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await assert.equal(await management.ticketRegistry.call(0), 0, "ticketInstance is defined");

            await marketplace.addNewEvent("TICKET", "TKT", 100, eventStart).then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            const event = await eventInstance.getEvent.call(0);

            await assert.equal(event.length, 5, "event does not exist");

            await assert.notEqual(await management.ticketRegistry.call(0), 0, "ticketInstance is not defined");

            const signAddress = accounts[1];
            await management.setPermission(signAddress, CAN_SIGN_TRANSACTION, true);

            await makeTransaction(
                marketplace,
                0,
                10,
                100,
                [1, 1, 1],
                new BigNumber("0.5").mul(precision).valueOf(),
                signAddress,
                accounts[0]
            ).then(utils.receiptShouldSucceed);

            const ticketAddress = await management.ticketRegistry.call(0);
            const ticketInstance = Ticket.at(ticketAddress);

            const ticket = await ticketInstance.getTicket.call(0);

            await assert.equal(ticket[0], accounts[0], "ticket has wrong owner");
            await assert.equal(ticket[1], 10, "ticket has wrong resellProfitShare");
            await assert.equal(ticket[2], 100, "ticket has wrong percentageAbsMax");
            await assert.equal(ticket[3], new BigNumber("0.5").mul(precision).valueOf(),
                "ticket has wrong initialPrice");
            await assert.equal(ticket[4], new BigNumber("0.5").mul(precision).valueOf(),
                "ticket has wrong previousPrice");
            await assert.equal(ticket[5], 0, "ticket has wrong resalePrice");
        });

        it("should fail as event contract is not registered", async () => {
            await management.setPermission(marketplace.address, CAN_ADD_EVENTS, true);
            await management.setPermission(marketplace.address, CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_EVENT, eventInstance.address);
            await management.registerContract(CONTRACT_MARKETPLACE, marketplace.address);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await assert.equal(await management.ticketRegistry.call(0), 0, "ticketInstance is defined");

            await marketplace.addNewEvent("TICKET", "TKT", 100, eventStart).then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            const event = await eventInstance.getEvent.call(0);

            await assert.equal(event.length, 5, "event does not exist");

            await assert.notEqual(await management.ticketRegistry.call(0), 0, "ticketInstance is not defined");

            const signAddress = accounts[1];
            await management.setPermission(signAddress, CAN_SIGN_TRANSACTION, true);

            await management.registerContract(CONTRACT_EVENT, 0);
            await makeTransaction(
                marketplace,
                0,
                10,
                100,
                [1, 1, 1],
                new BigNumber("0.5").mul(precision).valueOf(),
                signAddress,
                accounts[0]
            ).then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await management.registerContract(CONTRACT_EVENT, eventInstance.address);
            await makeTransaction(
                marketplace,
                0,
                10,
                100,
                [1, 1, 1],
                new BigNumber("0.5").mul(precision).valueOf(),
                signAddress,
                accounts[0]
            ).then(utils.receiptShouldSucceed);
        });
    });

    describe("check buyTicketFromReseller", () => {
        it("should successfully resell a ticket", async () => {
            await management.setPermission(marketplace.address, CAN_ADD_EVENTS, true);
            await management.setPermission(marketplace.address, CAN_SELL_TICKETS, true);
            await management.setPermission(marketplace.address, CAN_DISTRIBUTE_FUNDS, true);
            await management.registerContract(CONTRACT_DISTRIBUTOR, distributor.address);
            await management.registerContract(CONTRACT_MARKETPLACE, marketplace.address);
            await management.registerContract(CONTRACT_EVENT, eventInstance.address);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await assert.equal(await management.ticketRegistry.call(0), 0, "ticketInstance is defined");

            await marketplace.addNewEvent("TICKET", "TKT", 100, eventStart, { from: accounts[4] })
                .then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            const event = await eventInstance.getEvent.call(0);

            await assert.equal(event.length, 5, "event does not exist");

            await assert.notEqual(await management.ticketRegistry.call(0), 0, "ticketInstance is not defined");

            const signAddress = accounts[1];
            await management.setPermission(signAddress, CAN_SIGN_TRANSACTION, true);

            await makeTransaction(
                marketplace,
                0,
                10,
                100,
                [1, 1, 1],
                new BigNumber("0.5").mul(precision).valueOf(),
                signAddress,
                accounts[0]
            ).then(utils.receiptShouldSucceed);

            const ticketAddress = await management.ticketRegistry.call(0);
            const ticketInstance = Ticket.at(ticketAddress);

            await marketplace.buyTicketFromReseller(0, 0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            const previousOrganizerBalance = await utils.getEtherBalance(accounts[4]).valueOf();
            const previousOldOwnerBalance = await utils.getEtherBalance(accounts[0]).valueOf();

            let txCost;
            await ticketInstance.setResalePrice(0, new BigNumber("0.6").mul(precision).valueOf())
                .then((result) => (txCost = utils.getTxCost(result)));
            await marketplace.buyTicketFromReseller(0, 0, { from: accounts[1], value: web3.toWei("0.6", "ether") })
                .then(utils.receiptShouldSucceed);

            const currentOrganizerBalance = await utils.getEtherBalance(accounts[4]).valueOf();
            const currentOldOwnerBalance = await utils.getEtherBalance(accounts[0]).valueOf();

            await assert.equal(new BigNumber(previousOrganizerBalance).add((0.6e18 - 0.5e18) * 10 / 100).valueOf(),
                currentOrganizerBalance, "old organizer eth balance is not equal");

            await assert.equal(
                new BigNumber(previousOldOwnerBalance).sub(txCost).add(0.6e18 - (0.6e18 - 0.5e18) * 10 / 100).valueOf(),
                currentOldOwnerBalance,
                "old owner eth balance is not equal"
            );
        });
    });

    describe("check refund", () => {
        it("should successfully refund a ticket", async () => {
            await management.setPermission(marketplace.address, CAN_ADD_EVENTS, true);
            await management.setPermission(marketplace.address, CAN_SELL_TICKETS, true);
            await management.setPermission(marketplace.address, CAN_MAKE_REFUND, true);
            await management.setPermission(marketplace.address, CAN_BURN_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, marketplace.address);
            await management.registerContract(CONTRACT_EVENT, eventInstance.address);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await assert.equal(await management.ticketRegistry.call(0), 0, "ticketInstance is defined");

            await marketplace.addNewEvent("TICKET", "TKT", 100, eventStart).then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            const event = await eventInstance.getEvent.call(0);

            await assert.equal(event.length, 5, "event does not exist");

            await assert.notEqual(await management.ticketRegistry.call(0), 0, "ticketInstance is not defined");

            const signAddress = accounts[1];
            await management.setPermission(signAddress, CAN_SIGN_TRANSACTION, true);

            await makeTransaction(
                marketplace,
                0,
                10,
                100,
                [1, 1, 1],
                new BigNumber("0.5").mul(precision).valueOf(),
                signAddress,
                accounts[0]
            ).then(utils.receiptShouldSucceed);

            const ticketAddress = await management.ticketRegistry.call(0);
            const ticketInstance = Ticket.at(ticketAddress);

            assert.equal(await ticketInstance.ownerOf.call(0), accounts[0], "owner is not equal");
            assert.equal(await eventInstance.getCollectedFundsTest.call(0),
                new BigNumber("0.5e18").valueOf(), "collectedFunds is not equal");

            const previousMarketplaceBalance = await utils.getEtherBalance(marketplace.address).valueOf();
            const previousOwnerBalance = await utils.getEtherBalance(accounts[0]).valueOf();

            let txCost;
            await makeRefundTransaction(marketplace, 0, 0, 50, 100, signAddress, accounts[0])
                .then((result) => (txCost = utils.getTxCost(result)));

            assert.equal(await eventInstance.getCollectedFundsTest.call(0),
                new BigNumber("0.25e18").valueOf(), "collectedFunds is not equal");

            const currentMarketplaceBalance = await utils.getEtherBalance(marketplace.address).valueOf();
            const currentOwnerBalance = await utils.getEtherBalance(accounts[0]).valueOf();

            await assert.equal(new BigNumber(previousMarketplaceBalance).sub(0.5e18 * 50 / 100).valueOf(),
                currentMarketplaceBalance, "event eth balance is not equal");

            await assert.equal(new BigNumber(previousOwnerBalance).sub(txCost).add(0.5e18 * 50 / 100).valueOf(),
                currentOwnerBalance, "owner eth balance is not equal");
        });

        it("should fail as event is not registered", async () => {
            await management.setPermission(marketplace.address, CAN_ADD_EVENTS, true);
            await management.setPermission(marketplace.address, CAN_SELL_TICKETS, true);
            await management.setPermission(marketplace.address, CAN_MAKE_REFUND, true);
            await management.setPermission(marketplace.address, CAN_BURN_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, marketplace.address);
            await management.registerContract(CONTRACT_EVENT, eventInstance.address);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await assert.equal(await management.ticketRegistry.call(0), 0, "ticketInstance is defined");

            await marketplace.addNewEvent("TICKET", "TKT", 100, eventStart).then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            const event = await eventInstance.getEvent.call(0);

            await assert.equal(event.length, 5, "event does not exist");

            await assert.notEqual(await management.ticketRegistry.call(0), 0, "ticketInstance is not defined");

            const signAddress = accounts[1];
            await management.setPermission(signAddress, CAN_SIGN_TRANSACTION, true);

            await makeTransaction(
                marketplace,
                0,
                10,
                100,
                [1, 1, 1],
                new BigNumber("0.5").mul(precision).valueOf(),
                signAddress,
                accounts[0]
            ).then(utils.receiptShouldSucceed);

            const ticketAddress = await management.ticketRegistry.call(0);
            const ticketInstance = Ticket.at(ticketAddress);

            assert.equal(await ticketInstance.ownerOf.call(0), accounts[0], "owner is not equal");
            assert.equal(await eventInstance.getCollectedFundsTest.call(0), new BigNumber("0.5e18").valueOf(),
                "collectedFunds is not equal");

            await management.registerContract(CONTRACT_EVENT, 0);
            await makeRefundTransaction(marketplace, 0, 0, 50, 100, signAddress, accounts[0])
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await management.registerContract(CONTRACT_EVENT, eventInstance.address);
            await makeRefundTransaction(marketplace, 0, 0, 50, 100, signAddress, accounts[0])
                .then(utils.receiptShouldSucceed);
        });
    });

    describe("check getters", () => {
        it("check isInitialized", async () => {
            await assert.equal(await marketplace.isInitialized.call(), false, "marketplace is initialized");

            await management.registerContract(CONTRACT_EVENT, eventInstance.address);
            await assert.equal(await marketplace.isInitialized.call(), false, "marketplace is initialized");

            await management.registerContract(CONTRACT_MARKETPLACE, marketplace.address);
            await assert.equal(await marketplace.isInitialized.call(), false, "marketplace is initialized");

            await management.registerContract(CONTRACT_DISTRIBUTOR, distributor.address);
            await assert.equal(await marketplace.isInitialized.call(), true, "marketplace is not initialized");

            marketplace = await Marketplace.new(0);
            await assert.equal(await marketplace.isInitialized.call(), false, "marketplace is initialized");
        });
    });

    describe("check withdrawEventFunds", () => {
        it("should successfully withdraw funds", async () => {
            await management.setPermission(marketplace.address, CAN_ADD_EVENTS, true);
            await management.setPermission(marketplace.address, CAN_SELL_TICKETS, true);
            await management.setPermission(marketplace.address, CAN_MAKE_REFUND, true);
            await management.setPermission(marketplace.address, CAN_BURN_TICKETS, true);
            await management.setPermission(marketplace.address, CAN_UPDATE_EVENT, true);
            await management.registerContract(CONTRACT_MARKETPLACE, marketplace.address);
            await management.registerContract(CONTRACT_EVENT, eventInstance.address);

            await assert.equal(await eventInstance.eventExists.call(0), false, "event exists");
            await assert.equal(await management.ticketRegistry.call(0), 0, "ticketInstance is defined");

            await marketplace.addNewEvent("TICKET", "TKT", 100, eventStart).then(utils.receiptShouldSucceed);
            await assert.equal(await eventInstance.eventExists.call(0), true, "event does not exist");

            const event = await eventInstance.getEvent.call(0);

            await assert.equal(event.length, 5, "event does not exist");

            await assert.notEqual(await management.ticketRegistry.call(0), 0, "ticketInstance is not defined");

            const signAddress = accounts[2];
            await management.setPermission(signAddress, CAN_SIGN_TRANSACTION, true);

            await makeTransaction(
                marketplace,
                0,
                10,
                100,
                [1, 1, 1],
                new BigNumber("0.5").mul(precision).valueOf(),
                signAddress,
                accounts[1]
            ).then(utils.receiptShouldSucceed);

            const ticketAddress = await management.ticketRegistry.call(0);
            const ticketInstance = Ticket.at(ticketAddress);

            assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "owner is not equal");
            assert.equal(await eventInstance.getCollectedFundsTest.call(0),
                new BigNumber("0.5e18").valueOf(), "collectedFunds is not equal");

            await eventInstance.updateStartTime(0, parseInt(new Date().getTime() / 1000) - 3600)
                .then(utils.receiptShouldSucceed);

            await makeRefundTransaction(marketplace, 0, 0, 50, 100, signAddress, accounts[1])
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            assert.equal(await eventInstance.getCollectedFunds.call(0),
                new BigNumber("0.5e18").valueOf(), "collectedFunds is not equal");

            const previousMarketplaceBalance = await utils.getEtherBalance(marketplace.address).valueOf();
            const previousEventOwnerBalance = await utils.getEtherBalance(accounts[0]).valueOf();

            let txCost;
            await marketplace.withdrawEventFunds(0)
                .then((result) => (txCost = utils.getTxCost(result)));

            assert.equal(await eventInstance.getCollectedFunds.call(0), 0, "collectedFunds is not equal");

            const currentMarketplaceBalance = await utils.getEtherBalance(marketplace.address).valueOf();
            const currentEventOwnerBalance = await utils.getEtherBalance(accounts[0]).valueOf();

            await assert.equal(new BigNumber(previousMarketplaceBalance).sub(0.5e18).valueOf(),
                currentMarketplaceBalance, "event eth balance is not equal");

            await assert.equal(new BigNumber(previousEventOwnerBalance).sub(txCost).add(0.5e18).valueOf(),
                currentEventOwnerBalance, "owner eth balance is not equal");
        });
    });
});
