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
import { act, fireEvent, render, screen } from '@testing-library/react-native';
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

    it('restores the saved URL without clearing for an invalid Custom URL, then clears for a valid one', async () => {
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
        // the invalid text is not saved; the URL stored when the screen
        // opened is queued instead
        expect(
            SettingsStore.updateSettingsGroupDebounced
        ).toHaveBeenCalledTimes(1);
        expect(SettingsStore.updateSettingsGroupDebounced).toHaveBeenCalledWith(
            'privacy',
            {
                customMempoolInstance: 'https://broken.example'
            }
        );

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

// A fake store with the real debounce contract: debounced patches
// collect until a flush (timer, unmount, backgrounding) writes them
const makeStore = (privacy: any) => {
    const stored: any = { privacy: { ...privacy } };
    let pending: any = {};
    const store = {
        stored,
        settings: {},
        getSettings: jest.fn(async () => stored),
        updateSettingsGroup: jest.fn((group: string, patch: any) => {
            stored[group] = {
                ...stored[group],
                ...(typeof patch === 'function' ? patch(stored[group]) : patch)
            };
        }),
        updateSettingsGroupDebounced: jest.fn((group: string, patch: any) => {
            pending[group] = { ...pending[group], ...patch };
        }),
        flushPendingSettings: jest.fn(() => {
            for (const group of Object.keys(pending)) {
                stored[group] = { ...stored[group], ...pending[group] };
            }
            pending = {};
        })
    };
    return store;
};

const mount = (store: any) =>
    render(<Privacy navigation={{} as any} SettingsStore={store} />);

const typeInto = (placeholder: string, text: string) =>
    fireEvent.changeText(
        screen.container.queryAll(
            (node) =>
                node.type === 'TextInput' &&
                node.props.placeholder === placeholder
        )[0],
        text
    );

// Every prefix of a typed URL is valid, so an invalid final value used
// to leave the last valid prefix saved, and requests went to that host
// (#4974)
describe.each([
    ['customBlockExplorer', 'https://explorer.mynode.local'],
    ['customMempoolInstance', 'https://mempool.mynode.local']
])('Privacy %s ending invalid', (field, placeholder) => {
    const privacy = {
        defaultBlockExplorer: 'Custom',
        mempoolInstance: 'Custom',
        customBlockExplorer: 'https://saved-explorer.onion',
        customMempoolInstance: 'https://saved-mempool.onion'
    };

    it('keeps the saved URL when the prefix was still pending', async () => {
        const store = makeStore(privacy);
        const { unmount } = await mount(store);

        await typeInto(placeholder, 'https://clearnet');
        await typeInto(placeholder, 'https://clearnet .onion');
        await unmount();

        expect(store.stored.privacy[field]).toEqual((privacy as any)[field]);
    });

    it('restores the saved URL when the prefix was already written', async () => {
        const store = makeStore(privacy);
        const { unmount } = await mount(store);

        await typeInto(placeholder, 'https://clearnet');
        // the debounce timer fires while the user pauses
        store.flushPendingSettings();
        expect(store.stored.privacy[field]).toEqual('https://clearnet');
        await typeInto(placeholder, 'https://clearnet .onion');
        await unmount();

        expect(store.stored.privacy[field]).toEqual((privacy as any)[field]);
    });

    // A written URL cannot be told apart from a written prefix
    it('restores the saved URL over a valid URL written earlier', async () => {
        const store = makeStore(privacy);
        const { unmount } = await mount(store);

        await typeInto(placeholder, 'https://new.onion');
        store.flushPendingSettings();
        expect(store.stored.privacy[field]).toEqual('https://new.onion');
        await typeInto(placeholder, 'https://new .onion');
        await unmount();

        expect(store.stored.privacy[field]).toEqual((privacy as any)[field]);
    });

    it('restores an empty saved URL', async () => {
        const store = makeStore({ ...privacy, [field]: '' });
        const { unmount } = await mount(store);

        await typeInto(placeholder, 'https://clearnet');
        store.flushPendingSettings();
        await typeInto(placeholder, 'https://clearnet .onion');
        await unmount();

        expect(store.stored.privacy[field]).toEqual('');
    });

    it('saves a valid final URL', async () => {
        const store = makeStore(privacy);
        const { unmount } = await mount(store);

        await typeInto(placeholder, 'https://clearnet .onion');
        await typeInto(placeholder, 'https://new.onion');
        await unmount();

        expect(store.stored.privacy[field]).toEqual('https://new.onion');
    });
});
