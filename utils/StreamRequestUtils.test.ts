import {
    deferred,
    isEventForRequest,
    newStreamRequestId
} from './StreamRequestUtils';

describe('StreamRequestUtils', () => {
    describe('newStreamRequestId', () => {
        it('returns a different id on every call', () => {
            const ids = new Set(
                Array.from({ length: 100 }, () => newStreamRequestId())
            );
            expect(ids.size).toBe(100);
        });

        it('returns a non-empty id, since native treats empty as none', () => {
            expect(newStreamRequestId()).not.toEqual('');
        });
    });

    describe('isEventForRequest', () => {
        it('matches an event tagged with the request id', () => {
            expect(isEventForRequest({ data: 'x', request_id: 'a' }, 'a')).toBe(
                true
            );
        });

        it("rejects another request's event", () => {
            expect(isEventForRequest({ data: 'x', request_id: 'b' }, 'a')).toBe(
                false
            );
        });

        it('rejects untagged events', () => {
            expect(isEventForRequest({ data: 'x' }, 'a')).toBe(false);
            expect(
                isEventForRequest(
                    { error_code: 'Error', error_desc: 'EOF' },
                    'a'
                )
            ).toBe(false);
        });

        it('rejects malformed events', () => {
            expect(isEventForRequest(undefined, 'a')).toBe(false);
            expect(isEventForRequest(null, 'a')).toBe(false);
            expect(isEventForRequest('a', 'a')).toBe(false);
        });
    });

    describe('deferred', () => {
        const tick = () =>
            new Promise<void>((resolve) => setImmediate(resolve));

        it('resolves its promise with the value', async () => {
            const { promise, resolve } = deferred();
            resolve({ result: { chan_pending: {} } });
            await expect(promise).resolves.toEqual({
                result: { chan_pending: {} }
            });
        });

        it('rejects its promise with the error', async () => {
            const { promise, reject } = deferred();
            reject(new Error('stream closed'));
            await expect(promise).rejects.toThrow('stream closed');
        });

        it('keeps the first settlement', async () => {
            const { promise, resolve, reject } = deferred();
            resolve('pending');
            reject(new Error('stream closed'));
            await expect(promise).resolves.toBe('pending');
        });

        it('leaves no unhandled rejection when nothing awaits it', async () => {
            const { promise, reject } = deferred();
            reject(new Error('stream closed'));
            // jest fails a test that leaves a rejection unhandled
            await tick();
            // a later reader still gets the rejection
            await expect(promise).rejects.toThrow('stream closed');
        });
    });
});
