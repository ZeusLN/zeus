jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@react-native-clipboard/clipboard', () => ({}));
jest.mock('react-native-fs', () => ({}));
jest.mock('@react-native-documents/picker', () => ({}));
jest.mock('react-native-restart', () => ({}));
jest.mock('../../components/SuccessErrorMessage', () => ({}));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/ModalBox', () => 'ModalBox');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../components/TextInput', () => 'TextInput');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../../components/PreventRemove', () => 'PreventRemove');
jest.mock('../../utils/RestartUtils', () => ({}));
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#000000' }));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ChannelMigrationUtils', () => ({}));
jest.mock('../../stores/ModalStore', () => ({}));
jest.mock('../../utils/LndMobileUtils', () => ({}));
jest.mock('../../utils/SleepUtils', () => ({}));
jest.mock('../../utils/LdkNodeUtils', () => ({
    getDefaultEsploraServer: () => '',
    getDefaultRgsServer: () => '',
    DEFAULT_VSS_SERVER: ''
}));
jest.mock('../../utils/AezeedUtils', () => ({}));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../stores/NodeInfoStore', () => ({}));
jest.mock('../../stores/SwapStore', () => ({}));
jest.mock('../../utils/SwapUtils', () => ({}));
jest.mock('../../storage', () => ({}));

import SeedRecovery from './SeedRecovery';

// Wallet A was restored earlier and its recovery has not run yet
const PENDING_A = { recovery: true, recoveryWalletDirs: ['walletA'] };

// The settings update a restore writes, applied to the settings it
// finds, and the view it was written from
const restore = async (state: any, save: (view: any) => void) => {
    const updateSettings = jest.fn(() => Promise.resolve());
    const view: any = new SeedRecovery({
        navigation: { popTo: jest.fn() },
        route: { params: {} },
        SettingsStore: {
            settings: {},
            updateSettings,
            setConnectingStatus: jest.fn()
        }
    } as any);
    Object.assign(view.state, state);
    view.finishRestoreWallet = jest.fn();
    save(view);
    await Promise.resolve();
    const [[update]] = updateSettings.mock.calls as any[];
    return update({ nodes: [{}], ...PENDING_A });
};

describe('SeedRecovery restore', () => {
    it('keeps wallet A pending when wallet B is restored from an aezeed', async () => {
        const update = await restore({ lndDir: 'walletB' }, (view) =>
            view.saveWalletConfiguration('aezeed words')
        );

        expect(update.recovery).toBe(true);
        expect(update.recoveryWalletDirs).toEqual(['walletA', 'walletB']);
    });

    it('leaves wallet A pending when wallet B is restored without a cipher seed', async () => {
        const update = await restore({ lndDir: 'walletB' }, (view) =>
            view.saveWalletConfiguration()
        );

        expect(update).not.toHaveProperty('recovery');
        expect(update).not.toHaveProperty('recoveryWalletDirs');
    });

    it('keeps wallet A pending when an LDK Node wallet B is restored', async () => {
        const update = await restore({}, (view) =>
            view.saveLdkNodeWalletConfiguration(
                'mnemonic words',
                'ldkWalletB',
                'mainnet'
            )
        );

        expect(update.recovery).toBe(true);
        expect(update.recoveryWalletDirs).toEqual(['walletA', 'ldkWalletB']);
    });
});
