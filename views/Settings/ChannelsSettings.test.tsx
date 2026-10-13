jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../utils/BackendUtils', () => ({
    isLNDBased: jest.fn(() => true),
    supportsSimpleTaprootChannels: jest.fn(() => true),
    supportsChannelOpenMinConfs: jest.fn(() => true)
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../components/Header', () => () => null);
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Text', () => {
    const { Text } = require('react-native');
    return ({ children }: any) => <Text>{children}</Text>;
});
jest.mock('../../components/TextInput', () => {
    const { TextInput } = require('react-native');
    return (props: any) => <TextInput {...props} />;
});

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ChannelsSettings from './ChannelsSettings';
import BackendUtils from '../../utils/BackendUtils';

const supportsMinConfs = BackendUtils.supportsChannelOpenMinConfs as jest.Mock;

// getSettings resolves to `reloaded`, or never when it is left out, so a
// test can look at the first render before settings reload
const renderView = async (settings: any = {}, reloaded?: any) => {
    const updateSettings = jest.fn();
    const SettingsStore = {
        settings,
        getSettings: jest.fn(() =>
            reloaded === undefined
                ? new Promise(() => {})
                : Promise.resolve(reloaded)
        ),
        updateSettings,
        // same merge as SettingsStore.updateSettingsGroup, recorded as the
        // functional update it hands to updateSettings
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
    };
    await render(
        <ChannelsSettings
            navigation={{} as any}
            SettingsStore={SettingsStore as any}
        />
    );
    return updateSettings;
};

// the settings the last updateSettings call would write, given the settings
// current when the store applies it
const lastUpdateAgainst = (updateSettings: jest.Mock, current: any) => {
    const calls = updateSettings.mock.calls;
    const update = calls[calls.length - 1][0];
    return typeof update === 'function' ? update(current) : update;
};

const minConfsInput = () => screen.getByPlaceholderText('1');

// With every row shown, the switches appear in this order
const switches = () => {
    for (const label of [
        'views.OpenChannel.announceChannel',
        'views.OpenChannel.scidAlias',
        'views.OpenChannel.simpleTaprootChannel'
    ]) {
        expect(screen.getByText(label)).toBeOnTheScreen();
    }
    const [announce, scidAlias, taproot] = screen.getAllByRole('switch');
    return { announce, scidAlias, taproot };
};

const flip = (sw: any, value: boolean) =>
    fireEvent(sw, 'change', { nativeEvent: { value } });

beforeEach(() => {
    supportsMinConfs.mockReturnValue(true);
});

describe('ChannelsSettings min confs field', () => {
    it('is shown when the backend uses min confs', async () => {
        await renderView();
        expect(minConfsInput()).toBeOnTheScreen();
    });

    it('is hidden when the backend ignores min confs', async () => {
        supportsMinConfs.mockReturnValue(false);
        await renderView();
        expect(screen.queryByPlaceholderText('1')).not.toBeOnTheScreen();
    });
});

describe('ChannelsSettings after settings reload', () => {
    it.each([
        [0, '0'],
        [3, '3'],
        [undefined, '1']
    ])('a saved min confs of %s shows %s', async (saved, shown) => {
        const settings = { channels: { min_confs: saved } };
        await renderView({}, settings);

        expect(minConfsInput()).toHaveDisplayValue(shown);
    });

    it('uses the default for each toggle missing from saved settings', async () => {
        await renderView({}, { channels: { min_confs: 3 } });

        const { announce, scidAlias, taproot } = switches();
        expect(minConfsInput()).toHaveDisplayValue('3');
        // private by default, so announce is off
        expect(announce).not.toBeChecked();
        expect(scidAlias).toBeChecked();
        expect(taproot).not.toBeChecked();
    });
});

