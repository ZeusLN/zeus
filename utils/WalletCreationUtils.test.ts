jest.mock('uuid', () => ({ v4: jest.fn(() => 'new-dir') }));
jest.mock('./LndMobileUtils', () => ({
    optimizeNeutrinoPeers: jest.fn(),
    createLndWallet: jest.fn()
}));
jest.mock('./LdkNodeUtils', () => ({
    createLdkNodeWallet: jest.fn()
}));
jest.mock('./LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../stores/SettingsStore', () => ({}));

import { createOnboardingWallet } from './WalletCreationUtils';
import { optimizeNeutrinoPeers, createLndWallet } from './LndMobileUtils';
import { createLdkNodeWallet } from './LdkNodeUtils';

const mockedOptimizePeers = optimizeNeutrinoPeers as jest.Mock;
const mockedCreateLndWallet = createLndWallet as jest.Mock;
const mockedCreateLdkNodeWallet = createLdkNodeWallet as jest.Mock;

// updateSettings applies a functional update to whatever the settings are
// when the queued write runs, like SettingsStore's queue does
const makeSettingsStore = (settings: any = {}) => {
    const store: any = {
        settings,
        walletJustCreated: false,
        setConnectingStatus: jest.fn(),
        updateSettings: jest.fn(async (update: any) => {
            const resolved =
                typeof update === 'function' ? update(store.settings) : update;
            store.settings = { ...store.settings, ...resolved };
            return store.settings;
        })
    };
    return store;
};

const makeParams = (settingsStore: any, overrides: any = {}) => ({
    settingsStore,
    enableCashu: true,
    clipboard: false,
    fiatEnabled: true,
    selectedCurrency: 'EUR',
    fiatRatesSource: 'Zeus',
    onChoosingPeers: jest.fn(),
    onCreatingWallet: jest.fn(),
    onError: jest.fn(),
    onSuccess: jest.fn(),
    ...overrides
});

const lndResponse = {
    wallet: { admin_macaroon: 'macaroon' },
    seed: { cipher_seed_mnemonic: ['abandon', 'ability'] },
    randomBase64: 'password'
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockedOptimizePeers.mockResolvedValue(undefined);
    mockedCreateLndWallet.mockResolvedValue(lndResponse);
    mockedCreateLdkNodeWallet.mockResolvedValue({ mnemonic: 'ldk words' });
});

