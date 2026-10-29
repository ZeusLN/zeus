// Jest applies this mock to every test that loads react-native-nitro-tor,
// because the package ships untranspiled TypeScript that Jest does not parse.
// Tests that need other behavior can still pass their own jest.mock factory.
export const RnTor = {
    startTorIfNotRunning: jest.fn().mockResolvedValue({ is_success: true }),
    shutdownService: jest.fn().mockResolvedValue(true),
    httpGet: jest.fn(),
    httpPost: jest.fn(),
    httpDelete: jest.fn()
};
