const utils = require("./utils");

const Managed = artifacts.require("contracts/Managed.sol");
const Management = artifacts.require("contracts/Management.sol");

contract("Managed", accounts => {
    it("set management contract", async () => {
        const management = await Management.new();
        const managed = await Managed.new(management.address);

        assert.equal(await managed.owner.call(), accounts[0], "owner is not equal");
        await managed.setManagementContract(management.address, { from: accounts[1] })
            .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

        await managed.setManagementContract(accounts[2]).then(utils.receiptShouldSucceed);

        await managed.setManagementContract(0)
            .then(utils.receiptShouldFailed).catch(utils.catchReceiptShouldFailed);

        await managed.setManagementContract(management.address).then(utils.receiptShouldSucceed);
    });
});