describe('ChannelsSettings first render', () => {
    it.each([
        [0, '0'],
        [3, '3'],
        [undefined, '1']
    ])(
        'a saved min confs of %s shows %s before settings reload',
        async (saved, shown) => {
            await renderView({ channels: { min_confs: saved } });

            expect(minConfsInput()).toHaveDisplayValue(shown);
        }
    );

    it('shows the saved toggles before settings reload', async () => {
        await renderView({
            channels: {
                privateChannel: false,
                scidAlias: false,
                simpleTaprootChannel: true
            }
        });

        const { announce, scidAlias, taproot } = switches();
        expect(minConfsInput()).toHaveDisplayValue('1');
        expect(announce).toBeChecked();
        expect(scidAlias).not.toBeChecked();
        expect(taproot).toBeChecked();
    });

    it('uses the defaults when no channel settings are saved', async () => {
        await renderView();

        const { announce, scidAlias, taproot } = switches();
        expect(minConfsInput()).toHaveDisplayValue('1');
        expect(announce).not.toBeChecked();
        expect(scidAlias).toBeChecked();
        expect(taproot).not.toBeChecked();
    });
});

describe('ChannelsSettings min confs input', () => {
    it('saves a typed 0', async () => {
        const updateSettings = await renderView({
            channels: { min_confs: 1 }
        });
        await fireEvent.changeText(minConfsInput(), '0');

        expect(minConfsInput()).toHaveDisplayValue('0');
        expect(
            lastUpdateAgainst(updateSettings, { channels: { min_confs: 1 } })
        ).toEqual({ channels: { min_confs: 0 } });
    });

    it('saves a cleared field as unset, not 0', async () => {
        const updateSettings = await renderView({
            channels: { min_confs: 3 }
        });
        await fireEvent.changeText(minConfsInput(), '');

        expect(minConfsInput()).toHaveDisplayValue('');
        expect(
            lastUpdateAgainst(updateSettings, { channels: { min_confs: 3 } })
        ).toEqual({ channels: { min_confs: undefined } });
    });
});

describe('ChannelsSettings writes merge into current settings', () => {
    it('keeps a toggle saved since render when min confs changes', async () => {
        // a toggle saved after this render but before the next write lands
        // must survive that write
        const updateSettings = await renderView({
            channels: { min_confs: 1, privateChannel: true }
        });
        await fireEvent.changeText(minConfsInput(), '2');

        expect(
            lastUpdateAgainst(updateSettings, {
                channels: { min_confs: 1, privateChannel: false }
            })
        ).toEqual({
            channels: { min_confs: 2, privateChannel: false }
        });
    });

    it('keeps min confs saved since render when a toggle changes', async () => {
        const updateSettings = await renderView({
            channels: { min_confs: 1, scidAlias: true }
        });
        // announce on, so the channel is not private
        await flip(switches().announce, true);

        expect(switches().announce).toBeChecked();
        expect(
            lastUpdateAgainst(updateSettings, {
                channels: { min_confs: 4, scidAlias: false }
            })
        ).toEqual({
            channels: { min_confs: 4, scidAlias: false, privateChannel: false }
        });
    });

    it('saves the scidAlias toggle into the channels group', async () => {
        const updateSettings = await renderView({
            channels: { min_confs: 2 }
        });
        await flip(switches().scidAlias, false);

        expect(switches().scidAlias).not.toBeChecked();
        expect(
            lastUpdateAgainst(updateSettings, { channels: { min_confs: 2 } })
        ).toEqual({ channels: { min_confs: 2, scidAlias: false } });
    });

    it('makes the channel private when taproot is turned on', async () => {
        const updateSettings = await renderView({
            channels: { min_confs: 2, privateChannel: false }
        });
        expect(switches().announce).toBeChecked();

        await flip(switches().taproot, true);

        // Taproot channels must be private
        expect(switches().taproot).toBeChecked();
        expect(switches().announce).not.toBeChecked();
        expect(
            lastUpdateAgainst(updateSettings, { channels: { min_confs: 2 } })
        ).toEqual({
            channels: {
                min_confs: 2,
                privateChannel: true,
                simpleTaprootChannel: true
            }
        });
    });
});
