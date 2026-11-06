import { isRequestTimeout, lookUpWithRetries } from './RequestTimeoutUtils';

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

describe('lookUpWithRetries', () => {
    const options = { attempts: 3, delayMs: 0 };

    it('stops at the first lookup that finds something', async () => {
        const lookup = jest
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce('found')
            .mockResolvedValueOnce('later');

        await expect(lookUpWithRetries(lookup, options)).resolves.toBe('found');
        expect(lookup).toHaveBeenCalledTimes(2);
    });

    it('keeps looking after a lookup throws', async () => {
        const lookup = jest
            .fn()
            .mockRejectedValueOnce(new Error('Request timeout'))
            .mockResolvedValueOnce('found');

        await expect(lookUpWithRetries(lookup, options)).resolves.toBe('found');
    });

    it('resolves undefined after the last attempt', async () => {
        const lookup = jest.fn().mockResolvedValue(undefined);

        await expect(
            lookUpWithRetries(lookup, options)
        ).resolves.toBeUndefined();
        expect(lookup).toHaveBeenCalledTimes(3);
    });

    it('makes 3 attempts 5s apart by default', async () => {
        jest.useFakeTimers();
        try {
            const lookup = jest.fn().mockResolvedValue(undefined);
            const result = lookUpWithRetries(lookup);

            await jest.advanceTimersByTimeAsync(0);
            expect(lookup).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(4999);
            expect(lookup).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(1);
            expect(lookup).toHaveBeenCalledTimes(2);
            await jest.advanceTimersByTimeAsync(5000);
            expect(lookup).toHaveBeenCalledTimes(3);
            await expect(result).resolves.toBeUndefined();
        } finally {
            jest.useRealTimers();
        }
    });
});
