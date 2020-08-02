import JsonUtils from './JsonUtils';

describe('JsonUtils', () => {
    describe('parseWebsocketJson', () => {
        it('parses JSON from websocket responses correctly', () => {
            expect(
                JsonUtils.parseWebsocketJson(
                    '{"results":{"payment_hash":"a"}}{"results":{"payment_hash":"b"}}'
                )
            ).toEqual({
                results: {
                    payment_hash: 'b'
                }
            });
            expect(
                JsonUtils.parseWebsocketJson('{"results":{"payment_hash":"c"}}')
            ).toEqual({
                results: {
                    payment_hash: 'c'
                }
            });
            expect(
                JsonUtils.parseWebsocketJson(
                    '{"results":{"payment_hash":"a"}}{"results":{"payment_hash":"k"}}{"results":{"payment_hash":"z"}}'
                )
            ).toEqual({
                results: {
                    payment_hash: 'z'
                }
            });
            expect(
                JsonUtils.parseWebsocketJson(
                    '{"result":{"payment_hash":"a","value":"350000","creation_date":"1596403398","fee":"0","payment_preimage":"0000000000000000000000000000000000000000000000000000000000000000","value_sat":"350000","value_msat":"350000000","payment_request":"lnbcrt3500u1p0jwtjkpp50038suex6mt5ul5f5hxdq870f2c4lm3uqdx3pk6wzyfq9q5tl6esdqqcqzpgsp5fyldyf0pz4k5rzd5w247s5qnseskcfggrh0pl45u2z87l5dznlus9qy9qsqsx32x088f6neck6llc8ayfv4vdwpr2nasscmtz55t7r58zfjhh7x4n75f0jxasjpd5c6pwaujgku20dphjs4cv22uc4emktw4l8djtcqm4ntck","status":"IN_FLIGHT","fee_sat":"0","fee_msat":"0","creation_time_ns":"1596403398908750900","htlcs":[],"payment_index":"19","failure_reason":"FAILURE_REASON_NONE"}}{"result":{"payment_hash":"b","value":"350000","creation_date":"1596403398","fee":"0","payment_preimage":"0000000000000000000000000000000000000000000000000000000000000000","value_sat":"350000","value_msat":"350000000","payment_request":"lnbcrt3500u1p0jwtjkpp50038suex6mt5ul5f5hxdq870f2c4lm3uqdx3pk6wzyfq9q5tl6esdqqcqzpgsp5fyldyf0pz4k5rzd5w247s5qnseskcfggrh0pl45u2z87l5dznlus9qy9qsqsx32x088f6neck6llc8ayfv4vdwpr2nasscmtz55t7r58zfjhh7x4n75f0jxasjpd5c6pwaujgku20dphjs4cv22uc4emktw4l8djtcqm4ntck","status":"FAILED","fee_sat":"0","fee_msat":"0","creation_time_ns":"1596403398908750900","htlcs":[],"payment_index":"19","failure_reason":"FAILURE_REASON_NO_ROUTE"}}'
                )
            ).toEqual({
                result: {
                    creation_date: '1596403398',
                    creation_time_ns: '1596403398908750900',
                    failure_reason: 'FAILURE_REASON_NO_ROUTE',
                    fee: '0',
                    fee_msat: '0',
                    fee_sat: '0',
                    htlcs: [],
                    payment_hash: 'b',
                    payment_index: '19',
                    payment_preimage:
                        '0000000000000000000000000000000000000000000000000000000000000000',
                    payment_request:
                        'lnbcrt3500u1p0jwtjkpp50038suex6mt5ul5f5hxdq870f2c4lm3uqdx3pk6wzyfq9q5tl6esdqqcqzpgsp5fyldyf0pz4k5rzd5w247s5qnseskcfggrh0pl45u2z87l5dznlus9qy9qsqsx32x088f6neck6llc8ayfv4vdwpr2nasscmtz55t7r58zfjhh7x4n75f0jxasjpd5c6pwaujgku20dphjs4cv22uc4emktw4l8djtcqm4ntck',
                    status: 'FAILED',
                    value: '350000',
                    value_msat: '350000000',
                    value_sat: '350000'
                }
            });
        });
    });
});
