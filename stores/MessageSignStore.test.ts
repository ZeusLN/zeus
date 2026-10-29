jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        signMessage: jest.fn(),
        signMessageWithAddr: jest.fn(),
        verifyMessage: jest.fn(),
        verifyMessageWithAddr: jest.fn(),
        listAddresses: jest.fn()
    }
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/AddressUtils', () => ({
    __esModule: true,
    default: {
        getAddressType: jest.fn((addr: string) => `type-of-${addr}`)
    }
}));

import MessageSignStore from './MessageSignStore';
import BackendUtils from '../utils/BackendUtils';

const backend = BackendUtils as unknown as Record<string, jest.Mock>;

// Lets the promise chains inside the store (then/catch/finally) settle
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('MessageSignStore', () => {
    let store: MessageSignStore;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
        store = new MessageSignStore();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('initial state', () => {
        it('starts in lightning mode with no error and no addresses', () => {
            expect(store.signingMode).toBe('lightning');
            expect(store.error).toBe(false);
            expect(store.errorMessage).toBe('');
            expect(store.loading).toBe(false);
            expect(store.selectedAddress).toBe('');
            expect(store.addresses).toEqual([]);
        });
    });

    describe('setSigningMode / setSelectedAddress', () => {
        it('switches the signing mode', () => {
            store.setSigningMode('onchain');
            expect(store.signingMode).toBe('onchain');
        });

        it('resets results and selected address when the mode changes', () => {
            store.signature = 'sig';
            store.valid = true;
            store.setSelectedAddress('bc1qabc');

            store.setSigningMode('onchain');

            expect(store.signature).toBeNull();
            expect(store.valid).toBeNull();
            expect(store.selectedAddress).toBe('');
        });

        it('stores the selected address', () => {
            store.setSelectedAddress('bc1qabc');
            expect(store.selectedAddress).toBe('bc1qabc');
        });
    });

    describe('reset', () => {
        it('clears signature, pubkey, valid, error, errorMessage and selectedAddress', () => {
            store.signature = 'sig';
            store.pubkey = 'pk';
            store.valid = true;
            store.error = true;
            store.errorMessage = 'boom';
            store.selectedAddress = 'bc1qabc';

            store.reset();

            expect(store.signature).toBeNull();
            expect(store.pubkey).toBeNull();
            expect(store.valid).toBeNull();
            expect(store.error).toBe(false);
            expect(store.errorMessage).toBe('');
            expect(store.selectedAddress).toBe('');
        });

        it('leaves the loaded address list, loading flag and signing mode alone', () => {
            store.addresses = [{ address: 'bc1qabc', type: 'p2wpkh' }];
            store.loading = true;
            store.signingMode = 'onchain';

            store.reset();

            expect(store.addresses).toHaveLength(1);
            expect(store.loading).toBe(true);
            expect(store.signingMode).toBe('onchain');
        });
    });

    describe('signMessage (lightning)', () => {
        it('stores the zbase signature and resolves to it', async () => {
            backend.signMessage.mockResolvedValue({ zbase: 'zb' });

            const result = await store.signMessage('hello');

            expect(backend.signMessage).toHaveBeenCalledWith('hello');
            expect(backend.signMessageWithAddr).not.toHaveBeenCalled();
            expect(result).toBe('zb');
            expect(store.signature).toBe('zb');
        });

        it('falls back to the signature field when zbase is absent', async () => {
            backend.signMessage.mockResolvedValue({ signature: 'plain' });

            expect(await store.signMessage('hello')).toBe('plain');
            expect(store.signature).toBe('plain');
        });

        it('clears a previous error on success', async () => {
            store.error = true;
            store.errorMessage = 'old';
            backend.signMessage.mockResolvedValue({ zbase: 'zb' });

            await store.signMessage('hello');

            expect(store.error).toBe(false);
            expect(store.errorMessage).toBe('');
        });

        it('clears loading once the operation settles', async () => {
            backend.signMessage.mockResolvedValue({ zbase: 'zb' });

            const pending = store.signMessage('hello');
            expect(store.loading).toBe(true);
            await pending;

            expect(store.loading).toBe(false);
        });

        it('uses an explicit mode argument without mutating signingMode', async () => {
            store.signingMode = 'onchain';
            store.selectedAddress = 'bc1qabc';
            backend.signMessage.mockResolvedValue({ zbase: 'zb' });

            await store.signMessage('hello', 'lightning');

            expect(backend.signMessage).toHaveBeenCalledWith('hello');
            expect(backend.signMessageWithAddr).not.toHaveBeenCalled();
            expect(store.signingMode).toBe('onchain');
        });

        it('resolves to null and reports the localized error when the backend returns no data', async () => {
            backend.signMessage.mockResolvedValue(undefined);

            const result = await store.signMessage('hello');

            expect(result).toBeNull();
            expect(store.error).toBe(true);
            expect(store.errorMessage).toBe(
                'views.Settings.SignMessage.noDataReceived'
            );
        });

        it('resolves to null when the response carries neither zbase nor signature', async () => {
            backend.signMessage.mockResolvedValue({});

            expect(await store.signMessage('hello')).toBeNull();
        });

        it('reports signOperationFailed when the backend returns a non-promise (call() returned false)', async () => {
            backend.signMessage.mockReturnValue(false);

            const result = await store.signMessage('hello');

            expect(result).toBeNull();
            expect(store.error).toBe(true);
            expect(store.errorMessage).toBe(
                'views.Settings.SignMessage.signOperationFailed'
            );
            expect(store.loading).toBe(false);
        });

        it('handles a synchronous throw from the backend', async () => {
            backend.signMessage.mockImplementation(() => {
                throw new Error('sync boom');
            });

            const result = await store.signMessage('hello');

            expect(result).toBeNull();
            expect(store.error).toBe(true);
            expect(store.errorMessage).toBe('sync boom');
            expect(store.loading).toBe(false);
        });
    });

    describe('signMessage (on-chain)', () => {
        beforeEach(() => {
            store.setSigningMode('onchain');
            store.setSelectedAddress('bc1qabc');
        });

        it('signs with signMessageWithAddr and the selected address', async () => {
            backend.signMessageWithAddr.mockResolvedValue({
                signature: 'onchain-sig'
            });

            const result = await store.signMessage('hello');

            expect(backend.signMessageWithAddr).toHaveBeenCalledWith(
                'hello',
                'bc1qabc'
            );
            expect(backend.signMessage).not.toHaveBeenCalled();
            expect(result).toBe('onchain-sig');
            expect(store.signature).toBe('onchain-sig');
        });

        it('lets an explicit onchain mode override a lightning signingMode', async () => {
            store.signingMode = 'lightning';
            backend.signMessageWithAddr.mockResolvedValue({ signature: 's' });

            await store.signMessage('hello', 'onchain');

            expect(backend.signMessageWithAddr).toHaveBeenCalledWith(
                'hello',
                'bc1qabc'
            );
        });
    });

    describe('signMessage error parsing', () => {
        const rejectWith = async (reason: any) => {
            backend.signMessage.mockRejectedValue(reason);
            return store.signMessage('hello');
        };

        it('sets error, resolves to null and clears prior results on rejection', async () => {
            store.signature = 'stale';
            store.pubkey = 'stale';
            store.valid = true;

            const result = await rejectWith(new Error('nope'));

            expect(result).toBeNull();
            expect(store.error).toBe(true);
            expect(store.signature).toBeNull();
            expect(store.pubkey).toBeNull();
            expect(store.valid).toBeNull();
            expect(store.loading).toBe(false);
        });

        it('uses the message field of a JSON-encoded Error message', async () => {
            await rejectWith(new Error(JSON.stringify({ message: 'inner' })));
            expect(store.errorMessage).toBe('inner');
        });

        it('keeps the raw Error message when the JSON has no message field', async () => {
            const raw = JSON.stringify({ code: 5 });
            await rejectWith(new Error(raw));
            expect(store.errorMessage).toBe(raw);
        });

        it('keeps the raw Error message when it is not JSON', async () => {
            await rejectWith(new Error('plain failure'));
            expect(store.errorMessage).toBe('plain failure');
        });

        it('extracts the message from JSON embedded in toString() of a message-less object', async () => {
            await rejectWith({
                toString: () => 'rpc error: {"message":"from toString"}'
            });
            expect(store.errorMessage).toBe('from toString');
        });

        it('returns the toString() text when embedded JSON has no message field', async () => {
            await rejectWith({ toString: () => 'rpc error: {"code":1}' });
            expect(store.errorMessage).toBe('rpc error: {"code":1}');
        });

        it('returns the toString() text when embedded JSON is malformed', async () => {
            await rejectWith({ toString: () => 'rpc error: {not json}' });
            expect(store.errorMessage).toBe('rpc error: {not json}');
        });

        it('returns the toString() text of a message-less object without JSON', async () => {
            await rejectWith({ toString: () => 'just text' });
            expect(store.errorMessage).toBe('just text');
        });

        it('returns the fallback for an object with neither message nor toString', async () => {
            await rejectWith(Object.create(null));
            expect(store.errorMessage).toBe('Unknown signing error');
        });

        it('uses a string rejection as the message', async () => {
            await rejectWith('string failure');
            expect(store.errorMessage).toBe('string failure');
        });

        it('uses the fallback message for an undefined rejection', async () => {
            await rejectWith(undefined);
            expect(store.errorMessage).toBe('Unknown signing error');
        });
    });

    describe('verifyMessage (lightning)', () => {
        const request = { msg: 'hello', signature: 'zb', pubkey: '02ab' };

        it('marks the message valid and records the pubkey', async () => {
            backend.verifyMessage.mockResolvedValue({
                valid: true,
                pubkey: '02ab'
            });

            store.verifyMessage(request);
            await flush();

            expect(backend.verifyMessage).toHaveBeenCalledWith({
                msg: 'hello',
                signature: 'zb',
                pubkey: '02ab'
            });
            expect(store.valid).toBe(true);
            expect(store.pubkey).toBe('02ab');
            expect(store.error).toBe(false);
            expect(store.loading).toBe(false);
        });

        it('marks the message invalid when the backend says so', async () => {
            backend.verifyMessage.mockResolvedValue({ valid: false });

            store.verifyMessage(request);
            await flush();

            expect(store.valid).toBe(false);
            expect(store.pubkey).toBeNull();
            expect(store.error).toBe(false);
        });

        it('accepts the verified/publicKey response shape', async () => {
            backend.verifyMessage.mockResolvedValue({
                verified: true,
                publicKey: '03cd'
            });

            store.verifyMessage(request);
            await flush();

            expect(store.valid).toBe(true);
            expect(store.pubkey).toBe('03cd');
        });

        it('hex-encodes a Uint8Array pubkey', async () => {
            backend.verifyMessage.mockResolvedValue({
                valid: true,
                pubkey: new Uint8Array([0, 15, 255])
            });

            store.verifyMessage(request);
            await flush();

            expect(store.pubkey).toBe('000fff');
        });

        it('clears a previous error on success', async () => {
            store.error = true;
            store.errorMessage = 'old';
            backend.verifyMessage.mockResolvedValue({ valid: true });

            store.verifyMessage(request);
            await flush();

            expect(store.error).toBe(false);
            expect(store.errorMessage).toBe('');
        });

        it('sets valid false and the parsed error message on rejection', async () => {
            backend.verifyMessage.mockRejectedValue(
                new Error(JSON.stringify({ message: 'bad sig' }))
            );

            store.verifyMessage(request);
            await flush();

            expect(store.valid).toBe(false);
            expect(store.error).toBe(true);
            expect(store.errorMessage).toBe('bad sig');
            expect(store.loading).toBe(false);
        });

        it('uses the verification fallback for an undefined rejection', async () => {
            backend.verifyMessage.mockRejectedValue(undefined);

            store.verifyMessage(request);
            await flush();

            expect(store.errorMessage).toBe('Unknown verification error');
        });

        it('treats a null backend result as an error', async () => {
            backend.verifyMessage.mockResolvedValue(null);

            store.verifyMessage(request);
            await flush();

            expect(store.valid).toBe(false);
            expect(store.error).toBe(true);
        });

        it('reports verificationOperationFailed when the backend returns a non-promise', () => {
            backend.verifyMessage.mockReturnValue(false);

            store.verifyMessage(request);

            expect(store.error).toBe(true);
            expect(store.errorMessage).toBe(
                'views.Settings.SignMessage.verificationOperationFailed'
            );
            expect(store.loading).toBe(false);
        });

        it('handles a synchronous throw from the backend', () => {
            backend.verifyMessage.mockImplementation(() => {
                throw new Error('sync verify boom');
            });

            store.verifyMessage(request);

            expect(store.valid).toBe(false);
            expect(store.error).toBe(true);
            expect(store.errorMessage).toBe('sync verify boom');
            expect(store.loading).toBe(false);
        });
    });

    describe('verifyMessage (on-chain)', () => {
        beforeEach(() => {
            store.setSigningMode('onchain');
        });

        it('verifies with verifyMessageWithAddr and marks the message valid', async () => {
            backend.verifyMessageWithAddr.mockResolvedValue({ valid: true });

            store.verifyMessage({
                msg: 'hello',
                signature: 'sig',
                addr: 'bc1qabc'
            });
            await flush();

            expect(backend.verifyMessageWithAddr).toHaveBeenCalledWith(
                'hello',
                'sig',
                'bc1qabc'
            );
            expect(backend.verifyMessage).not.toHaveBeenCalled();
            expect(store.valid).toBe(true);
        });

        it('marks the message invalid when the address does not match', async () => {
            backend.verifyMessageWithAddr.mockResolvedValue({ valid: false });

            store.verifyMessage({
                msg: 'hello',
                signature: 'sig',
                addr: 'bc1qother'
            });
            await flush();

            expect(store.valid).toBe(false);
            expect(store.error).toBe(false);
        });

        it('rejects a missing address without calling the backend', () => {
            store.verifyMessage({ msg: 'hello', signature: 'sig' });

            expect(backend.verifyMessageWithAddr).not.toHaveBeenCalled();
            expect(store.error).toBe(true);
            expect(store.errorMessage).toBe(
                'views.Settings.SignMessage.noAddressForVerification'
            );
            expect(store.loading).toBe(false);
        });

        it('rejects a whitespace-only address without calling the backend', () => {
            store.verifyMessage({
                msg: 'hello',
                signature: 'sig',
                addr: '   '
            });

            expect(backend.verifyMessageWithAddr).not.toHaveBeenCalled();
            expect(store.error).toBe(true);
        });

        it('sets valid false and the error message on rejection', async () => {
            backend.verifyMessageWithAddr.mockRejectedValue('addr failure');

            store.verifyMessage({
                msg: 'hello',
                signature: 'sig',
                addr: 'bc1qabc'
            });
            await flush();

            expect(store.valid).toBe(false);
            expect(store.error).toBe(true);
            expect(store.errorMessage).toBe('addr failure');
        });
    });

    describe('loadAddresses', () => {
        it('flattens account_with_addresses and tags each with account info', async () => {
            backend.listAddresses.mockResolvedValue({
                account_with_addresses: [
                    {
                        name: 'default',
                        address_type: 'WITNESS_PUBKEY_HASH',
                        addresses: [{ address: 'bc1qa' }, { address: 'bc1qb' }]
                    },
                    { name: 'empty', address_type: 'X', addresses: [] },
                    { name: 'missing', address_type: 'Y' }
                ]
            });

            store.loadAddresses();
            await flush();

            expect(store.addresses).toEqual([
                {
                    address: 'bc1qa',
                    type: 'type-of-bc1qa',
                    accountName: 'default',
                    addressType: 'WITNESS_PUBKEY_HASH'
                },
                {
                    address: 'bc1qb',
                    type: 'type-of-bc1qb',
                    accountName: 'default',
                    addressType: 'WITNESS_PUBKEY_HASH'
                }
            ]);
            expect(store.loading).toBe(false);
        });

        it('maps a flat addresses array, preferring a supplied type', async () => {
            backend.listAddresses.mockResolvedValue({
                addresses: [
                    { address: 'bc1qa', type: 'p2wpkh' },
                    { address: 'bc1qb' }
                ]
            });

            store.loadAddresses();
            await flush();

            expect(store.addresses).toEqual([
                { address: 'bc1qa', type: 'p2wpkh' },
                { address: 'bc1qb', type: 'type-of-bc1qb' }
            ]);
        });

        it('selects the first address when nothing was selected', async () => {
            backend.listAddresses.mockResolvedValue({
                addresses: [{ address: 'bc1qa' }, { address: 'bc1qb' }]
            });

            store.loadAddresses();
            await flush();

            expect(store.selectedAddress).toBe('bc1qa');
        });

        it('keeps the previous selection when it is still listed', async () => {
            store.setSelectedAddress('bc1qb');
            backend.listAddresses.mockResolvedValue({
                addresses: [{ address: 'bc1qa' }, { address: 'bc1qb' }]
            });

            store.loadAddresses();
            await flush();

            expect(store.selectedAddress).toBe('bc1qb');
        });

        it('falls back to the first address when the previous selection vanished', async () => {
            store.setSelectedAddress('gone');
            backend.listAddresses.mockResolvedValue({
                addresses: [{ address: 'bc1qa' }]
            });

            store.loadAddresses();
            await flush();

            expect(store.selectedAddress).toBe('bc1qa');
        });

        it('empties the list and flags an error for an unrecognised response', async () => {
            store.addresses = [{ address: 'old', type: 't' }];
            backend.listAddresses.mockResolvedValue({});

            store.loadAddresses();
            await flush();

            expect(store.addresses).toEqual([]);
            expect(store.error).toBe(true);
            expect(store.loading).toBe(false);
        });

        it('leaves the selection untouched when the list is empty', async () => {
            store.setSelectedAddress('bc1qa');
            backend.listAddresses.mockResolvedValue({ addresses: [] });

            store.loadAddresses();
            await flush();

            expect(store.addresses).toEqual([]);
            expect(store.selectedAddress).toBe('bc1qa');
        });

        it('records the error and stops loading when the backend rejects', async () => {
            backend.listAddresses.mockRejectedValue(new Error('offline'));

            store.loadAddresses();
            await flush();

            expect(store.error).toBe(true);
            expect(store.errorMessage).toBe('Error: offline');
            expect(store.loading).toBe(false);
        });
    });
});
