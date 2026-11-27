import { inFlightRequestKey } from './InFlightRequestUtils';

describe('inFlightRequestKey', () => {
    const url = 'https://node.example.com:8080/v1/channels';

    it('prefixes the key with sha256 of the JSON headers', () => {
        // sha256 of {"Grpc-Metadata-macaroon":"abcd"}, computed with Node's crypto
        expect(
            inFlightRequestKey({ 'Grpc-Metadata-macaroon': 'abcd' }, url)
        ).toBe(
            `f034b2640f02f96d9430fe4cc5019cc2d31bffe6cded51f9acb1cb388d60f2b5:${url}`
        );
    });

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

    describe('TLS settings', () => {
        const headers = { Rune: 'a' };
        const pin = 'MIIBszCCAVmgAwIBAgIUQ';
        const otherPin = 'MIIBszCCAVmgAwIBAgIUR';

        it('is stable for the same verification mode and pins', () => {
            expect(
                inFlightRequestKey(headers, url, undefined, {
                    certVerification: true,
                    pinnedCerts: [pin]
                })
            ).toBe(
                inFlightRequestKey(headers, url, undefined, {
                    certVerification: true,
                    pinnedCerts: [pin]
                })
            );
        });

        it('differs when only the verification mode differs', () => {
            expect(
                inFlightRequestKey(headers, url, undefined, {
                    certVerification: true
                })
            ).not.toBe(
                inFlightRequestKey(headers, url, undefined, {
                    certVerification: false
                })
            );
        });

        it('differs when only the pins differ', () => {
            const key = (pinnedCerts?: string[]) =>
                inFlightRequestKey(headers, url, undefined, {
                    certVerification: true,
                    pinnedCerts
                });
            expect(key([pin])).not.toBe(key([otherPin]));
            expect(key([pin])).not.toBe(key(undefined));
            expect(key([pin])).not.toBe(key([pin, otherPin]));
        });

        it('treats no pins and an empty pin list alike', () => {
            expect(
                inFlightRequestKey(headers, url, undefined, {
                    certVerification: true,
                    pinnedCerts: []
                })
            ).toBe(
                inFlightRequestKey(headers, url, undefined, {
                    certVerification: true
                })
            );
        });

        it('holds a hash of the pins, not the pins', () => {
            const key = inFlightRequestKey(headers, url, undefined, {
                certVerification: true,
                pinnedCerts: [pin]
            });
            expect(key).not.toContain(pin);
            expect(key).toMatch(/^verify:[0-9a-f]{64}:[0-9a-f]{64}:/);
        });
    });
});
