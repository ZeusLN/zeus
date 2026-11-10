jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
// AlertStore is mocked here too; UrlUtils is used by the view's
// isValidCustomUrl, and the mock prevents the real store graph from loading.
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
import { act, render, screen } from '@testing-library/react-native';
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
    const walk = (n: any): any[] =>
        !n || typeof n !== 'object'
            ? []
            : [n, ...(n.children || []).flatMap(walk)];

    const renderPrivacy = async (privacy: any) => {
        const SettingsStore = {
            settings: {},
            getSettings: jest.fn(async () => ({ privacy })),
            flushPendingSettings: jest.fn(),
            updateSettingsGroup: jest.fn(async () => {}),
            updateSettingsGroupDebounced: jest.fn()
        };
        // This repo's RNTL version returns a thenable; awaiting it flushes
        // componentDidMount's getSettings promise and the resulting setState.
        const { unmount } = await render(
            <Privacy
                navigation={{} as any}
                SettingsStore={SettingsStore as any}
            />
        );
        return { SettingsStore, unmount };
    };

    const findDropdown = (selectedValue: string) =>
        walk(screen.container).find(
            (n: any) =>
                n.type === 'DropdownSetting' &&
                n.props?.selectedValue === selectedValue
        );

    const findCustomInput = () =>
        screen.getByPlaceholderText('https://mempool.mynode.local');

    beforeEach(() => {
        (alertStore.clearMempoolError as jest.Mock).mockClear();
    });

    it('clears and writes the new instance when the dropdown changes', async () => {
        const { SettingsStore } = await renderPrivacy({
            defaultBlockExplorer: 'bitcoinexplorer.org',
            mempoolInstance: 'https://mempool.space'
        });

        const dropdown = findDropdown('https://mempool.space');
        await act(async () => {
            await dropdown.props.onValueChange('https://example.com');
        });

        expect(alertStore.clearMempoolError).toHaveBeenCalledTimes(1);
        expect(SettingsStore.updateSettingsGroup).toHaveBeenCalledWith(
            'privacy',
            { mempoolInstance: 'https://example.com' }
        );
    });

    it('does not clear when the dropdown is set to the same value', async () => {
        const { SettingsStore } = await renderPrivacy({
            defaultBlockExplorer: 'bitcoinexplorer.org',
            mempoolInstance: 'https://mempool.space'
        });

        const dropdown = findDropdown('https://mempool.space');
        await act(async () => {
            await dropdown.props.onValueChange('https://mempool.space');
        });

        // The write still happens, but the redundant clear is skipped.
        expect(SettingsStore.updateSettingsGroup).toHaveBeenCalledWith(
            'privacy',
            { mempoolInstance: 'https://mempool.space' }
        );
        expect(alertStore.clearMempoolError).not.toHaveBeenCalled();
    });

    it('clears the alert and writes the unmount fallback for an empty Custom URL', async () => {
        const { SettingsStore, unmount } = await renderPrivacy({
            defaultBlockExplorer: 'mempool.space',
            mempoolInstance: 'Custom',
            customMempoolInstance: 'https://broken.example'
        });

        const input = findCustomInput();
        await act(async () => {
            input.props.onChangeText('');
        });

        // Empty resolves to the default instance, so the alert must clear.
        expect(alertStore.clearMempoolError).toHaveBeenCalledTimes(1);
        expect(SettingsStore.updateSettingsGroupDebounced).toHaveBeenCalledWith(
            'privacy',
            { customMempoolInstance: '' }
        );

        // On unmount, customFallbacks reverts the dropdown to the default
        // instance via the callback form of updateSettingsGroup. Mirrors the
        // existing Privacy unmount tests.
        await act(async () => {
            await unmount();
        });

        const fallbackCall = (
            SettingsStore.updateSettingsGroup.mock.calls as any[]
        ).find(
            ([group, arg]) => group === 'privacy' && typeof arg === 'function'
        );
        expect(fallbackCall).toBeDefined();

        const [, update] = fallbackCall!;
        expect(
            update({ mempoolInstance: 'Custom', customMempoolInstance: '' })
        ).toEqual({ mempoolInstance: 'https://mempool.space' });
    });

    it('clears the alert for a valid Custom URL', async () => {
        const { SettingsStore } = await renderPrivacy({
            defaultBlockExplorer: 'bitcoinexplorer.org',
            mempoolInstance: 'Custom',
            customMempoolInstance: 'https://broken.example'
        });

        const input = findCustomInput();
        await act(async () => {
            input.props.onChangeText('https://mempool.example.com');
        });

        expect(alertStore.clearMempoolError).toHaveBeenCalledTimes(1);
        expect(SettingsStore.updateSettingsGroupDebounced).toHaveBeenCalledWith(
            'privacy',
            {
                customMempoolInstance: 'https://mempool.example.com'
            }
        );
    });

    it('neither clears nor saves for an invalid Custom URL, then clears for a valid one', async () => {
        const { SettingsStore } = await renderPrivacy({
            defaultBlockExplorer: 'bitcoinexplorer.org',
            mempoolInstance: 'Custom',
            customMempoolInstance: 'https://broken.example'
        });

        const input = findCustomInput();

        await act(async () => {
            input.props.onChangeText('not a url');
        });
        expect(alertStore.clearMempoolError).not.toHaveBeenCalled();
        expect(
            SettingsStore.updateSettingsGroupDebounced
        ).not.toHaveBeenCalled();

        await act(async () => {
            input.props.onChangeText('https://mempool.example.com');
        });
        expect(alertStore.clearMempoolError).toHaveBeenCalledTimes(1);
        expect(SettingsStore.updateSettingsGroupDebounced).toHaveBeenCalledWith(
            'privacy',
            {
                customMempoolInstance: 'https://mempool.example.com'
            }
        );
    });

    it('clears the alert before the settings write resolves', async () => {
        const { SettingsStore } = await renderPrivacy({
            defaultBlockExplorer: 'bitcoinexplorer.org',
            mempoolInstance: 'https://mempool.space'
        });

        let resolveWrite: () => void = () => {};
        SettingsStore.updateSettingsGroup.mockReturnValue(
            new Promise<void>((resolve) => {
                resolveWrite = resolve;
            })
        );

        const dropdown = findDropdown('https://mempool.space');
        let handlerPromise: Promise<void> = Promise.resolve();
        await act(async () => {
            handlerPromise = dropdown.props.onValueChange(
                'https://example.com'
            );
            // Let the synchronous part of the handler run.
            await Promise.resolve();
        });

        expect(alertStore.clearMempoolError).toHaveBeenCalledTimes(1);

        resolveWrite();
        await act(async () => {
            await handlerPromise;
        });
    });
});
