import ConnectionFormatUtils from './ConnectionFormatUtils';

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
                    'lndconnect://8.8.8.8:2059?otherParam=B&macaroon=0201b6&cert=asfdaa'
                )
            ).toEqual({
                host: 'https://8.8.8.8',
                macaroonHex: 'd36d356f',
                port: '2059',
                enableTor: false
            });
        });

        it('validates onion addresses correctly', () => {
            expect(
                ConnectionFormatUtils.processLndConnectUrl(
                    'lndconnect://fasm2nfsakmn2dd.onion:2059?otherParam=B&macaroon=0201b6&cert=asfdaa'
                )
            ).toEqual({
                host: 'https://fasm2nfsakmn2dd.onion',
                macaroonHex: 'd36d356f',
                port: '2059',
                enableTor: true
            });
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

    describe('processCLightningRestConnectUrl', () => {
        it('handles plainnet properly - w/o http forced', () => {
            expect(
                ConnectionFormatUtils.processCLightningRestConnectUrl(
                    'c-lightning-rest://8.8.0.0:2056?&macaroon=0201b6&protocol=http'
                )
            ).toEqual({
                host: 'https://8.8.0.0',
                macaroonHex: '0201b6',
                port: '2056',
                enableTor: false,
                implementation: 'c-lightning-REST'
            });
        });

        it('handles plainnet properly - with http forced', () => {
            expect(
                ConnectionFormatUtils.processCLightningRestConnectUrl(
                    'c-lightning-rest://http://8.8.0.0:2056?&macaroon=0201b6&protocol=http'
                )
            ).toEqual({
                host: 'http://8.8.0.0',
                macaroonHex: '0201b6',
                port: '2056',
                enableTor: false,
                implementation: 'c-lightning-REST'
            });
        });

        it('handles Tor properly', () => {
            expect(
                ConnectionFormatUtils.processCLightningRestConnectUrl(
                    'c-lightning-rest://http://y7enfk2mdfawf.onion:2056?&macaroon=0201b6&protocol=http'
                )
            ).toEqual({
                host: 'http://y7enfk2mdfawf.onion',
                macaroonHex: '0201b6',
                port: '2056',
                enableTor: true,
                implementation: 'c-lightning-REST'
            });
        });
    });
});
