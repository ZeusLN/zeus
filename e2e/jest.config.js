/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
    rootDir: '..',
    testMatch: ['<rootDir>/e2e/specs/**/*.e2e.ts'],
    testTimeout: 180000,
    maxWorkers: 1,
    globalSetup: 'detox/runners/jest/globalSetup',
    globalTeardown: 'detox/runners/jest/globalTeardown',
    reporters: ['detox/runners/jest/reporter'],
    testEnvironment: 'detox/runners/jest/testEnvironment',
    verbose: true
};
