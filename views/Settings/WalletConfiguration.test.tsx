jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
    getString: jest.fn(() => Promise.resolve('')),
    setString: jest.fn()
}));
jest.mock('../../backends/LNC/credentialStore', () => ({
    hash: jest.fn(),
    LNC_STORAGE_KEY: 'lnc'
}));
jest.mock('../../stores/Stores', () => ({}));
jest.mock('../../stores/SettingsStore', () => ({
    INTERFACE_KEYS: [],
    LNC_MAILBOX_KEYS: [],
    EMBEDDED_NODE_NETWORK_KEYS: [],
    BLOCK_EXPLORER_KEYS: [],
    DEFAULT_MEMPOOL_INSTANCE: 'https://mempool.space',
    MEMPOOL_INSTANCE_KEYS: [],
    getLspConfigForNetwork: jest.fn()
}));
jest.mock('../../utils/BackendUtils', () => ({}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../utils/ActionUtils', () => ({
    confirmAction: jest.fn()
}));
jest.mock('../../utils/NavigationUtils', () => ({
    reAuthNavigation: jest.fn()
}));
jest.mock('../../utils/PhotoUtils', () => ({ getPhoto: jest.fn() }));
jest.mock('../../utils/DataClearUtils', () => ({}));
jest.mock('../../utils/LndMobileUtils', () => ({}));
jest.mock('../../utils/LdkNodeUtils', () => ({
    getDefaultEsploraServer: jest.fn(() => ''),
    getDefaultRgsServer: jest.fn(() => ''),
    DEFAULT_VSS_SERVER: '',
    DEFAULT_SCORER_URL: ''
}));
jest.mock('../../storage', () => ({}));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/CollapsedQR', () => 'CollapsedQR');
jest.mock('../../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/KeyValue', () => 'KeyValue');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Pill', () => 'Pill');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage',
    WarningMessage: 'WarningMessage'
}));
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/TextInput', () => 'TextInput');
jest.mock('../../components/Accordion', () => 'Accordion');
jest.mock('../../components/VssServerPicker', () => ({
    __esModule: true,
    default: 'VssServerPicker'
}));
jest.mock('../../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../../components/ShowHideToggle', () => 'ShowHideToggle');
jest.mock('../../assets/images/SVG/Scan.svg', () => 'Scan');
jest.mock('../../assets/images/SVG/Add.svg', () => 'AddIcon');

import * as React from 'react';
import WalletConfiguration from './WalletConfiguration';
import { confirmAction } from '../../utils/ActionUtils';

const LNDHUB_IMPORT = 'lndhub://alice:secret@https://lndhub.example.com';

const makeView = (state: any = {}) => {
    const view = new WalletConfiguration({
        navigation: {},
        route: { params: {} },
        SettingsStore: {}
    } as unknown as React.ComponentProps<typeof WalletConfiguration>);
    view.state = { ...view.state, ...state };
    // Not mounted, so apply updates synchronously
    view.setState = (update: any) => {
        view.state = { ...view.state, ...update };
    };
    return view;
};

describe('WalletConfiguration', () => {
    beforeEach(() => {
        (confirmAction as jest.Mock).mockClear();
    });

    describe('lndhub clipboard import', () => {
        it('clears REST fields left over from a previous config', () => {
            const view = makeView({
                implementation: 'lnd',
                host: 'http://192.168.1.50',
                port: '8080',
                macaroonHex: 'deadbeef',
                rune: 'rune',
                suggestImport: LNDHUB_IMPORT
            });

            view.importClipboard();

            expect(view.state.implementation).toBe('lndhub');
            expect(view.state.lndhubUrl).toBe('https://lndhub.example.com');
            expect(view.state.username).toBe('alice');
            expect(view.state.password).toBe('secret');
            expect(view.state.host).toBe('');
            expect(view.state.port).toBe('');
            expect(view.state.macaroonHex).toBe('');
            expect(view.state.rune).toBe('');
        });
    });

    describe('cleartext HTTP gate', () => {
        const save = (state: any) => {
            const view = makeView(state);
            const perform = jest.fn();
            (view as any).performSaveWalletConfiguration = perform;
            view.saveWalletConfiguration();
            return perform;
        };

        it('warns on lndhub when a stale http:// host would be used', () => {
            const perform = save({
                implementation: 'lndhub',
                host: 'http://192.168.1.50',
                lndhubUrl: 'https://lndhub.example.com'
            });

            expect(confirmAction).toHaveBeenCalledTimes(1);
            expect(perform).not.toHaveBeenCalled();
        });

        it('warns on lndhub with an http:// lndhubUrl and no host', () => {
            save({
                implementation: 'lndhub',
                host: '',
                lndhubUrl: 'http://lndhub.example.com'
            });

            expect(confirmAction).toHaveBeenCalledTimes(1);
        });

        it('does not warn on lndhub with an https:// lndhubUrl', () => {
            const perform = save({
                implementation: 'lndhub',
                host: '',
                lndhubUrl: 'https://lndhub.example.com'
            });

            expect(confirmAction).not.toHaveBeenCalled();
            expect(perform).toHaveBeenCalled();
        });

        it('does not warn on lndhub over an http:// onion host', () => {
            save({
                implementation: 'lndhub',
                host: '',
                lndhubUrl: 'http://abcdefghijklmnop.onion'
            });

            expect(confirmAction).not.toHaveBeenCalled();
        });

        it('ignores a stale http:// lndhubUrl on an lnd config', () => {
            save({
                implementation: 'lnd',
                host: 'https://node.example.com',
                lndhubUrl: 'http://lndhub.example.com'
            });

            expect(confirmAction).not.toHaveBeenCalled();
        });

        it('warns on lnd with an http:// host', () => {
            save({
                implementation: 'lnd',
                host: 'http://192.168.1.50'
            });

            expect(confirmAction).toHaveBeenCalledTimes(1);
        });
    });
});
