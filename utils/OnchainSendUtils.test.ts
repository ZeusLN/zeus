jest.mock('react-native-randombytes', () => ({
    randomBytes: (n: number) => jest.requireActual('crypto').randomBytes(n)
}));

import {
    SEND_LABEL_PREFIX,
    findSentTransaction,
    isOutcomeUnknownError,
    isRequestTimeout,
    makeSendLabel
} from './OnchainSendUtils';

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

describe('isOutcomeUnknownError', () => {
    it.each([
        ['the REST backend timer', 'Request timeout'],
        [
            'the lnc-rn request timer',
            'lnrpc.Lightning.SendCoins timed out after 60000ms'
        ],
        ['RN fetch', 'Network request failed'],
        ['an iOS URL session', 'The network connection was lost.'],
        ['OkHttp', 'Connection reset'],
        ['OkHttp', 'Software caused connection abort'],
        ['OkHttp', 'unexpected end of stream on https://node:8080/...'],
        ['OkHttp', 'Socket closed'],
        ['OkHttp', 'Broken pipe'],
        ['OkHttp over HTTP/2', 'stream was reset: CANCEL'],
        [
            'ReactNativeBlobUtil reading the body',
            'ReactNativeBlobUtil failed to encode response data to UTF8 string.'
        ],
        ['a Node-style socket', 'read ECONNRESET'],
        ['a Node-style socket', 'write EPIPE'],
        [
            'grpc-go under LNC',
            'rpc error: code = Unavailable desc = error reading from server: EOF'
        ],
        [
            'grpc-go under LNC',
            'rpc error: code = Unavailable desc = transport is closing'
        ],
        [
            'grpc-go under LNC',
            'rpc error: code = Canceled desc = grpc: the client connection is closing'
        ],
        [
            'grpc-go under LNC',
            'rpc error: code = Unavailable desc = read tcp 10.0.0.2:51234->1.2.3.4:443: read: connection reset by peer'
        ],
        [
            'Tor',
            'Request failed: error sending request for url (http://abc.onion/v1/transactions)'
        ],
        ['Tor', 'Failed to read response body: connection closed'],
        ['hyper under Tor', 'connection closed before message completed']
    ])('matches %s: "%s"', (_source, message) => {
        expect(isOutcomeUnknownError(new Error(message))).toBe(true);
    });

    it('matches a dropped connection passed as a string', () => {
        expect(isOutcomeUnknownError('Network request failed')).toBe(true);
    });

    it.each([
        'insufficient funds available to construct transaction',
        'invalid address',
        'transaction output is dust',
        'fee rate too low',
        'min relay fee not met',
        'Failed to connect to node/10.0.0.2:8080',
        'Unable to resolve host "node.example": No address associated with hostname',
        'Connection refused',
        'RPC connection not ready'
    ])('does not match "%s"', (message) => {
        expect(isOutcomeUnknownError(new Error(message))).toBe(false);
    });

    it('does not match a missing error', () => {
        expect(isOutcomeUnknownError(undefined)).toBe(false);
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
