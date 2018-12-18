const HDWalletProvider = require('truffle-hdwallet-provider');
const mnemonic = 'remind struggle west dentist under sauce there find scatter mention method indoor';

module.exports = {
    networks: {
        development: {
            host: 'localhost',
            port: 8545,
            network_id: '*',
            gas: 4612388,
        },
        coverage: {
            host: 'localhost',
            network_id: '*',
            port: 8555, // <-- If you change this, also set the port option in .solcover.js.
            gas: 0xfffffffffff, // <-- Use this high gas value
            gasPrice: 0x01, // <-- Use this low gas price
        },
        rinkeby: {
            provider: function () {
                return new HDWalletProvider(mnemonic, 'https://rinkeby.infura.io/V3/SJNZXWlD8Ed9GGdD4pWl');
            },
            gasPrice: 1000000000,
            network_id: 3,
            gas: 6000000,
        },
    },
    solc: {
        optimizer: {
            enabled: true,
            runs: 200,
        },
    },
};
