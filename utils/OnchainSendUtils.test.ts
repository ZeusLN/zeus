jest.mock('react-native-randombytes', () => ({
    randomBytes: (n: number) => jest.requireActual('crypto').randomBytes(n)
}));

import {
    SEND_LABEL_PREFIX,
    findSentTransaction,
    isRequestTimeout,
    mayHaveBeenSent,
    makeSendLabel
} from './OnchainSendUtils';
import {
    markHttpStatus,
    markNodeResponded,
    markRestErrorResponse
} from './PaymentLookupUtils';

describe('makeSendLabel', () => {
    it('is the prefix plus 16 hex characters', () => {
        const label = makeSendLabel();
        expect(label.startsWith(SEND_LABEL_PREFIX)).toBe(true);
        expect(label.slice(SEND_LABEL_PREFIX.length)).toMatch(/^[0-9a-f]{16}$/);
    });

    it('differs between sends', () => {
        expect(makeSendLabel()).not.toEqual(makeSendLabel());
    });
});

describe('isRequestTimeout', () => {
    it.each([
        [
            'the lnc-rn request timer',
            'lnrpc.Lightning.SendCoins timed out after 60000ms'
        ],
        ['the REST backend timer', 'Request timeout'],
        ['the iOS URL session', 'The request timed out.'],
        ['an Android socket', 'timeout'],
        ['the Tor client', 'request timed out']
    ])('matches %s', (_source, message) => {
        expect(isRequestTimeout(new Error(message))).toBe(true);
    });

    it('matches a timeout passed as a string', () => {
        expect(isRequestTimeout('Request timeout')).toBe(true);
    });

    it.each([
        'insufficient funds available to construct transaction',
        'invalid address',
        'transaction output is dust'
    ])('does not match the node error "%s"', (message) => {
        expect(isRequestTimeout(new Error(message))).toBe(false);
    });

    it('does not match a missing error', () => {
        expect(isRequestTimeout(undefined)).toBe(false);
    });
});

