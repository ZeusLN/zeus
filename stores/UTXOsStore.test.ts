jest.mock('../stores/Stores');
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../ldknode/LdkNodeInjection', () => ({}));
jest.mock('../storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(() => Promise.resolve(null)),
        setItem: jest.fn(() => Promise.resolve())
    }
}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        importAccount: jest.fn(),
        listAccounts: jest.fn(),
        getBlockchainBalance: jest.fn(),
        getNewAddress: jest.fn(),
        getNewChangeAddress: jest.fn(),
        rescan: jest.fn(),
        getMyNodeInfo: jest.fn(),
        supportsAccountImportRescan: jest.fn(() => false)
    }
}));

import UTXOsStore from './UTXOsStore';
import BackendUtils from '../utils/BackendUtils';

const newStore = () => new UTXOsStore({} as any, {} as any);

const dryRunResponse = {
    account: {
        name: 'SeedSigner',
        address_type: 'TAPROOT_PUBKEY'
    },
    dry_run_external_addrs: ['bcrt1p-ext'],
    dry_run_internal_addrs: ['bcrt1p-int']
};

// birthday_height and the rescan RPC only exist on the Zeus lnd fork
// (embedded); litd's proto JSON unmarshaler rejects requests carrying
// unknown fields and BackendUtils.call returns false for missing RPCs
describe('UTXOsStore.importAccount', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (BackendUtils.supportsAccountImportRescan as jest.Mock).mockReturnValue(
            false
        );
        (BackendUtils.importAccount as jest.Mock).mockResolvedValue(
            dryRunResponse
        );
        (BackendUtils.listAccounts as jest.Mock).mockResolvedValue({
            accounts: []
        });
        (BackendUtils.getNewAddress as jest.Mock).mockResolvedValue({
            address: 'bcrt1p-recv'
        });
        (BackendUtils.getNewChangeAddress as jest.Mock).mockResolvedValue({
            addr: 'bcrt1p-change'
        });
        (BackendUtils.rescan as jest.Mock).mockResolvedValue({});
        (BackendUtils.getMyNodeInfo as jest.Mock).mockResolvedValue({
            block_height: 870000
        });
    });

    const dryRunData = () => ({
        name: 'SeedSigner',
        extended_public_key: 'tpubDDfvzhdVV4u',
        birthday_height: 800000,
        addresses_to_generate: 2,
        dry_run: true
    });

    it('strips addresses_to_generate from every import request', async () => {
        await newStore().importAccount(dryRunData());

        const request = (BackendUtils.importAccount as jest.Mock).mock
            .calls[0][0];
        expect('addresses_to_generate' in request).toBe(false);
    });

    it('keeps birthday_height when the backend supports the fork import extensions', async () => {
        (BackendUtils.supportsAccountImportRescan as jest.Mock).mockReturnValue(
            true
        );

        await newStore().importAccount(dryRunData());

        const request = (BackendUtils.importAccount as jest.Mock).mock
            .calls[0][0];
        expect(request.birthday_height).toBe(800000);
    });

    it('re-attaches the dry-run birthday to the real import on the fork backend', async () => {
        (BackendUtils.supportsAccountImportRescan as jest.Mock).mockReturnValue(
            true
        );

        const store = newStore();
        await store.importAccount(dryRunData());
        // the real import from ImportingAccount doesn't resend the birthday
        await store.importAccount({
            name: 'SeedSigner',
            extended_public_key: 'tpubDDfvzhdVV4u',
            dry_run: false
        });

        const request = (BackendUtils.importAccount as jest.Mock).mock
            .calls[1][0];
        expect(request.birthday_height).toBe(800000);
        expect(BackendUtils.rescan).toHaveBeenCalledWith({
            start_height: 800000
        });
        expect(store.success).toBe(true);
    });

    it('strips birthday_height and skips the rescan on backends without the fork extensions', async () => {
        const store = newStore();
        await store.importAccount(dryRunData());
        await store.importAccount({
            name: 'SeedSigner',
            extended_public_key: 'tpubDDfvzhdVV4u',
            dry_run: false
        });

        for (const call of (BackendUtils.importAccount as jest.Mock).mock
            .calls) {
            expect('birthday_height' in call[0]).toBe(false);
        }
        // pre-generation still runs off the captured start_height
        expect(BackendUtils.getNewAddress).toHaveBeenCalledTimes(2);
        // rescan is fork-only; calling it would throw false.then into the
        // catch and report the successful import as failed
        expect(BackendUtils.rescan).not.toHaveBeenCalled();
        expect(store.success).toBe(true);
        expect(store.errorMsg).toBe('');
        expect(store.accountToImport).not.toBeNull();
        expect(BackendUtils.listAccounts).toHaveBeenCalled();
    });

    it('does not mutate the caller-supplied data object', async () => {
        const data = dryRunData();
        const snapshot = JSON.parse(JSON.stringify(data));

        const store = newStore();
        await store.importAccount(data);
        // real import re-attaches the birthday internally, not on `data`
        const realData = {
            name: 'SeedSigner',
            extended_public_key: 'tpubDDfvzhdVV4u',
            dry_run: false
        };
        const realSnapshot = JSON.parse(JSON.stringify(realData));
        await store.importAccount(realData);

        expect(data).toEqual(snapshot);
        expect(realData).toEqual(realSnapshot);
    });

    // #4640: the fork resolves birthday_height 0 (proto3 unset) to the
    // genesis block and moves the wallet birthday back to it
    describe('new account (no birthday height)', () => {
        const newAccountDryRun = () => ({
            name: 'SeedSigner',
            extended_public_key: 'tpubDDfvzhdVV4u',
            dry_run: true
        });
        const newAccountImport = () => ({
            name: 'SeedSigner',
            extended_public_key: 'tpubDDfvzhdVV4u',
            dry_run: false
        });

        beforeEach(() => {
            (
                BackendUtils.supportsAccountImportRescan as jest.Mock
            ).mockReturnValue(true);
        });

        it('sends the current tip as birthday_height on the fork backend', async () => {
            const store = newStore();
            await store.importAccount(newAccountDryRun());
            await store.importAccount(newAccountImport());

            const request = (BackendUtils.importAccount as jest.Mock).mock
                .calls[1][0];
            expect(request.birthday_height).toBe(870000);
            // the tip is only the birthday stamp; a new account gets no
            // pre-generation or rescan, same as before
            expect(store.start_height).toBeUndefined();
            expect(BackendUtils.getNewAddress).not.toHaveBeenCalled();
            expect(BackendUtils.rescan).not.toHaveBeenCalled();
            expect(store.success).toBe(true);
        });

        it('reads a string block_height from the node info', async () => {
            (BackendUtils.getMyNodeInfo as jest.Mock).mockResolvedValue({
                block_height: '870001'
            });

            await newStore().importAccount(newAccountImport());

            const request = (BackendUtils.importAccount as jest.Mock).mock
                .calls[0][0];
            expect(request.birthday_height).toBe(870001);
        });

        it('does not fetch the tip for a dry run', async () => {
            await newStore().importAccount(newAccountDryRun());

            const request = (BackendUtils.importAccount as jest.Mock).mock
                .calls[0][0];
            expect('birthday_height' in request).toBe(false);
            expect(BackendUtils.getMyNodeInfo).not.toHaveBeenCalled();
        });

        it('keeps a user-supplied birthday over the tip', async () => {
            const store = newStore();
            await store.importAccount({
                ...newAccountDryRun(),
                birthday_height: 800000
            });
            await store.importAccount(newAccountImport());

            const request = (BackendUtils.importAccount as jest.Mock).mock
                .calls[1][0];
            expect(request.birthday_height).toBe(800000);
            expect(BackendUtils.getMyNodeInfo).not.toHaveBeenCalled();
        });

        it('still imports when the tip lookup fails', async () => {
            (BackendUtils.getMyNodeInfo as jest.Mock).mockRejectedValue(
                new Error('not synced')
            );

            const store = newStore();
            await store.importAccount(newAccountImport());

            const request = (BackendUtils.importAccount as jest.Mock).mock
                .calls[0][0];
            expect('birthday_height' in request).toBe(false);
            expect(store.success).toBe(true);
        });

        it('does not send a zero tip', async () => {
            (BackendUtils.getMyNodeInfo as jest.Mock).mockResolvedValue({
                block_height: 0
            });

            await newStore().importAccount(newAccountImport());

            const request = (BackendUtils.importAccount as jest.Mock).mock
                .calls[0][0];
            expect('birthday_height' in request).toBe(false);
        });

        it('does not fetch the tip on backends without the fork extensions', async () => {
            (
                BackendUtils.supportsAccountImportRescan as jest.Mock
            ).mockReturnValue(false);

            await newStore().importAccount(newAccountImport());

            const request = (BackendUtils.importAccount as jest.Mock).mock
                .calls[0][0];
            expect('birthday_height' in request).toBe(false);
            expect(BackendUtils.getMyNodeInfo).not.toHaveBeenCalled();
        });
    });
});
