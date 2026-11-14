jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('react-native-device-info', () => ({
    getTotalMemory: jest.fn()
}));
jest.mock('../../stores/SettingsStore', () => ({
    DEFAULT_NEUTRINO_PEERS_MAINNET: []
}));
jest.mock('../../utils/LndMobileUtils', () => ({
    pingPeer: jest.fn(),
    NEUTRINO_PING_THRESHOLD_MS: 0
}));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));

import NodeChoice from './NodeChoice';

const select = (params: any, implementation: 'ldk-node' | 'embedded-lnd') => {
    const navigation = { navigate: jest.fn(), popTo: jest.fn() };
    const view = new NodeChoice({
        navigation: navigation as any,
        route: { params } as any,
        ModalStore: {} as any
    });
    view.handleSelect(implementation);
    return navigation;
};

describe('NodeChoice', () => {
    it('continues to the summary during the questionnaire', () => {
        const navigation = select({ enableCashu: true }, 'ldk-node');

        expect(navigation.navigate).toHaveBeenCalledWith(
            'RecommendedSettings',
            { enableCashu: true, implementation: 'ldk-node' }
        );
        expect(navigation.popTo).not.toHaveBeenCalled();
    });

    // navigate() would push a second summary in React Navigation 7, so Back
    // from it would land here instead of on the setup choice
    it('returns to the summary it was opened from', () => {
        const navigation = select(
            { enableCashu: true, returnTo: 'RecommendedSettings' },
            'embedded-lnd'
        );

        expect(navigation.popTo).toHaveBeenCalledWith('RecommendedSettings', {
            enableCashu: true,
            implementation: 'embedded-lnd'
        });
        expect(navigation.navigate).not.toHaveBeenCalled();
    });
});
