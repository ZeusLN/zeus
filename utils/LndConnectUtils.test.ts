import LndConnectUtils from './LndConnectUtils';

describe('LndConnectUtils', () => {
    describe('processLndConnectUrl', () => {
        it('validates IPv4 lndconnect hosts properly', () => {
            expect(
                LndConnectUtils.processLndConnectUrl(
                    'lndconnect://8.8.0.0:2056?&macaroon=Z28gc2hvcnR5'
                )
            ).toEqual({
                host: '8.8.0.0',
                macaroonHex: '676F2073686F727479',
                port: '2056'
            });
        });

        it('validates IPv6 lndconnect hosts properly', () => {
            expect(
                LndConnectUtils.processLndConnectUrl(
                    'lndconnect://[2604:2000::]:2056?&macaroon=Z28gc2hvcnR5'
                )
            ).toEqual({
                host: '[2604:2000::]',
                macaroonHex: '676F2073686F727479',
                port: '2056'
            });
        });
    });
});