describe('findSentTransaction', () => {
    const label = 'ZEUS send 0011223344556677';
    const isSent = (tx: any) => tx.label === label;
    const options = { attempts: 3, delayMs: 0 };

    it('resolves the txid of the transaction that matches', async () => {
        const getTransactions = jest.fn().mockResolvedValue({
            transactions: [
                { tx_hash: 'other', label: '' },
                { tx_hash: 'sent', label }
            ]
        });

        await expect(
            findSentTransaction(getTransactions, isSent, options)
        ).resolves.toBe('sent');
        expect(getTransactions).toHaveBeenCalledTimes(1);
    });

    it('keeps looking after a failed lookup', async () => {
        const getTransactions = jest
            .fn()
            .mockRejectedValueOnce(new Error('Request timeout'))
            .mockResolvedValueOnce({
                transactions: [{ tx_hash: 'sent', label }]
            });

        await expect(
            findSentTransaction(getTransactions, isSent, options)
        ).resolves.toBe('sent');
        expect(getTransactions).toHaveBeenCalledTimes(2);
    });

    it('keeps looking until the send shows up', async () => {
        const getTransactions = jest
            .fn()
            .mockResolvedValueOnce({ transactions: [] })
            .mockResolvedValueOnce({
                transactions: [{ tx_hash: 'sent', label }]
            });

        await expect(
            findSentTransaction(getTransactions, isSent, options)
        ).resolves.toBe('sent');
    });

    it('resolves undefined after the last attempt', async () => {
        const getTransactions = jest.fn().mockResolvedValue({
            transactions: [{ tx_hash: 'other', label: 'ZEUS send ffff' }]
        });

        await expect(
            findSentTransaction(getTransactions, isSent, options)
        ).resolves.toBeUndefined();
        expect(getTransactions).toHaveBeenCalledTimes(3);
    });

    it('skips empty entries', async () => {
        const getTransactions = jest.fn().mockResolvedValue({
            transactions: [null, { tx_hash: 'sent', label }]
        });

        await expect(
            findSentTransaction(getTransactions, isSent, options)
        ).resolves.toBe('sent');
    });

    it('tolerates a response without transactions', async () => {
        const getTransactions = jest.fn().mockResolvedValue({});

        await expect(
            findSentTransaction(getTransactions, isSent, options)
        ).resolves.toBeUndefined();
    });

    it('waits between attempts', async () => {
        jest.useFakeTimers();
        try {
            const getTransactions = jest
                .fn()
                .mockResolvedValue({ transactions: [] });
            const result = findSentTransaction(getTransactions, isSent, {
                attempts: 2,
                delayMs: 5000
            });

            await jest.advanceTimersByTimeAsync(0);
            expect(getTransactions).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(4999);
            expect(getTransactions).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(1);
            expect(getTransactions).toHaveBeenCalledTimes(2);
            await expect(result).resolves.toBeUndefined();
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('mayHaveBeenSent', () => {
    const rpcError = (code: string, desc: string) =>
        new Error(`rpc error: code = ${code} desc = ${desc}`);

    it.each([
        [
            'a timeout on any backend',
            'embedded-lnd',
            new Error('Request timeout')
        ],
        [
            'a REST failure with no response',
            'lnd',
            new Error('unexpected end of stream')
        ],
        ['a REST connection error string', 'lnd', 'connection closed'],
        [
            "a proxy's 502 over REST",
            'lnd',
            markRestErrorResponse(new Error('Bad Gateway'), undefined, 502)
        ],
        [
            "a proxy's 503 in front of CLNRest",
            'cln-rest',
            markHttpStatus(new Error('x'), 503)
        ],
        ["a proxy's 504", 'lnd', markHttpStatus(new Error('x'), 504)],
        [
            'a CLNRest failure with no response',
            'cln-rest',
            new Error('Network request failed')
        ],
        [
            'a dropped LNC connection',
            'lightning-node-connect',
            rpcError('Unavailable', 'transport is closing')
        ],
        [
            'an LNC deadline',
            'lightning-node-connect',
            rpcError('DeadlineExceeded', 'context deadline exceeded')
        ],
        [
            'a canceled LNC call',
            'lightning-node-connect',
            rpcError('Canceled', 'context canceled')
        ],
        [
            'a broken LNC stream',
            'lightning-node-connect',
            rpcError('Internal', 'unexpected EOF')
        ],
        [
            'an unrecognized LNC failure',
            'lightning-node-connect',
            new Error('mailbox closed')
        ]
    ])('is true for %s', (_, implementation, error) => {
        expect(mayHaveBeenSent(error, implementation)).toBe(true);
    });

    it.each([
        [
            "lnd's gRPC error over REST",
            'lnd',
            markRestErrorResponse(new Error('insufficient funds'), 2, 500)
        ],
        [
            "a proxy's 401 over REST",
            'lnd',
            markHttpStatus(new Error('Unauthorized'), 401)
        ],
        [
            "clnrest's JSON-RPC error",
            'cln-rest',
            markHttpStatus(new Error('x'), 500)
        ],
        [
            'a node error marked in process',
            'embedded-lnd',
            markNodeResponded(new Error('x'))
        ],
        [
            'any embedded LND error',
            'embedded-lnd',
            new Error('insufficient funds')
        ],
        ['any LDK Node error', 'ldk-node', new Error('InsufficientFunds')],
        [
            "lnd's error over LNC",
            'lightning-node-connect',
            rpcError(
                'Unknown',
                'insufficient funds available to construct transaction'
            )
        ],
        [
            'an invalid LNC argument',
            'lightning-node-connect',
            rpcError('InvalidArgument', 'invalid address')
        ],
        [
            'an LNC connection that is not ready',
            'lightning-node-connect',
            new Error('RPC connection not ready')
        ],
        [
            'a missing LNC client',
            'lightning-node-connect',
            new Error('error getting client: unknown namespace')
        ]
    ])('is false for %s', (_, implementation, error) => {
        expect(mayHaveBeenSent(error, implementation)).toBe(false);
    });
});
