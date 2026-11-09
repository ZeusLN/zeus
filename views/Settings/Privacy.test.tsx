jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
// UrlUtils imports the store graph; it is only used here for validation
jest.mock('../../stores/Stores', () => ({
    alertStore: {
        clearMempoolError: jest.fn()
    }
}));
jest.mock('../../stores/SettingsStore', () => ({
    BLOCK_EXPLORER_KEYS: [],
    DEFAULT_MEMPOOL_INSTANCE: 'https://mempool.space',
    MEMPOOL_INSTANCE_KEYS: []
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../assets/images/SVG/Hidden.svg', () => 'StealthIcon');
jest.mock('../../assets/images/SVG/Caret Right-3.svg', () => 'ForwardIcon');
jest.mock('../../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../components/TextInput', () => 'TextInput');

import * as React from 'react';
import { act, render } from '@testing-library/react-native';
import Privacy from './Privacy';
import { alertStore } from '../../stores/Stores';

// Mounts the view with these saved privacy settings, lets componentDidMount
// load them, then leaves the screen
const mountAndLeave = async (privacy: any) => {
    const SettingsStore = {
        settings: {},
        getSettings: jest.fn(async () => ({ privacy })),
        flushPendingSettings: jest.fn(),
        updateSettingsGroup: jest.fn(),
        updateSettingsGroupDebounced: jest.fn()
    };
    const { unmount } = await render(
        <Privacy navigation={{} as any} SettingsStore={SettingsStore as any} />
    );
    expect(SettingsStore.getSettings).toHaveBeenCalled();
    await unmount();
    return SettingsStore;
};

describe('Privacy unmount', () => {
    it('writes nothing when neither dropdown is on Custom', async () => {
        const store = await mountAndLeave({
            defaultBlockExplorer: 'mempool.space',
            mempoolInstance: 'https://mempool.space'
        });

        expect(store.flushPendingSettings).toHaveBeenCalled();
        expect(store.updateSettingsGroup).not.toHaveBeenCalled();
    });

    it('writes nothing when each Custom dropdown has a valid URL', async () => {
        const store = await mountAndLeave({
            defaultBlockExplorer: 'Custom',
            customBlockExplorer: 'https://explorer.example.com',
            mempoolInstance: 'Custom',
            customMempoolInstance: 'https://mempool.example.com'
        });

        expect(store.flushPendingSettings).toHaveBeenCalled();
        expect(store.updateSettingsGroup).not.toHaveBeenCalled();
    });

    it.each([
        ['empty', ''],
        ['blank', '   '],
        // never written, so the stored URL may still be empty
        ['invalid', 'not a url']
    ])(
        'checks the queued group when a Custom URL is %s',
        async (_label, url) => {
            const store = await mountAndLeave({
                defaultBlockExplorer: 'mempool.space',
                mempoolInstance: 'Custom',
                customMempoolInstance: url
            });

            expect(store.flushPendingSettings).toHaveBeenCalled();
            expect(store.updateSettingsGroup).toHaveBeenCalledWith(
                'privacy',
                expect.any(Function)
            );
            // the update reverts the dropdown only when the stored URL is
            // still empty
            const [, update] = store.updateSettingsGroup.mock.calls[0];
            expect(
                update({ mempoolInstance: 'Custom', customMempoolInstance: '' })
            ).toEqual({ mempoolInstance: 'https://mempool.space' });
        }
    );

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

    it('applies no fallback when the stored URLs are set', () => {
        expect(
            Privacy.customFallbacks({
                defaultBlockExplorer: 'Custom',
                customBlockExplorer: 'https://explorer.example.com',
                mempoolInstance: 'Custom',
                customMempoolInstance: 'https://mempool.example.com'
            })
        ).toEqual({});
    });
});

describe('Privacy mempool instance change', () => {
    const makeView = (privacy: any) => {
        const SettingsStore = {
            settings: {},
            getSettings: jest.fn(async () => ({ privacy })),
            flushPendingSettings: jest.fn(),
            updateSettingsGroup: jest.fn(async () => {}),
            updateSettingsGroupDebounced: jest.fn()
        };
        const view: any = new (Privacy as any)({
            navigation: {} as any,
            SettingsStore
        });
        view.setState = jest.fn(); // <-- ADD THIS LINE
        view.state = {
            ...view.state,
            mempoolInstance: privacy.mempoolInstance,
            customMempoolInstance: privacy.customMempoolInstance
        };
        return { view, SettingsStore };
    };

    beforeEach(() => {
        (alertStore.clearMempoolError as jest.Mock).mockClear();
    });

    it('clears the alert when the mempool instance changes', async () => {
        const { view } = makeView({
            mempoolInstance: 'https://mempool.space'
        });

        await act(async () => {
            await view.handleMempoolInstanceChange('https://example.com');
        });

        expect(alertStore.clearMempoolError).toHaveBeenCalledTimes(1);
    });

    it('does not clear the alert when the mempool instance is unchanged', async () => {
        const { view } = makeView({
            mempoolInstance: 'https://mempool.space'
        });

        await act(async () => {
            await view.handleMempoolInstanceChange('https://mempool.space');
        });

        expect(alertStore.clearMempoolError).not.toHaveBeenCalled();
    });

    it('clears the alert when a valid custom URL is entered', () => {
        const { view } = makeView({
            mempoolInstance: 'Custom',
            customMempoolInstance: 'https://mempool.space'
        });

        view.handleCustomMempoolUrlChange('https://mempool.example.com');

        expect(alertStore.clearMempoolError).toHaveBeenCalledTimes(1);
    });

    it('does not clear the alert for an invalid custom URL', () => {
        const { view } = makeView({
            mempoolInstance: 'Custom',
            customMempoolInstance: 'https://mempool.space'
        });

        view.handleCustomMempoolUrlChange('not a url');

        expect(alertStore.clearMempoolError).not.toHaveBeenCalled();
    });
});
