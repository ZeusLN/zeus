import NodeUriUtils from './NodeUriUtils';

describe('NodeUriUtils', () => {
    describe('isValidNodeUri', () => {
        it('validates plainnet node URIs properly', () => {
            expect(
                NodeUriUtils.isValidNodeUri(
                    '03c9419fc4ea899cafbcc993daa0a26d1ef60eb4098367893619a6218f78b049f6@95.88.253.103:9735'
                )
            ).toBeTruthy();
            expect(
                NodeUriUtils.isValidNodeUri(
                    '026165850492521f4ac8abd9bd8088123446d126f648ca35e60f88177dc149ceb2@104.196.200.39:9735'
                )
            ).toBeTruthy();
            expect(
                NodeUriUtils.isValidNodeUri(
                    '02de11c748f5b25cfd2ce801176d3926bfde4de23b1ff43e692a5b76cf06805e4a@46.229.165.146:9735'
                )
            ).toBeTruthy();
        });

        it('validates Tor node URIs properly', () => {
            expect(
                NodeUriUtils.isValidNodeUri(
                    '02c5ab2673a95f344fa3b937c0fd60ae2f49cebd8424ff089db4685c7c5d5886d9@whc5vixkyjjhavrubozbspljlgxgavlolqcag57kpm4edhr5fz5hmxid.onion:9735'
                )
            ).toBeTruthy();
            expect(
                NodeUriUtils.isValidNodeUri(
                    '031d93a4513dfdeece33fb684ed909fd85317e0229ade179b47e8dd601e91013c1@fcuri6zsxvrzjmor6hk44v2nmmxqciagogeap3febrreuvcuglai3fad.onion:9735'
                )
            ).toBeTruthy();
            expect(
                NodeUriUtils.isValidNodeUri(
                    '03f444a11add98f1b681e3f51a197521d48614d2844fbe96699ee9522fba1f086f@73sxsuuuwexpuwuin4yflkfyabelwddhka2hnum63m4pt5ach2cwuaad.onion:9735'
                )
            ).toBeTruthy();
        });
    });

    describe('processNodeUri', () => {
        it('processes node URIs properly', () => {
            expect(
                NodeUriUtils.processNodeUri(
                    '03e1210c8d4b236a53191bb172701d76ec06dfa869a1afffcfd8f4e07d9129d898@0.0.0.0:9735'
                )
            ).toEqual({
                pubkey: '03e1210c8d4b236a53191bb172701d76ec06dfa869a1afffcfd8f4e07d9129d898',
                host: '0.0.0.0:9735'
            });
        });
    });
});
