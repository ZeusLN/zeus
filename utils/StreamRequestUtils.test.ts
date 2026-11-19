import { isEventForRequest, newStreamRequestId } from './StreamRequestUtils';

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
});
