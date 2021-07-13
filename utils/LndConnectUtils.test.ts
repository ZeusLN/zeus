import LndConnectUtils from './LndConnectUtils';

describe('LndConnectUtils', () => {
    describe('processLndConnectUrl', () => {
        it('validates IPv4 lndconnect hosts properly', () => {
            expect(
                LndConnectUtils.processLndConnectUrl(
                    'lndconnect://8.8.0.0:2056?&macaroon=Z28gc2hvcnR5'
                )
            ).toEqual({
                host: 'https://8.8.0.0',
                macaroonHex: '676F2073686F727479',
                port: '2056',
                enableTor: false
            });
        });

        it('validates IPv6 lndconnect hosts properly', () => {
            expect(
                LndConnectUtils.processLndConnectUrl(
                    'lndconnect://[2604:2000::]:2056?&macaroon=Z28gc2hvcnR5'
                )
            ).toEqual({
                host: 'https://[2604:2000::]',
                macaroonHex: '676F2073686F727479',
                port: '2056',
                enableTor: false
            });
        });

        it('validates all params correctly', () => {
            expect(
                LndConnectUtils.processLndConnectUrl(
                    'lndconnect://[2604:2000::]:2058?macaroon=Z28gc2hvcnR5&cert=a&otherParam=B'
                )
            ).toEqual({
                host: 'https://[2604:2000::]',
                macaroonHex: '676F2073686F727479',
                port: '2058',
                enableTor: false
            });
        });

        it('validates all params correctly - different order params', () => {
            expect(
                LndConnectUtils.processLndConnectUrl(
                    'lndconnect://8.8.8.8:2059?otherParam=B&macaroon=Z28gc2hvcnR5&cert=asfdaa'
                )
            ).toEqual({
                host: 'https://8.8.8.8',
                macaroonHex: '676F2073686F727479',
                port: '2059',
                enableTor: false
            });
        });

        it('validates onion addresses correctly', () => {
            expect(
                LndConnectUtils.processLndConnectUrl(
                    'lndconnect://fasm2nfsakmn2dd.onion:2059?otherParam=B&macaroon=Z28gc2hvcnR5&cert=asfdaa'
                )
            ).toEqual({
                host: 'https://fasm2nfsakmn2dd.onion',
                macaroonHex: '676F2073686F727479',
                port: '2059',
                enableTor: true
            });
        });
    });
});
