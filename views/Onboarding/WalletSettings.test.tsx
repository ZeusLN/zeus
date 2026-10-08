jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({
    Icon: 'Icon',
    ListItem: Object.assign(() => null, {
        Content: 'ListItem.Content',
        Title: 'ListItem.Title'
    })
}));
jest.mock('../../stores/SettingsStore', () => ({
    CURRENCY_KEYS: [],
    DEFAULT_FIAT: 'USD',
    DEFAULT_FIAT_RATES_SOURCE: 'Zeus',
    FIAT_RATES_SOURCE_KEYS: []
}));
jest.mock('../../utils/WalletCreationUtils', () => ({
    createOnboardingWallet: jest.fn()
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../assets/images/SVG/wordmark-black.svg', () => 'Wordmark');
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/Text', () => 'Text');

import * as React from 'react';
import WalletSettings from './WalletSettings';

const childrenOf = (element: any): any[] =>
    React.Children.toArray(element?.props?.children);

const findAll = (node: any, match: (element: any) => boolean): any[] => {
    if (!React.isValidElement(node)) return [];
    return [
        ...(match(node) ? [node] : []),
        ...childrenOf(node).flatMap((child) => findAll(child, match))
    ];
};

describe('onboarding WalletSettings', () => {
    it('merges the clipboard switch into the privacy group', () => {
        const SettingsStore = {
            settings: {},
            updateSettings: jest.fn(),
            updateSettingsGroup: jest.fn()
        };
        const view = new WalletSettings({
            navigation: {},
            route: { params: {} },
            SettingsStore
        } as unknown as React.ComponentProps<typeof WalletSettings>);
        jest.spyOn(view, 'setState').mockImplementation((update: any) => {
            view.state = { ...view.state, ...update };
        });

        // fiat off so the two switches show different values
        view.state = { ...view.state, clipboard: true, fiatEnabled: false };
        const switches = findAll(
            view.render(),
            (element) => element.type === 'Switch'
        );
        expect(switches.map((element) => element.props.value)).toEqual([
            true,
            false
        ]);
        const [clipboardSwitch] = switches;

        clipboardSwitch.props.onValueChange(false);

        // A bare `privacy: { clipboard }` write would replace the whole
        // group (mempool instance, block explorer, lurker mode)
        expect(SettingsStore.updateSettings).not.toHaveBeenCalled();
        expect(SettingsStore.updateSettingsGroup).toHaveBeenCalledWith(
            'privacy',
            { clipboard: false }
        );
        expect(view.state.clipboard).toBe(false);
    });
});
