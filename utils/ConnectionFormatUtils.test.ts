import ConnectionFormatUtils from './ConnectionFormatUtils';

// minimal valid DER: a SEQUENCE whose encoded length spans the buffer
const derCert = Buffer.from([0x30, 0x03, 0x02, 0x01, 0x01]);
const derCert2 = Buffer.from([0x30, 0x03, 0x02, 0x01, 0x02]);
// long-form length encoding (0x82), as real certificates use
const derCertLong = Buffer.concat([
    Buffer.from([0x30, 0x82, 0x01, 0x2c]),
    Buffer.alloc(300, 0x01)
]);
const toBase64Url = (buf: Buffer) =>
    buf
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

describe('ConnectionFormatUtils', () => {
    describe('processLndConnectUrl', () => {
        it('validates IPv4 lndconnect hosts properly', () => {
            expect(
                ConnectionFormatUtils.processLndConnectUrl(
                    'lndconnect://8.8.0.0:2056?&macaroon=0201b6'
                )
            ).toEqual({
                host: 'https://8.8.0.0',
                macaroonHex: 'd36d356f',
                port: '2056',
                enableTor: false
            });
        });

        it('validates IPv6 lndconnect hosts properly', () => {
            expect(
                ConnectionFormatUtils.processLndConnectUrl(
                    'lndconnect://[2604:2000::]:2056?&macaroon=0201b6'
                )
            ).toEqual({
                host: 'https://[2604:2000::]',
                macaroonHex: 'd36d356f',
                port: '2056',
                enableTor: false
            });
        });

        it('validates all params correctly', () => {
            expect(
                ConnectionFormatUtils.processLndConnectUrl(
                    'lndconnect://[2604:2000::]:2058?macaroon=0201b6&cert=a&otherParam=B'
                )
            ).toEqual({
                host: 'https://[2604:2000::]',
                macaroonHex: 'd36d356f',
                port: '2058',
                enableTor: false
            });
        });

        it('validates all params correctly - different order params', () => {
            expect(
                ConnectionFormatUtils.processLndConnectUrl(
                    `lndconnect://8.8.8.8:2059?otherParam=B&macaroon=0201b6&cert=${toBase64Url(
                        derCert
                    )}`
                )
            ).toEqual({
                host: 'https://8.8.8.8',
                macaroonHex: 'd36d356f',
                port: '2059',
                enableTor: false,
                pinnedCerts: [derCert.toString('base64')]
            });
        });

        it('validates onion addresses correctly', () => {
            expect(
                ConnectionFormatUtils.processLndConnectUrl(
                    `lndconnect://fasm2nfsakmn2dd.onion:2059?otherParam=B&macaroon=0201b6&cert=${toBase64Url(
                        derCert
                    )}`
                )
            ).toEqual({
                host: 'https://fasm2nfsakmn2dd.onion',
                macaroonHex: 'd36d356f',
                port: '2059',
                enableTor: true,
                pinnedCerts: [derCert.toString('base64')]
            });
        });

        it('normalizes base64url DER certs into base64 pins', () => {
            // long-form length encoding, as real certificates use
            expect(
                ConnectionFormatUtils.processLndConnectUrl(
                    `lndconnect://mynode.local:10009?cert=${toBase64Url(
                        derCertLong
                    )}&macaroon=0201b6`
                )
            ).toEqual({
                host: 'https://mynode.local',
                macaroonHex: 'd36d356f',
                port: '10009',
                enableTor: false,
                pinnedCerts: [derCertLong.toString('base64')]
            });
        });

        it('extracts the certificate from PEM-armored cert params', () => {
            const pem = `-----BEGIN CERTIFICATE-----\n${derCert.toString(
                'base64'
            )}\n-----END CERTIFICATE-----\n`;
            const cert = toBase64Url(Buffer.from(pem, 'utf8'));
            expect(
                ConnectionFormatUtils.processLndConnectUrl(
                    `lndconnect://mynode.local:10009?cert=${cert}&macaroon=0201b6`
                )
            ).toEqual({
                host: 'https://mynode.local',
                macaroonHex: 'd36d356f',
                port: '10009',
                enableTor: false,
                pinnedCerts: [derCert.toString('base64')]
            });
        });

        it('does not pin cert params that are not certificates', () => {
            // decodes fine as base64url, but is not DER — previously the
            // param was discarded outright, so garbage must not become a
            // stored pin that fails opaquely at connect time
            const result: any = ConnectionFormatUtils.processLndConnectUrl(
                'lndconnect://mynode.local:10009?cert=asfdaa&macaroon=0201b6'
            );
            expect(result.pinnedCerts).toBeUndefined();
            expect(result.host).toEqual('https://mynode.local');
        });

        it('does not pin truncated DER', () => {
            // valid SEQUENCE header, but the encoded length overruns the
            // buffer
            const truncated = toBase64Url(derCertLong.subarray(0, 200));
            const result: any = ConnectionFormatUtils.processLndConnectUrl(
                `lndconnect://mynode.local:10009?cert=${truncated}&macaroon=0201b6`
            );
            expect(result.pinnedCerts).toBeUndefined();
        });

        it('does not throw on malformed cert params', () => {
            // 'a' has an illegal base64url length — no pins, no throw
            const result: any = ConnectionFormatUtils.processLndConnectUrl(
                'lndconnect://mynode.local:10009?cert=a&macaroon=0201b6'
            );
            expect(result.pinnedCerts).toBeUndefined();
            expect(result.host).toEqual('https://mynode.local');
        });
    });

    describe('processLncUrl', () => {
        it('handles LNC configs to mailbox.terminal.lightning.today:443', () => {
            expect(
                ConnectionFormatUtils.processLncUrl(
                    'https://terminal.lightning.engineering#/connect/pair/ZmluZ2VyIHBvdGF0byBnbG9yeSBtYW5zaW9uIGRhcmluZyB2aWRlbyBhbmNpZW50IGhhcnZlc3QgZGVsaXZlciBjaXZpbHx8bWFpbGJveC50ZXJtaW5hbC5saWdodG5pbmcudG9kYXk6NDQz'
                )
            ).toEqual({
                pairingPhrase:
                    'finger potato glory mansion daring video ancient harvest deliver civil',
                mailboxServer: 'mailbox.terminal.lightning.today:443',
                customMailboxServer: undefined
            });
        });

        it('handles LNC configs to lnc.zeusln.app:443', () => {
            expect(
                ConnectionFormatUtils.processLncUrl(
                    'https://terminal.lightning.engineering#/connect/pair/ZHVtYiBtaXN0YWtlIGxhbXAgY2hlZXNlIGNhYmxlIHNrYXRlIGZpZWxkIHRpZGUgcmV0cmVhdCBtZWF0fHxsbmMuemV1c2xuLmFwcDo0NDM='
                )
            ).toEqual({
                pairingPhrase:
                    'dumb mistake lamp cheese cable skate field tide retreat meat',
                mailboxServer: 'lnc.zeusln.app:443',
                customMailboxServer: undefined
            });
        });

        it('handles LNC configs to custom mailboxes', () => {
            expect(
                ConnectionFormatUtils.processLncUrl(
                    'https://terminal.lightning.engineering#/connect/pair/c2thdGUgZmllbGQgdGlkZSBjaGVlc2UgY2FibGUgc2thdGUgZmllbGQgdGlkZSByZXRyZWF0IG1lYXR8fGN1c3RvbS1sbmMuc2VydmVyLmFwcDo0NDM='
                )
            ).toEqual({
                pairingPhrase:
                    'skate field tide cheese cable skate field tide retreat meat',
                mailboxServer: 'custom-defined',
                customMailboxServer: 'custom-lnc.server.app:443'
            });
        });
    });

    describe('processCLNRestConnectUrl', () => {
        it('handles plainnet properly - w/o http forced', () => {
            expect(
                ConnectionFormatUtils.processCLNRestConnectUrl(
                    'clnrest://8.8.0.0:2056?&rune=OSqc7ixY6F-gjcigBfxtzKUI54uzgFSA6YfBQoWGDV89MA==&protocol=http'
                )
            ).toEqual({
                host: 'https://8.8.0.0',
                rune: 'OSqc7ixY6F-gjcigBfxtzKUI54uzgFSA6YfBQoWGDV89MA==',
                port: '2056',
                enableTor: false,
                implementation: 'cln-rest'
            });
        });

        it('handles plainnet properly - with http forced', () => {
            expect(
                ConnectionFormatUtils.processCLNRestConnectUrl(
                    'clnrest://http://8.8.0.0:2056?&rune=OSqc7ixY6F-gjcigBfxtzKUI54uzgFSA6YfBQoWGDV89MA==&protocol=http'
                )
            ).toEqual({
                host: 'http://8.8.0.0',
                rune: 'OSqc7ixY6F-gjcigBfxtzKUI54uzgFSA6YfBQoWGDV89MA==',
                port: '2056',
                enableTor: false,
                implementation: 'cln-rest'
            });
        });

        it('handles Tor properly', () => {
            expect(
                ConnectionFormatUtils.processCLNRestConnectUrl(
                    'clnrest://http://y7enfk2mdfawf.onion:2056?&rune=OSqc7ixY6F-gjcigBfxtzKUI54uzgFSA6YfBQoWGDV89MA==&protocol=http'
                )
            ).toEqual({
                host: 'http://y7enfk2mdfawf.onion',
                rune: 'OSqc7ixY6F-gjcigBfxtzKUI54uzgFSA6YfBQoWGDV89MA==',
                port: '2056',
                enableTor: true,
                implementation: 'cln-rest'
            });
        });

        it('handles new format clnrest+https:// properly', () => {
            expect(
                ConnectionFormatUtils.processCLNRestConnectUrl(
                    'clnrest+https://cln.local:3010?rune=8hJ6ZKFvRune&certs=LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0t'
                )
            ).toEqual({
                host: 'https://cln.local',
                rune: '8hJ6ZKFvRune',
                port: '3010',
                enableTor: false,
                implementation: 'cln-rest'
            });
        });

        it('handles new format clnrest+http:// properly', () => {
            expect(
                ConnectionFormatUtils.processCLNRestConnectUrl(
                    'clnrest+http://192.168.1.100:3010?rune=testRune123&certs=LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0t'
                )
            ).toEqual({
                host: 'http://192.168.1.100',
                rune: 'testRune123',
                port: '3010',
                enableTor: false,
                implementation: 'cln-rest'
            });
        });

        it('handles new format with IPv6', () => {
            expect(
                ConnectionFormatUtils.processCLNRestConnectUrl(
                    'clnrest+https://[2604:2000::]:3010?rune=8hJ6ZKFvRune&certs=LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0t'
                )
            ).toEqual({
                host: 'https://[2604:2000::]',
                rune: '8hJ6ZKFvRune',
                port: '3010',
                enableTor: false,
                implementation: 'cln-rest'
            });
        });

        it('handles new format with Tor address', () => {
            expect(
                ConnectionFormatUtils.processCLNRestConnectUrl(
                    'clnrest+https://y7enfk2mdfawf.onion:3010?rune=8hJ6ZKFvRune&certs=LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0t'
                )
            ).toEqual({
                host: 'https://y7enfk2mdfawf.onion',
                rune: '8hJ6ZKFvRune',
                port: '3010',
                enableTor: true,
                implementation: 'cln-rest'
            });
        });

        it('pins every certificate in the certs PEM bundle, skipping keys', () => {
            const bundle = [
                '-----BEGIN PRIVATE KEY-----\nUFJJVkFURUtFWQ==\n-----END PRIVATE KEY-----',
                `-----BEGIN CERTIFICATE-----\n${derCert.toString(
                    'base64'
                )}\n-----END CERTIFICATE-----`,
                `-----BEGIN CERTIFICATE-----\n${derCert2.toString(
                    'base64'
                )}\n-----END CERTIFICATE-----`
            ].join('\n');
            const certs = Buffer.from(bundle, 'utf8').toString('base64');
            expect(
                ConnectionFormatUtils.processCLNRestConnectUrl(
                    `clnrest+https://cln.local:3010?rune=8hJ6ZKFvRune&certs=${certs}`
                )
            ).toEqual({
                host: 'https://cln.local',
                rune: '8hJ6ZKFvRune',
                port: '3010',
                enableTor: false,
                implementation: 'cln-rest',
                pinnedCerts: [
                    derCert.toString('base64'),
                    derCert2.toString('base64')
                ]
            });
        });

        it('drops certificate blocks that do not carry DER', () => {
            const bundle = [
                '-----BEGIN CERTIFICATE-----\nbm90LWEtY2VydA==\n-----END CERTIFICATE-----',
                `-----BEGIN CERTIFICATE-----\n${derCert.toString(
                    'base64'
                )}\n-----END CERTIFICATE-----`
            ].join('\n');
            const certs = Buffer.from(bundle, 'utf8').toString('base64');
            const result: any = ConnectionFormatUtils.processCLNRestConnectUrl(
                `clnrest+https://cln.local:3010?rune=8hJ6ZKFvRune&certs=${certs}`
            );
            expect(result.pinnedCerts).toEqual([derCert.toString('base64')]);
        });

        it('sets no pins when the certs bundle has no certificate block', () => {
            const result: any = ConnectionFormatUtils.processCLNRestConnectUrl(
                'clnrest+https://cln.local:3010?rune=8hJ6ZKFvRune&certs=LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0t'
            );
            expect(result.pinnedCerts).toBeUndefined();
        });
    });
});
