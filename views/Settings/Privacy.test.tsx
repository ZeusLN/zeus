jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
// UrlUtils imports the store graph; it is only used here for validation
jest.mock('../../stores/Stores');
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
import { NativeModules } from 'react-native';
import { act, render } from '@testing-library/react-native';
import Privacy from './Privacy';

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
        <Privacy
            navigation={{} as any}
            ModalStore={{} as any}
            SettingsStore={SettingsStore as any}
        />
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

describe('Privacy screen capture protection', () => {
    const setSecureFlag = jest.fn();

    beforeAll(() => {
        NativeModules.MobileTools = { setSecureFlag };
    });

    beforeEach(() => {
        setSecureFlag.mockReset();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        (console.error as jest.Mock).mockRestore();
    });

    // Mounts with protection off and flips its switch on
    const turnOn = async () => {
        const SettingsStore = {
            settings: {},
            getSettings: jest.fn(async () => ({ privacy: {} })),
            flushPendingSettings: jest.fn(),
            updateSettingsGroup: jest.fn(async () => {}),
            updateSettingsGroupDebounced: jest.fn()
        };
        const ModalStore = { toggleInfoModal: jest.fn() };
        const screen = await render(
            <Privacy
                navigation={{} as any}
                ModalStore={ModalStore as any}
                SettingsStore={SettingsStore as any}
            />
        );
        // the Switch in the row labelled with the setting's name
        const toggle = () => {
            let node: any = screen.getByText(
                'views.Settings.Privacy.screenCaptureProtection'
            );
            while (
                node &&
                !node.queryAll((n: any) => n.type === 'Switch').length
            ) {
                node = node.parent;
            }
            return node.queryAll((n: any) => n.type === 'Switch')[0];
        };
        expect(toggle().props.value).toBe(false);
        await act(async () => {
            await toggle().props.onValueChange();
        });
        return { SettingsStore, ModalStore, toggle };
    };

    it('keeps protection on when the native call succeeds', async () => {
        setSecureFlag.mockResolvedValue(true);

        const { SettingsStore, ModalStore, toggle } = await turnOn();

        expect(setSecureFlag).toHaveBeenCalledWith(true);
        expect(SettingsStore.updateSettingsGroup).toHaveBeenCalledTimes(1);
        expect(SettingsStore.updateSettingsGroup).toHaveBeenCalledWith(
            'privacy',
            { screenCaptureProtection: true }
        );
        expect(ModalStore.toggleInfoModal).not.toHaveBeenCalled();
        expect(toggle().props.value).toBe(true);
    });

    it('turns protection back off and says so when the native call rejects', async () => {
        setSecureFlag.mockRejectedValue(new Error('SECURE_FLAG_FAILED'));

        const { SettingsStore, ModalStore, toggle } = await turnOn();

        expect(SettingsStore.updateSettingsGroup).toHaveBeenLastCalledWith(
            'privacy',
            { screenCaptureProtection: false }
        );
        expect(ModalStore.toggleInfoModal).toHaveBeenCalledWith({
            title: 'general.error',
            text: 'views.Settings.Privacy.screenCaptureProtection.unavailable'
        });
        expect(toggle().props.value).toBe(false);
    });
});
