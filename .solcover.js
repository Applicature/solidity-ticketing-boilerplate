module.exports = {
    skipFiles: [
        'Migrations.sol',
        'tests/EventTest.sol'
    ],
    // need for dependencies
    copyNodeModules: false,
    copyPackages: [
        'zeppelin-solidity'
    ],
    dir: '.',
    buildDirPath: '/build/contracts',
    norpc: false
};
