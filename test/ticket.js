const utils = require("./utils");
const BN = require("bn.js");

const CAN_SELL_TICKETS = 0;
const CAN_BURN_TICKETS = 3;

const CONTRACT_MARKETPLACE = 1;

const Management = artifacts.require("contracts/Management.sol");
const Ticket = artifacts.require("contracts/Ticket.sol");
const Concert = artifacts.require("contracts/Concert.sol");

contract("Ticket", accounts => {
    let management;
    let concertInstance;
    let ticketInstance;

    beforeEach(async () => {
        management = await Management.new();
        concertInstance = await Concert.new(management.address);
        ticketInstance = await Ticket.new(management.address, "TICKET", "TKT");
    });

    describe("check createTicket", () => {
        it("should successfully create ticket", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");

            const ticket = await ticketInstance.getTicket.call(0);

            await assert.equal(ticket[0], accounts[1], "ticket has wrong owner");
            await assert.equal(ticket[1], 10, "ticket has wrong resellProfitShare");
            await assert.equal(ticket[2], 100, "ticket has wrong percentageAbsMax");
            await assert.equal(ticket[3], 200, "ticket has wrong initialPrice");
            await assert.equal(ticket[4], 200, "ticket has wrong previousPrice");
            await assert.equal(ticket[5], 0, "ticket has wrong resalePrice");
        });

        it("should fail as _percentageAbsMax is less than _resellProfitShare", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 200, 100, 10)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");

            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
        });

        it("should fail as caller has no permissions", async () => {
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");

            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
        });

        it("should fail as caller is not registered", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);
            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
        });

        it("should fail as owner is a contract", async () => {
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await assert.equal(await management.isContract.call(concertInstance.address),
                true, "concert is not a contract");
            await ticketInstance.createTicket(concertInstance.address, 200, 10, 100)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");

            await assert.equal(await management.isContract.call(accounts[1]), false, "accounts[1] is a contract");
            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
        });
    });

    describe("check resellTicket", () => {
        it("should successfully resell ticket", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await ticketInstance.setResalePrice(0, 300, { from: accounts[1] }).then(utils.receiptShouldSucceed);
            await ticketInstance.resellTicket(0, accounts[2])
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[2], "ticket has wrong owner");
        });

        it("should fail as caller has no permissions", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await ticketInstance.setResalePrice(0, 300, { from: accounts[1] }).then(utils.receiptShouldSucceed);

            await management.setPermission(accounts[0], CAN_SELL_TICKETS, false);
            await ticketInstance.resellTicket(0, accounts[2])
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await ticketInstance.resellTicket(0, accounts[2])
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[2], "ticket has wrong owner");
        });

        it("should fail as caller is not registered", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await ticketInstance.setResalePrice(0, 300, { from: accounts[1] }).then(utils.receiptShouldSucceed);

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[1]);
            await ticketInstance.resellTicket(0, accounts[2])
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);
            await ticketInstance.resellTicket(0, accounts[2])
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[2], "ticket has wrong owner");
        });

        it("should fail as ticket is not for resale", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await ticketInstance.resellTicket(0, accounts[1])
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await ticketInstance.setResalePrice(0, 300, { from: accounts[1] }).then(utils.receiptShouldSucceed);
            await ticketInstance.resellTicket(0, accounts[2])
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[2], "ticket has wrong owner");
        });

        it("should fail as new owner is a contract", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await ticketInstance.setResalePrice(0, 300, { from: accounts[1] }).then(utils.receiptShouldSucceed);

            await assert.equal(await management.isContract.call(concertInstance.address),
                true, "concert is not a contract");
            await ticketInstance.resellTicket(0, concertInstance.address)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await assert.equal(await management.isContract.call(accounts[2]), false, "accounts[2] is a contract");
            await ticketInstance.resellTicket(0, accounts[2])
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[2], "ticket has wrong owner");
        });
    });

    describe("check setResalePrice", () => {
        it("should fail as ticket does not an exist", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.setResalePrice(0, 300, { from: accounts[1] })
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await ticketInstance.setResalePrice(0, 300, { from: accounts[1] })
                .then(utils.receiptShouldSucceed);
            const ticket = await ticketInstance.getTicket.call(0);
            await assert.equal(ticket[5], 300, "ticket has wrong resalePrice");
        });

        it("should fail as caller is not an owner", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await ticketInstance.setResalePrice(0, 300)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            let ticket = await ticketInstance.getTicket.call(0);
            await assert.equal(ticket[5], 0, "ticket has wrong resalePrice");

            await ticketInstance.setResalePrice(0, 300, { from: accounts[1] })
                .then(utils.receiptShouldSucceed);
            ticket = await ticketInstance.getTicket.call(0);
            await assert.equal(ticket[5], 300, "ticket has wrong resalePrice");
        });

        it("should fail as resale price is lower than previous", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await ticketInstance.setResalePrice(0, 100, { from: accounts[1] })
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            let ticket = await ticketInstance.getTicket.call(0);
            await assert.equal(ticket[5], 0, "ticket has wrong resalePrice");

            await ticketInstance.setResalePrice(0, 300, { from: accounts[1] })
                .then(utils.receiptShouldSucceed);
            ticket = await ticketInstance.getTicket.call(0);
            await assert.equal(ticket[5], 300, "ticket has wrong resalePrice");

            await ticketInstance.setResalePrice(0, 0, { from: accounts[1] })
                .then(utils.receiptShouldSucceed);
            ticket = await ticketInstance.getTicket.call(0);
            await assert.equal(ticket[5], 0, "ticket has wrong resalePrice");
        });
    });

    describe("check burnTicket", () => {
        it("should successfully burn ticket", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_BURN_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.burnTicket(accounts[1], 0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await ticketInstance.burnTicket(accounts[0], 0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            const ticket = await ticketInstance.getTicket.call(0);
            await assert.equal(ticket.length, 6, "ticket does not exist");
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");

            await ticketInstance.burnTicket(accounts[1], 0)
                .then(utils.receiptShouldSucceed);
            await ticketInstance.getTicket.call(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
        });

        it("should fail as caller has no permissions", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await ticketInstance.burnTicket(accounts[1], 0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            const ticket = await ticketInstance.getTicket.call(0);
            await assert.equal(ticket.length, 6, "ticket does not exist");
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");

            await management.setPermission(accounts[0], CAN_BURN_TICKETS, true);
            await ticketInstance.burnTicket(accounts[1], 0)
                .then(utils.receiptShouldSucceed);
            await ticketInstance.getTicket.call(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
        });

        it("should fail as caller is not registered", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.setPermission(accounts[0], CAN_BURN_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[1]);
            await ticketInstance.burnTicket(accounts[1], 0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            const ticket = await ticketInstance.getTicket.call(0);
            await assert.equal(ticket.length, 6, "ticket does not exist");
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");

            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);
            await ticketInstance.burnTicket(accounts[1], 0)
                .then(utils.receiptShouldSucceed);
            await ticketInstance.getTicket.call(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
        });
    });

    describe("check approve and transfer functionality", () => {
        it("should fail as methods are not available", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
            await assert.equal(await ticketInstance.ownerOf.call(0), accounts[1], "ticket has wrong owner");

            await ticketInstance.approve(accounts[0], 0, { from: accounts[1] })
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await ticketInstance.setApprovalForAll(accounts[0], true, { from: accounts[1] })
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await ticketInstance.transferFrom(accounts[1], accounts[0], 0, { from: accounts[1] })
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await ticketInstance.safeTransferFrom(accounts[1], accounts[0], 0, new BN(0), { from: accounts[1] })
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await ticketInstance.safeTransferFrom(accounts[1], accounts[0], 0, { from: accounts[1] })
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);
        });
    });

    describe("check getters", () => {
        it("isForResale should fail as ticket does not an exist", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.isForResale(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");
            await assert.equal(await ticketInstance.isForResale.call(0), false, "ticket is for resale");
        });

        it("getCustomerTicketsIds should return tickets of owner", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await assert.equal(await ticketInstance.exists.call(1), false, "ticket exists");
            await assert.equal(await ticketInstance.exists.call(2), false, "ticket exists");

            let customer1 = await ticketInstance.getCustomerTicketsIds.call(accounts[1]);
            await assert.equal(customer1.length, 0, "customer1 has too many tickets");

            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            customer1 = await ticketInstance.getCustomerTicketsIds.call(accounts[1]);
            await assert.equal(customer1.length, 1, "customer1 has too many tickets");
            await assert.equal(customer1[0], 0, "customer1 has wrong ticket");

            await ticketInstance.createTicket(accounts[2], 300, 10, 100)
                .then(utils.receiptShouldSucceed);
            const customer2 = await ticketInstance.getCustomerTicketsIds.call(accounts[2]);
            await assert.equal(customer2.length, 1, "customer2 has too many tickets");
            await assert.equal(customer2[0], 1, "customer2 has wrong ticket");

            await ticketInstance.createTicket(accounts[1], 400, 10, 100)
                .then(utils.receiptShouldSucceed);
            customer1 = await ticketInstance.getCustomerTicketsIds.call(accounts[1]);
            await assert.equal(customer1.length, 2, "customer1 has too many tickets");
            await assert.equal(customer1[1], 2, "customer1 has wrong ticket");
        });

        it("getTicket should fail as ticket does not exist", async () => {
            await management.setPermission(accounts[0], CAN_SELL_TICKETS, true);
            await management.registerContract(CONTRACT_MARKETPLACE, accounts[0]);

            await assert.equal(await ticketInstance.exists.call(0), false, "ticket exists");
            await ticketInstance.getTicket.call(0)
                .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

            await ticketInstance.createTicket(accounts[1], 200, 10, 100)
                .then(utils.receiptShouldSucceed);
            await assert.equal(await ticketInstance.exists.call(0), true, "ticket does not exist");

            const ticket = await ticketInstance.getTicket.call(0);

            await assert.equal(ticket[0], accounts[1], "ticket has wrong owner");
            await assert.equal(ticket[1], 10, "ticket has wrong resellProfitShare");
            await assert.equal(ticket[2], 100, "ticket has wrong percentageAbsMax");
            await assert.equal(ticket[3], 200, "ticket has wrong initialPrice");
            await assert.equal(ticket[4], 200, "ticket has wrong previousPrice");
            await assert.equal(ticket[5], 0, "ticket has wrong resalePrice");
        });
    });
});
