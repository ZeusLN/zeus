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
                macaroonHex: 'D36D356F',
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
                macaroonHex: 'D36D356F',
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
                macaroonHex: 'D36D356F',
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
                macaroonHex: 'D36D356F',
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
                macaroonHex: 'D36D356F',
                port: '2059',
                enableTor: true
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