describe('createOnboardingWallet', () => {
    it('does nothing but report success when a wallet already exists', async () => {
        const settingsStore = makeSettingsStore({
            nodes: [{ implementation: 'lnd', host: 'existing' }]
        });
        const params = makeParams(settingsStore);

        await createOnboardingWallet(params);

        expect(params.onSuccess).toHaveBeenCalledTimes(1);
        expect(settingsStore.updateSettings).not.toHaveBeenCalled();
        expect(mockedCreateLndWallet).not.toHaveBeenCalled();
        expect(mockedCreateLdkNodeWallet).not.toHaveBeenCalled();
        expect(settingsStore.settings.nodes).toEqual([
            { implementation: 'lnd', host: 'existing' }
        ]);
    });

    it('creates an embedded LND wallet and saves it with the onboarding choices', async () => {
        const settingsStore = makeSettingsStore({
            privacy: { defaultBlockExplorer: 'mempool.space' },
            ecash: { automaticallySweep: true }
        });
        const params = makeParams(settingsStore, {
            initialMintUrls: ['https://mint.example']
        });

        await createOnboardingWallet(params);

        expect(params.onChoosingPeers).toHaveBeenCalled();
        expect(params.onCreatingWallet).toHaveBeenCalled();
        expect(mockedCreateLndWallet).toHaveBeenCalledWith({
            lndDir: 'new-dir'
        });
        expect(settingsStore.settings).toEqual({
            nodes: [
                {
                    adminMacaroon: 'macaroon',
                    seedPhrase: ['abandon', 'ability'],
                    walletPassword: 'password',
                    embeddedLndNetwork: 'Mainnet',
                    implementation: 'embedded-lnd',
                    nickname: 'general.defaultNodeNickname',
                    lndDir: 'new-dir',
                    isSqlite: false
                }
            ],
            privacy: {
                defaultBlockExplorer: 'mempool.space',
                clipboard: false
            },
            fiatEnabled: true,
            fiat: 'EUR',
            fiatRatesSource: 'Zeus',
            ecash: {
                automaticallySweep: true,
                enableCashu: true,
                initialMintUrls: ['https://mint.example']
            }
        });
        expect(settingsStore.setConnectingStatus).toHaveBeenCalledWith(true);
        expect(params.onSuccess).toHaveBeenCalledTimes(1);
        expect(params.onError).not.toHaveBeenCalled();
        expect(settingsStore.walletJustCreated).toBe(false);
    });

    it('creates an LDK Node wallet and tells Wallet to skip re-init', async () => {
        const settingsStore = makeSettingsStore();
        const params = makeParams(settingsStore, {
            implementation: 'ldk-node'
        });

        await createOnboardingWallet(params);

        expect(params.onChoosingPeers).not.toHaveBeenCalled();
        expect(mockedOptimizePeers).not.toHaveBeenCalled();
        expect(mockedCreateLdkNodeWallet).toHaveBeenCalledWith({
            nodeDir: 'new-dir',
            network: 'mainnet'
        });
        expect(settingsStore.settings.nodes).toEqual([
            {
                implementation: 'ldk-node',
                ldkNetwork: 'mainnet',
                ldkNodeDir: 'new-dir',
                ldkMnemonic: 'ldk words',
                nickname: 'general.defaultNodeNickname'
            }
        ]);
        expect(settingsStore.walletJustCreated).toBe(true);
        expect(settingsStore.setConnectingStatus).toHaveBeenCalledWith(true);
        expect(params.onSuccess).toHaveBeenCalledTimes(1);
    });

    it('leaves initialMintUrls unset when none were chosen', async () => {
        const settingsStore = makeSettingsStore({
            ecash: { initialMintUrls: ['https://kept.example'] }
        });

        await createOnboardingWallet(
            makeParams(settingsStore, { initialMintUrls: [] })
        );

        expect(settingsStore.settings.ecash.initialMintUrls).toEqual([
            'https://kept.example'
        ]);
    });

    // Wallet creation takes seconds; the settings write must merge into the
    // settings current when it runs, not a copy taken at the start (#4904)
    it.each(['embedded-lnd', 'ldk-node'])(
        'keeps privacy and ecash changes made while the %s wallet was created',
        async (implementation) => {
            const settingsStore = makeSettingsStore({
                privacy: { lurkerMode: false },
                ecash: { enableCashu: false }
            });
            const changeDuringCreation = () => {
                settingsStore.settings = {
                    ...settingsStore.settings,
                    privacy: { lurkerMode: true },
                    ecash: { enableCashu: false, automaticallySweep: true }
                };
            };
            mockedCreateLndWallet.mockImplementation(async () => {
                changeDuringCreation();
                return lndResponse;
            });
            mockedCreateLdkNodeWallet.mockImplementation(async () => {
                changeDuringCreation();
                return { mnemonic: 'ldk words' };
            });

            await createOnboardingWallet(
                makeParams(settingsStore, { implementation })
            );

            expect(settingsStore.settings.privacy).toEqual({
                lurkerMode: true,
                clipboard: false
            });
            expect(settingsStore.settings.ecash).toEqual({
                enableCashu: true,
                automaticallySweep: true
            });
        }
    );

    // SettingsStore queues writes, so one queued ahead of the onboarding
    // write lands after updateSettings is called but before it runs
    it.each(['embedded-lnd', 'ldk-node'])(
        'keeps a write queued ahead of the %s onboarding write',
        async (implementation) => {
            const settingsStore = makeSettingsStore({
                privacy: { lurkerMode: false },
                ecash: { enableCashu: false }
            });
            const apply = settingsStore.updateSettings.getMockImplementation();
            settingsStore.updateSettings.mockImplementation(
                async (update: any) => {
                    settingsStore.settings = {
                        ...settingsStore.settings,
                        privacy: { lurkerMode: true },
                        ecash: { enableCashu: false, automaticallySweep: true }
                    };
                    return apply(update);
                }
            );

            await createOnboardingWallet(
                makeParams(settingsStore, { implementation })
            );

            expect(settingsStore.settings.privacy).toEqual({
                lurkerMode: true,
                clipboard: false
            });
            expect(settingsStore.settings.ecash).toEqual({
                enableCashu: true,
                automaticallySweep: true
            });
        }
    );

    describe('failures', () => {
        it('stops before creating a wallet when choosing peers fails', async () => {
            mockedOptimizePeers.mockRejectedValue(new Error('no peers'));
            const settingsStore = makeSettingsStore();
            const params = makeParams(settingsStore);

            await createOnboardingWallet(params);

            expect(params.onError).toHaveBeenCalledTimes(1);
            expect(params.onCreatingWallet).not.toHaveBeenCalled();
            expect(mockedCreateLndWallet).not.toHaveBeenCalled();
            expect(settingsStore.updateSettings).not.toHaveBeenCalled();
            expect(params.onSuccess).not.toHaveBeenCalled();
        });

        it('saves nothing when embedded LND creation throws', async () => {
            mockedCreateLndWallet.mockRejectedValue(new Error('boom'));
            const settingsStore = makeSettingsStore();
            const params = makeParams(settingsStore);

            await createOnboardingWallet(params);

            expect(params.onError).toHaveBeenCalledTimes(1);
            expect(settingsStore.updateSettings).not.toHaveBeenCalled();
            expect(settingsStore.setConnectingStatus).not.toHaveBeenCalled();
            expect(params.onSuccess).not.toHaveBeenCalled();
        });

        it('saves nothing when embedded LND returns no admin macaroon', async () => {
            mockedCreateLndWallet.mockResolvedValue({
                ...lndResponse,
                wallet: {}
            });
            const settingsStore = makeSettingsStore();
            const params = makeParams(settingsStore);

            await createOnboardingWallet(params);

            expect(params.onError).toHaveBeenCalledTimes(1);
            expect(settingsStore.updateSettings).not.toHaveBeenCalled();
            expect(params.onSuccess).not.toHaveBeenCalled();
        });

        it.each([
            ['throws', () => Promise.reject(new Error('boom'))],
            ['returns no mnemonic', () => Promise.resolve({})]
        ])(
            'saves nothing when LDK Node creation %s',
            async (_label, result) => {
                mockedCreateLdkNodeWallet.mockImplementation(result);
                const settingsStore = makeSettingsStore();
                const params = makeParams(settingsStore, {
                    implementation: 'ldk-node'
                });

                await createOnboardingWallet(params);

                expect(params.onError).toHaveBeenCalledTimes(1);
                expect(settingsStore.updateSettings).not.toHaveBeenCalled();
                expect(settingsStore.walletJustCreated).toBe(false);
                expect(params.onSuccess).not.toHaveBeenCalled();
            }
        );

        it('reports an error, not success, when the LDK Node settings write fails', async () => {
            const settingsStore = makeSettingsStore();
            settingsStore.updateSettings.mockRejectedValue(new Error('disk'));
            const params = makeParams(settingsStore, {
                implementation: 'ldk-node'
            });

            await createOnboardingWallet(params);

            expect(params.onError).toHaveBeenCalledTimes(1);
            expect(params.onSuccess).not.toHaveBeenCalled();
            expect(settingsStore.walletJustCreated).toBe(false);
        });

        // Both onboarding callers await createOnboardingWallet without a
        // catch, so a rejection that escaped it left the spinner up (#5024)
        it('reports an error, not success, when the embedded LND settings write fails', async () => {
            const settingsStore = makeSettingsStore();
            settingsStore.updateSettings.mockRejectedValue(new Error('disk'));
            const params = makeParams(settingsStore);

            await expect(createOnboardingWallet(params)).resolves.toBe(
                undefined
            );

            expect(params.onError).toHaveBeenCalledTimes(1);
            expect(params.onSuccess).not.toHaveBeenCalled();
            expect(settingsStore.setConnectingStatus).not.toHaveBeenCalled();
        });
    });
});
