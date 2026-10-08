jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
// UrlUtils imports the store graph; it is only used here for validation
jest.mock('../../stores/Stores', () => ({}));
jest.mock('../../stores/SettingsStore', () => ({
    BLOCK_EXPLORER_KEYS: [],
    DEFAULT_MEMPOOL_INSTANCE: 'https://mempool.space',
    MEMPOOL_INSTANCE_KEYS: []
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../assets/images/SVG/Hidden.svg', () => 'StealthIcon');
jest.mock('../../assets/images/SVG/Caret Right-3.svg', () => 'ForwardIcon');
jest.mock('../../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../components/TextInput', () => 'TextInput');

import * as React from 'react';
import Privacy from './Privacy';

const makeView = (state: any) => {
    const view = new Privacy({
        navigation: {},
        SettingsStore: {
            flushPendingSettings: jest.fn(),
            updateSettingsGroup: jest.fn()
        }
    } as unknown as React.ComponentProps<typeof Privacy>);
    view.state = { ...view.state, ...state };
    return view;
};

const store = (view: Privacy) => view.props.SettingsStore as any;

describe('Privacy unmount', () => {
    it('writes nothing when neither dropdown is on Custom', () => {
        const view = makeView({
            defaultBlockExplorer: 'mempool.space',
            mempoolInstance: 'https://mempool.space'
        });
        view.componentWillUnmount();

        expect(store(view).flushPendingSettings).toHaveBeenCalled();
        expect(store(view).updateSettingsGroup).not.toHaveBeenCalled();
    });

    it('writes nothing when each Custom dropdown has a valid URL', () => {
        const view = makeView({
            defaultBlockExplorer: 'Custom',
            customBlockExplorer: 'https://explorer.example.com',
            mempoolInstance: 'Custom',
            customMempoolInstance: 'https://mempool.example.com'
        });
        view.componentWillUnmount();

        expect(store(view).flushPendingSettings).toHaveBeenCalled();
        expect(store(view).updateSettingsGroup).not.toHaveBeenCalled();
    });

    it.each([
        ['empty', ''],
        ['blank', '   '],
        // never written, so the stored URL may still be empty
        ['invalid', 'not a url']
    ])('checks the queued group when a Custom URL is %s', (_label, url) => {
        const view = makeView({
            defaultBlockExplorer: 'mempool.space',
            mempoolInstance: 'Custom',
            customMempoolInstance: url
        });
        view.componentWillUnmount();

        expect(store(view).updateSettingsGroup).toHaveBeenCalledWith(
            'privacy',
            expect.any(Function)
        );
    });

    it('applies the fallback for the dropdown without a stored URL', () => {
        expect(
            Privacy.customFallbacks({
                defaultBlockExplorer: 'Custom',
                customBlockExplorer: 'https://explorer.example.com',
                mempoolInstance: 'Custom',
                customMempoolInstance: ''
            })
        ).toEqual({ mempoolInstance: 'https://mempool.space' });
    });
});
