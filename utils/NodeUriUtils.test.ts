import NodeUriUtils from './NodeUriUtils';

describe('NodeUriUtils', () => {
    describe('isValidNodeUri', () => {
        it('validates node URIs properly', () => {
            expect(NodeUriUtils.isValidNodeUri('a')).toBeFalsy();
            expect(
                // pubkey too short
                NodeUriUtils.isValidNodeUri(
                    'afffcfd8f4e07d9129d898@zg6ziy65wqhiczqfqupx26j5yjot5iuxftqtiyvika3xoydc5hx2mtyd.onion:9735'
                )
            ).toBeFalsy();
            expect(
                NodeUriUtils.isValidNodeUri(
                    '03e1210c8d4b236a53191bb172701d76ec06dfa869a1afffcfd8f4e07d9129d898@zg6ziy65wqhiczqfqupx26j5yjot5iuxftqtiyvika3xoydc5hx2mtyd.onion:9735'
                )
            ).toBeTruthy();
            expect(
                NodeUriUtils.isValidNodeUri(
                    '03e1210c8d4b236a53191bb172701d76ec06dfa869a1afffcfd8f4e07d9129d898@0.0.0.0:9735'
                )
            ).toBeTruthy();
        });
    });
});
