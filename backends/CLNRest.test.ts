jest.mock('../stores/Stores', () => ({
    settingsStore: {
        host: 'localhost',
        port: 8080,
        rune: 'test-rune',
        certVerification: false,
        enableTor: false
    },
    nodeInfoStore: {
        nodeInfo: {}
    }
}));
jest.mock('../utils/VersionUtils', () => ({
    __esModule: true,
    default: {
        isSupportedVersion: jest.fn(() => true)
    }
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('react-native-blob-util', () => ({
    config: jest.fn(() => ({
        fetch: jest.fn()
    }))
}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    RequestMethod: {}
}));
jest.mock('./CoreLightningRequestHandler', () => ({
    getBalance: jest.fn(),
    getChainTransactions: jest.fn(),
    getOffchainBalance: jest.fn(),
    listPeers: jest.fn(),
    listClosedChannels: jest.fn(),
    listPeerChannels: jest.fn()
}));

import CLNRest from './CLNRest';

describe('CLNRest fee limits', () => {
    it('preserves explicit zero fee limits', async () => {
        const cln = new CLNRest();
        const postRequestSpy = jest
            .spyOn(cln as any, 'postRequest')
            .mockResolvedValue({});

        await cln.payLightningInvoice({
            payment_request: 'lnbc1testinvoice',
            timeout_seconds: 120,
            fee_limit_sat: 0,
            max_fee_percent: 12
        });

        expect(postRequestSpy).toHaveBeenCalledWith(
            '/v1/pay',
            expect.objectContaining({
                bolt11: 'lnbc1testinvoice',
                retry_for: 120,
                maxfee: 0
            }),
            120000
        );
        const [, request] = postRequestSpy.mock.calls[0] as [
            string,
            any,
            number
        ];
        expect(request.maxfeepercent).toBeUndefined();
    });

    it('preserves an explicit max_fee_percent of 0', async () => {
        const cln = new CLNRest();
        const postRequestSpy = jest
            .spyOn(cln as any, 'postRequest')
            .mockResolvedValue({});

        await cln.payLightningInvoice({
            payment_request: 'lnbc1testinvoice',
            timeout_seconds: 120,
            max_fee_percent: 0
        });

        const [, request] = postRequestSpy.mock.calls[0] as [
            string,
            any,
            number
        ];
        expect(request.maxfeepercent).toBe(0);
    });

    it('floors fractional fee_limit_msat values before sending to CLN', async () => {
        const cln = new CLNRest();
        const postRequestSpy = jest
            .spyOn(cln as any, 'postRequest')
            .mockResolvedValue({});

        await cln.payLightningInvoice({
            payment_request: 'lnbc1testinvoice',
            timeout_seconds: 120,
            fee_limit_msat: 1500.8
        });

        const [, request] = postRequestSpy.mock.calls[0] as [
            string,
            any,
            number
        ];
        expect(request.maxfee).toBe(1500);
    });
});

describe('CLNRest msat handling', () => {
    it('forwards explicit amount_msat without lossy round-tripping', async () => {
        const cln = new CLNRest();
        const postRequestSpy = jest
            .spyOn(cln as any, 'postRequest')
            .mockResolvedValue({});

        await cln.payLightningInvoice({
            payment_request: 'lnbc1zeroamt',
            amount_msat: 1234567
        });

        const [, body] = postRequestSpy.mock.calls[0] as [string, any, number];
        // Must keep exact msat precision – never divide by 1000 then multiply.
        expect(body.amount_msat).toBe(1234567);
    });
});

describe('CLNRest createInvoice', () => {
    it("uses 'any' when value_msat is zero so CLN doesn't reject the request", async () => {
        const cln = new CLNRest();
        const postRequestSpy = jest
            .spyOn(cln as any, 'postRequest')
            .mockResolvedValue({});

        await cln.createInvoice({
            value: '0',
            value_msat: '0',
            memo: 'zero',
            expiry_seconds: '600',
            private: false
        });

        const [, body] = postRequestSpy.mock.calls[0] as [string, any];
        expect(body.amount_msat).toBe('any');
    });

    it('forwards a positive value_msat verbatim', async () => {
        const cln = new CLNRest();
        const postRequestSpy = jest
            .spyOn(cln as any, 'postRequest')
            .mockResolvedValue({});

        await cln.createInvoice({
            value: '21',
            value_msat: '21000',
            memo: 'msat',
            expiry_seconds: '600',
            private: false
        });

        const [, body] = postRequestSpy.mock.calls[0] as [string, any];
        expect(body.amount_msat).toBe(21000);
    });

    it("uses 'any' when value is undefined and value_msat omitted (no NaN)", async () => {
        const cln = new CLNRest();
        const postRequestSpy = jest
            .spyOn(cln as any, 'postRequest')
            .mockResolvedValue({});

        await cln.createInvoice({
            memo: 'amountless',
            expiry_seconds: '600',
            private: false
        });

        const [, body] = postRequestSpy.mock.calls[0] as [string, any];
        expect(body.amount_msat).toBe('any');
    });

    it('throws on invalid value_msat (negative) instead of silent fallback', () => {
        const cln = new CLNRest();
        jest.spyOn(cln as any, 'postRequest').mockResolvedValue({});

        expect(() =>
            cln.createInvoice({
                value: '21',
                value_msat: '-1',
                memo: 'bad',
                expiry_seconds: '600',
                private: false
            })
        ).toThrow('Invalid value_msat');
    });

    it('throws on non-numeric value_msat instead of silent fallback', () => {
        const cln = new CLNRest();
        jest.spyOn(cln as any, 'postRequest').mockResolvedValue({});

        expect(() =>
            cln.createInvoice({
                value: '21',
                value_msat: 'NaN',
                memo: 'bad',
                expiry_seconds: '600',
                private: false
            })
        ).toThrow('Invalid value_msat');
    });

    it('uses high-resolution unique label to avoid collisions', async () => {
        const cln = new CLNRest();
        const postRequestSpy = jest
            .spyOn(cln as any, 'postRequest')
            .mockResolvedValue({});

        await cln.createInvoice({
            value: '1',
            memo: 'a',
            expiry_seconds: '600',
            private: false
        });
        await cln.createInvoice({
            value: '1',
            memo: 'b',
            expiry_seconds: '600',
            private: false
        });

        const labelA = (postRequestSpy.mock.calls[0][1] as any).label as string;
        const labelB = (postRequestSpy.mock.calls[1][1] as any).label as string;
        expect(labelA).toMatch(
            /^zeus\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
        expect(labelA).not.toBe(labelB);
    });
});
