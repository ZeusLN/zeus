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
    markJsonRpcCode,
    markNodeResponded,
    markRequestNotSent,
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
            markJsonRpcCode(markHttpStatus(new Error('x'), 500), {
                code: 301,
                message: 'x'
            })
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

    it.each([
        [
            'a refused connection on Android',
            'Failed to connect to /10.0.2.2:24899'
        ],
        [
            'an unresolved host on Android',
            'Unable to resolve host "node.example.com": No address associated with hostname'
        ],
        [
            'an untrusted certificate on Android',
            'java.security.cert.CertPathValidatorException: Trust anchor for certification path not found.'
        ],
        ['a failed handshake on Android', 'Handshake failed'],
        [
            'a certificate for another host on Android',
            'Hostname 10.0.2.2 not verified:\n    certificate: sha256/abc=\n    DN: CN=wronghost.example'
        ],
        ['a refused connection on iOS', 'Could not connect to the server.'],
        [
            'a failed TLS handshake on iOS',
            'A TLS error caused the secure connection to fail.'
        ],
        [
            'an unresolved host on iOS',
            'A server with the specified hostname could not be found.'
        ],
        ['no network on iOS', 'The Internet connection appears to be offline.'],
        [
            'a TLS failure on iOS',
            'An SSL error has occurred and a secure connection to the server cannot be made.'
        ],
        [
            'an invalid certificate on iOS',
            'The certificate for this server is invalid. You might be connecting to a server that is pretending to be “127.0.0.1” which could put your confidential information at risk.'
        ]
    ])('is false for %s on REST backends', (_, message) => {
        expect(mayHaveBeenSent(new Error(message), 'lnd')).toBe(false);
        expect(mayHaveBeenSent(message, 'cln-rest')).toBe(false);
    });

    it.each([
        [
            'a connection lost mid-request on iOS',
            'The network connection was lost.'
        ],
        [
            'a stream ended on Android',
            'unexpected end of stream on https://node.example.com/...'
        ],
        ['a timeout on Android', 'The request timed out.']
    ])('stays true for %s on REST backends', (_, message) => {
        expect(mayHaveBeenSent(new Error(message), 'lnd')).toBe(true);
    });

    const restCases = (status: number, implementation: string) =>
        mayHaveBeenSent(markHttpStatus(new Error('x'), status), implementation);

    it.each([
        [1, 499],
        [4, 504],
        [13, 500],
        [14, 503]
    ])(
        "is true for the REST gateway's gRPC transport code %i",
        (code, status) => {
            expect(
                mayHaveBeenSent(
                    markRestErrorResponse(new Error('x'), code, status),
                    'lnd'
                )
            ).toBe(true);
        }
    );

    it.each([2, 3, 5, 6, 9])(
        "is false for lnd's own gRPC code %i over REST",
        (code) => {
            expect(
                mayHaveBeenSent(
                    markRestErrorResponse(new Error('x'), code, 500),
                    'lnd'
                )
            ).toBe(false);
        }
    );

    it.each([500, 501, 520, 524])(
        'is true for an LND REST %i without a gRPC code',
        (status) => {
            expect(restCases(status, 'lnd')).toBe(true);
        }
    );

    it.each([501, 502, 520, 524])('is true for a CLNRest %i', (status) => {
        expect(restCases(status, 'cln-rest')).toBe(true);
    });

    it("reads a CLN code inside the gRPC range as clnrest's answer, not lnd's", () => {
        // doTorRequest tags a body code of 1 to 16 as a gRPC code too
        const error = markJsonRpcCode(
            markRestErrorResponse(new Error('x'), 4, 500),
            { code: 4, message: 'x' }
        );
        expect(mayHaveBeenSent(error, 'cln-rest')).toBe(false);
        expect(
            mayHaveBeenSent(
                markRestErrorResponse(new Error('x'), 2, 520),
                'cln-rest'
            )
        ).toBe(true);
    });

    it('is true for a CLNRest 500 without a JSON-RPC code', () => {
        expect(restCases(500, 'cln-rest')).toBe(true);
    });

    it.each([
        [300, 'lnd'],
        [401, 'lnd'],
        [404, 'lnd'],
        [429, 'lnd'],
        [400, 'cln-rest'],
        [401, 'cln-rest']
    ])('is false for a %i refusal over %s', (status, implementation) => {
        expect(restCases(status, implementation)).toBe(false);
    });

    it.each(['lightning-node-connect', 'lnd', 'cln-rest'])(
        'is false on %s for an error tagged as not sent, whatever its text',
        (implementation) => {
            expect(
                mayHaveBeenSent(
                    markRequestNotSent(
                        new Error(
                            'Failed to connect the LNC client to the proxy server'
                        )
                    ),
                    implementation
                )
            ).toBe(false);
        }
    );

    it.each([
        ['Tor not running', 'Tor service not running'],
        ['Tor not initialized', 'Tor library not initialized'],
        [
            'a failed connect over Tor',
            'Request failed: error sending request for url (https://abc.onion:8080/v1/transactions): error trying to connect: socks connect error: Host unreachable'
        ]
    ])('is false for %s', (_, message) => {
        expect(mayHaveBeenSent(new Error(message), 'lnd')).toBe(false);
    });

    it.each([
        [
            'a connection closed mid-request over Tor',
            'Request failed: error sending request for url (https://abc.onion:8080/v1/transactions): connection closed before message completed'
        ],
        [
            'a timeout over Tor',
            'Request failed: error sending request for url (https://abc.onion:8080/v1/transactions): operation timed out'
        ]
    ])('is true for %s', (_, message) => {
        expect(mayHaveBeenSent(new Error(message), 'lnd')).toBe(true);
    });
});
