// Jest applies this mock to every test that loads react-native-nitro-tor,
// because the package ships untranspiled TypeScript that Jest does not parse.
// Tests that need other behavior can still pass their own jest.mock factory.
export const Tor = {
    daemon: {
        start: jest.fn().mockResolvedValue({
            state: 'running',
            socksAddress: '127.0.0.1:9056',
            controlAddress: '127.0.0.1:9051',
            connectivity: { network: 'up', circuitEstablished: true }
        }),
        stop: jest.fn().mockResolvedValue(undefined)
    },
    http: {
        request: jest.fn()
    }
};
