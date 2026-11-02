const mockGetInfo = jest.fn();
const mockClose = jest.fn();
const mockConstructor = jest.fn();
jest.mock('@getalby/sdk', () => ({
    NWCClient: jest.fn().mockImplementation((options: any) => {
        mockConstructor(options);
        return { getInfo: mockGetInfo, close: mockClose };
    })
}));

import {
    checkNWCConnectionScope,
    classifyNWCConnectionMethods
} from './NWCScopeUtils';

const NWC_URL =
    'nostr+walletconnect://' +
    'b'.repeat(64) +
    '?relay=wss%3A%2F%2Frelay.example.com&secret=' +
    'a'.repeat(64);

describe('classifyNWCConnectionMethods', () => {
    it('allows a receive-only connection', () => {
        expect(
            classifyNWCConnectionMethods([
                'get_info',
                'make_invoice',
                'lookup_invoice'
            ])
        ).toEqual({ status: 'receiveOnly', spendMethods: [] });
        expect(classifyNWCConnectionMethods(['make_invoice'])).toEqual({
            status: 'receiveOnly',
            spendMethods: []
        });
    });

    it('allows read-only methods next to make_invoice', () => {
        expect(
            classifyNWCConnectionMethods([
                'get_info',
                'get_balance',
                'get_budget',
                'make_invoice',
                'lookup_invoice',
                'list_transactions',
                'make_hold_invoice'
            ]).status
        ).toBe('receiveOnly');
    });

    it.each([
        'pay_invoice',
        'pay_keysend',
        'multi_pay_invoice',
        'multi_pay_keysend',
        'sign_message',
        'create_connection',
        // not in NIP-47 today, but anything shaped like a payment method
        'pay_offer',
        'multi_pay_offer'
    ])('rejects a connection that grants %s', (method) => {
        expect(classifyNWCConnectionMethods(['make_invoice', method])).toEqual({
            status: 'canSpend',
            spendMethods: [method]
        });
    });

    it('lists every spend method of a full-access connection', () => {
        expect(
            classifyNWCConnectionMethods([
                'get_info',
                'get_balance',
                'pay_invoice',
                'make_invoice',
                'lookup_invoice',
                'list_transactions',
                'pay_keysend',
                'multi_pay_invoice',
                'sign_message'
            ])
        ).toEqual({
            status: 'canSpend',
            spendMethods: [
                'pay_invoice',
                'pay_keysend',
                'multi_pay_invoice',
                'sign_message'
            ]
        });
    });

    it('reports spend methods even when make_invoice is missing', () => {
        expect(classifyNWCConnectionMethods(['pay_invoice']).status).toBe(
            'canSpend'
        );
    });

    it('rejects a connection without make_invoice', () => {
        expect(
            classifyNWCConnectionMethods([
                'get_info',
                'get_balance',
                'lookup_invoice'
            ])
        ).toEqual({ status: 'missingMakeInvoice', spendMethods: [] });
    });

    it.each([
        ['undefined', undefined],
        ['null', null],
        ['an empty list', []],
        ['a string', 'make_invoice'],
        ['an object', { make_invoice: true }]
    ])('treats %s as unknown', (_, methods) => {
        expect(classifyNWCConnectionMethods(methods)).toEqual({
            status: 'unknown',
            spendMethods: []
        });
    });

    it('ignores non-string entries', () => {
        expect(
            classifyNWCConnectionMethods([null, 7, 'make_invoice']).status
        ).toBe('receiveOnly');
    });
});

describe('checkNWCConnectionScope', () => {
    beforeEach(() => {
        jest.useRealTimers();
        mockGetInfo.mockReset();
        mockClose.mockReset();
        mockConstructor.mockReset();
    });

    it('classifies the methods from get_info and closes the client', async () => {
        mockGetInfo.mockResolvedValue({
            methods: ['get_info', 'make_invoice', 'lookup_invoice']
        });
        await expect(checkNWCConnectionScope(NWC_URL)).resolves.toEqual({
            status: 'receiveOnly',
            spendMethods: []
        });
        expect(mockConstructor).toHaveBeenCalledWith({
            nostrWalletConnectUrl: NWC_URL
        });
        expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('reports spend methods from get_info', async () => {
        mockGetInfo.mockResolvedValue({
            methods: ['make_invoice', 'pay_invoice']
        });
        await expect(checkNWCConnectionScope(NWC_URL)).resolves.toEqual({
            status: 'canSpend',
            spendMethods: ['pay_invoice']
        });
        expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('returns unknown when get_info is refused', async () => {
        mockGetInfo.mockRejectedValue(
            Object.assign(new Error('Permission denied'), {
                code: 'RESTRICTED'
            })
        );
        await expect(checkNWCConnectionScope(NWC_URL)).resolves.toEqual({
            status: 'unknown',
            spendMethods: []
        });
        expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('returns unknown when get_info does not answer in time', async () => {
        jest.useFakeTimers();
        mockGetInfo.mockReturnValue(new Promise(() => {}));
        const result = checkNWCConnectionScope(NWC_URL, 5000);
        jest.advanceTimersByTime(5000);
        await expect(result).resolves.toEqual({
            status: 'unknown',
            spendMethods: []
        });
        expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('returns unknown when the connection string cannot be parsed', async () => {
        mockConstructor.mockImplementationOnce(() => {
            throw new Error('invalid connection string');
        });
        await expect(checkNWCConnectionScope('nonsense')).resolves.toEqual({
            status: 'unknown',
            spendMethods: []
        });
        expect(mockGetInfo).not.toHaveBeenCalled();
    });

    it('still returns the result if close throws', async () => {
        mockGetInfo.mockResolvedValue({ methods: ['make_invoice'] });
        mockClose.mockImplementation(() => {
            throw new Error('already closed');
        });
        await expect(checkNWCConnectionScope(NWC_URL)).resolves.toEqual({
            status: 'receiveOnly',
            spendMethods: []
        });
    });
});
