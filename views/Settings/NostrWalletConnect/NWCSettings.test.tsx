import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../../components/Header', () => () => null);
jest.mock('../../../components/LoadingIndicator', () => () => null);
jest.mock('../../../components/Switch', () => () => null);
jest.mock('../../../components/SuccessErrorMessage', () => ({
    ErrorMessage: () => null
}));
jest.mock('@rneui/themed', () => ({ Icon: () => null }));
jest.mock('../../../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000')
}));
jest.mock('../../../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('../../../utils/BackendUtils', () => ({
    supportsCashuWallet: jest.fn(() => true),
    supportsLightningAddress: jest.fn(() => false)
}));
jest.mock('../../../utils/RestartUtils', () => ({
    restartNeeded: jest.fn()
}));
jest.mock('../../../utils/IOSAudioKeepAliveUtils', () => ({
    isAvailable: jest.fn(() => false)
}));

import BackendUtils from '../../../utils/BackendUtils';
import NWCSettings from './NWCSettings';

const CASHU_ROW = 'views.Settings.NostrWalletConnect.switchToCashuWallet';

const renderWithSettings = async (settings: any) => {
    const NostrWalletConnectStore = {
        loadLud16Enabled: jest.fn(() => Promise.resolve()),
        cashuEnabled: false,
        persistentNWCServiceEnabled: false,
        lud16Enabled: true
    };
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
        tree = renderer.create(
            <NWCSettings
                navigation={{} as any}
                SettingsStore={
                    { settings, settingsUpdateInProgress: false } as any
                }
                NostrWalletConnectStore={NostrWalletConnectStore as any}
                ModalStore={{} as any}
            />
        );
    });
    return tree!;
};

const hasCashuRow = (tree: renderer.ReactTestRenderer) =>
    tree.root
        .findAllByType(Text)
        .some((node) => node.props.children === CASHU_ROW);

describe('NWCSettings', () => {
    beforeEach(() => {
        (BackendUtils.supportsCashuWallet as jest.Mock).mockReturnValue(true);
    });

    it('renders on a Cashu-capable backend when settings have no ecash key', async () => {
        const tree = await renderWithSettings({});
        expect(hasCashuRow(tree)).toBe(false);
    });

    it('shows the Cashu row when Cashu is enabled', async () => {
        const tree = await renderWithSettings({
            ecash: { enableCashu: true }
        });
        expect(hasCashuRow(tree)).toBe(true);
    });

    it('hides the Cashu row when Cashu is disabled', async () => {
        const tree = await renderWithSettings({
            ecash: { enableCashu: false }
        });
        expect(hasCashuRow(tree)).toBe(false);
    });

    it('hides the Cashu row on backends without Cashu support', async () => {
        (BackendUtils.supportsCashuWallet as jest.Mock).mockReturnValue(false);
        const tree = await renderWithSettings({
            ecash: { enableCashu: true }
        });
        expect(hasCashuRow(tree)).toBe(false);
    });
});
