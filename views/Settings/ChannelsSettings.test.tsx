jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../utils/BackendUtils', () => ({
    isLNDBased: () => false,
    supportsSimpleTaprootChannels: () => false,
    supportsChannelOpenMinConfs: jest.fn(() => true)
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../components/TextInput', () => 'TextInput');

import * as React from 'react';
import ChannelsSettings from './ChannelsSettings';
import BackendUtils from '../../utils/BackendUtils';

const childrenOf = (element: any): any[] =>
    React.Children.toArray(element?.props?.children);

// first element in the tree, depth first, that matches
const findElement = (node: any, match: (element: any) => boolean): any => {
    if (!React.isValidElement(node)) return undefined;
    if (match(node)) return node;
    for (const child of childrenOf(node)) {
        const found = findElement(child, match);
        if (found) return found;
    }
    return undefined;
};

const makeView = (supportsMinConfs: boolean, settings: any = {}) => {
    (BackendUtils.supportsChannelOpenMinConfs as jest.Mock).mockReturnValue(
        supportsMinConfs
    );
    const updateSettings = jest.fn();
    const view = new ChannelsSettings({
        navigation: {},
        SettingsStore: {
            settings,
            getSettings: jest.fn(async () => settings),
            updateSettings,
            // same merge as SettingsStore.updateSettingsGroup, recorded
            // as the functional update it hands to updateSettings
            updateSettingsGroup: jest.fn((group: string, patch: any) =>
                updateSettings((current: any) => ({
                    [group]: {
                        ...current?.[group],
                        ...(typeof patch === 'function'
                            ? patch(current?.[group])
                            : patch)
                    }
                }))
            )
        }
    } as unknown as React.ComponentProps<typeof ChannelsSettings>);
    // setState on a class that was never mounted does nothing, so apply it
    // directly
    jest.spyOn(view, 'setState').mockImplementation((update: any) => {
        view.state = { ...view.state, ...update };
    });
    return view;
};

const updateSettingsOf = (view: ChannelsSettings) =>
    view.props.SettingsStore.updateSettings as jest.Mock;

// the settings the last updateSettings call would write, given the
// settings current when the store applies it
const lastUpdateAgainst = (view: ChannelsSettings, current: any) => {
    const calls = updateSettingsOf(view).mock.calls;
    const update = calls[calls.length - 1][0];
    return typeof update === 'function' ? update(current) : update;
};

const findAnnounceSwitch = (view: ChannelsSettings) =>
    findElement(view.render(), (element) => element.type === 'Switch');

const findMinConfsInput = (view: ChannelsSettings) =>
    findElement(
        view.render(),
        (element) =>
            element.type === 'TextInput' && element.props.placeholder === '1'
    );

describe('ChannelsSettings min confs field', () => {
    it('is shown when the backend uses min confs', () => {
        expect(findMinConfsInput(makeView(true))).toBeDefined();
    });

    it('is hidden when the backend ignores min confs', () => {
        expect(findMinConfsInput(makeView(false))).toBeUndefined();
    });
});

describe('ChannelsSettings min confs default', () => {
    it.each([
        [0, '0'],
        [3, '3'],
        [undefined, '1']
    ])('a saved min confs of %s shows %s', async (saved, shown) => {
        const view = makeView(true, { channels: { min_confs: saved } });
        await view.componentDidMount();

        expect(findMinConfsInput(view).props.value).toBe(shown);
    });
});

describe('ChannelsSettings toggle defaults', () => {
    it('uses the default for each toggle missing from saved settings', async () => {
        const view = makeView(true, { channels: { min_confs: 3 } });
        await view.componentDidMount();

        expect(view.state).toEqual({
            min_confs: 3,
            privateChannel: true,
            scidAlias: true,
            simpleTaprootChannel: false
        });
    });
});

describe('ChannelsSettings first render', () => {
    it.each([
        [0, '0'],
        [3, '3'],
        [undefined, '1']
    ])(
        'a saved min confs of %s shows %s before settings reload',
        (saved, shown) => {
            const view = makeView(true, { channels: { min_confs: saved } });

            expect(findMinConfsInput(view).props.value).toBe(shown);
        }
    );

    it('shows the saved toggles before settings reload', () => {
        const view = makeView(true, {
            channels: {
                privateChannel: false,
                scidAlias: false,
                simpleTaprootChannel: true
            }
        });

        expect(view.state).toEqual({
            min_confs: 1,
            privateChannel: false,
            scidAlias: false,
            simpleTaprootChannel: true
        });
    });

    it('uses the default for each toggle missing from saved settings', () => {
        expect(makeView(true, { channels: { min_confs: 3 } }).state).toEqual({
            min_confs: 3,
            privateChannel: true,
            scidAlias: true,
            simpleTaprootChannel: false
        });
    });

    it('uses the defaults when no channel settings are saved', () => {
        expect(makeView(true).state).toEqual({
            min_confs: 1,
            privateChannel: true,
            scidAlias: true,
            simpleTaprootChannel: false
        });
    });
});

describe('ChannelsSettings min confs input', () => {
    it('saves a typed 0', async () => {
        const view = makeView(true, { channels: { min_confs: 1 } });
        await findMinConfsInput(view).props.onChangeText('0');

        expect(view.state.min_confs).toBe(0);
        expect(lastUpdateAgainst(view, { channels: { min_confs: 1 } })).toEqual(
            { channels: { min_confs: 0 } }
        );
    });

    it('saves a cleared field as unset, not 0', async () => {
        const view = makeView(true, { channels: { min_confs: 3 } });
        await findMinConfsInput(view).props.onChangeText('');

        expect(view.state.min_confs).toBeUndefined();
        expect(findMinConfsInput(view).props.value).toBe('');
        expect(lastUpdateAgainst(view, { channels: { min_confs: 3 } })).toEqual(
            { channels: { min_confs: undefined } }
        );
    });
});

describe('ChannelsSettings writes merge into current settings', () => {
    // a toggle saved after this render but before the next write lands
    // must survive that write
    const current = { channels: { min_confs: 1, privateChannel: false } };

    it('keeps a toggle saved since render when min confs changes', async () => {
        const view = makeView(true, {
            channels: { min_confs: 1, privateChannel: true }
        });
        await findMinConfsInput(view).props.onChangeText('2');

        expect(lastUpdateAgainst(view, current)).toEqual({
            channels: { min_confs: 2, privateChannel: false }
        });
    });

    it('keeps min confs saved since render when a toggle changes', async () => {
        const view = makeView(true, {
            channels: { min_confs: 1, scidAlias: true }
        });
        // announce on, so the channel is not private
        await findAnnounceSwitch(view).props.onValueChange(true);

        expect(
            lastUpdateAgainst(view, {
                channels: { min_confs: 4, scidAlias: false }
            })
        ).toEqual({
            channels: { min_confs: 4, scidAlias: false, privateChannel: false }
        });
    });
});
