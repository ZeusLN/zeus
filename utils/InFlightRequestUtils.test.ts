import { inFlightRequestKey } from './InFlightRequestUtils';

describe('inFlightRequestKey', () => {
    const url = 'https://node.example.com:8080/v1/channels';

    it('is stable for the same headers, url and body', () => {
        expect(inFlightRequestKey({ Rune: 'a' }, url, { n: 1 })).toBe(
            inFlightRequestKey({ Rune: 'a' }, url, { n: 1 })
        );
    });

    it('differs when only the credential differs', () => {
        expect(
            inFlightRequestKey({ 'Grpc-Metadata-macaroon': 'aa' }, url)
        ).not.toBe(inFlightRequestKey({ 'Grpc-Metadata-macaroon': 'bb' }, url));
        expect(inFlightRequestKey({ Authorization: 'Bearer a' }, url)).not.toBe(
            inFlightRequestKey({ Authorization: 'Bearer b' }, url)
        );
    });

    it('differs when the url or body differs', () => {
        const headers = { Rune: 'a' };
        expect(inFlightRequestKey(headers, url)).not.toBe(
            inFlightRequestKey(headers, `${url}/x`)
        );
        expect(inFlightRequestKey(headers, url, { n: 1 })).not.toBe(
            inFlightRequestKey(headers, url, { n: 2 })
        );
    });

    it('does not contain the credential itself', () => {
        const key = inFlightRequestKey(
            { 'Grpc-Metadata-macaroon': '0201036c6e64' },
            url
        );
        expect(key).not.toContain('0201036c6e64');
        expect(key).toMatch(/^[0-9a-f]{64}:/);
    });

    it('accepts missing headers', () => {
        expect(inFlightRequestKey(undefined, url)).toBe(`:${url}`);
    });
});
