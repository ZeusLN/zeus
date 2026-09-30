import { lnrpc } from '../proto/lightning';

// ListChannelsResponse.channels is field 11, length-delimited
const CHANNELS_TAG = (11 << 3) | 2;
// Channel.remote_pubkey is field 2, length-delimited
const REMOTE_PUBKEY_TAG = (2 << 3) | 2;

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

describe('generated lnrpc bindings', () => {
    it('round-trips a response with nested messages', () => {
        const encoded = lnrpc.ListChannelsResponse.encode({
            channels: [
                { remote_pubkey: 'abc', initiator: true },
                { remote_pubkey: 'def', active: true }
            ]
        }).finish();

        const decoded = lnrpc.ListChannelsResponse.decode(encoded);

        expect(decoded.channels).toHaveLength(2);
        expect(decoded.channels[0].remote_pubkey).toBe('abc');
        expect(decoded.channels[0].initiator).toBe(true);
        expect(decoded.channels[1].remote_pubkey).toBe('def');
        expect(decoded.channels[1].active).toBe(true);
    });

    it('rejects a nested message whose length ends mid-field', () => {
        // The nested Channel claims 3 bytes, but its remote_pubkey field
        // needs 7. Older generated code read past the nested boundary and
        // returned remote_pubkey 'abcde'.
        const bytes = Uint8Array.from([
            CHANNELS_TAG,
            3,
            REMOTE_PUBKEY_TAG,
            5,
            ...ascii('abcde')
        ]);

        expect(() => lnrpc.ListChannelsResponse.decode(bytes)).toThrow(
            RangeError
        );
    });

    it('rejects a nested message longer than the buffer', () => {
        const bytes = Uint8Array.from([
            CHANNELS_TAG,
            20,
            REMOTE_PUBKEY_TAG,
            3,
            ...ascii('abc')
        ]);

        expect(() => lnrpc.ListChannelsResponse.decode(bytes)).toThrow(
            RangeError
        );
    });
});
