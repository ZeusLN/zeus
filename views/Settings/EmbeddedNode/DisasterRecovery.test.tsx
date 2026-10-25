jest.mock('../../../stores/Stores', () => ({
    channelBackupStore: { recoverStaticChannelBackup: jest.fn() },
    settingsStore: { settings: {}, updateSettings: jest.fn() }
}));
jest.mock('../../../stores/ChannelBackupStore', () => ({
    LAST_CHANNEL_BACKUP_STATUS: 'status',
    LAST_CHANNEL_BACKUP_TIME: 'time'
}));
jest.mock('../../../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(async () => null) }
}));
jest.mock('../../../lndmobile/channel', () => ({}));
jest.mock('../../../utils/LocaleUtils');
jest.mock('../../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../../utils/RestartUtils', () => ({ restartNeeded: jest.fn() }));
jest.mock('@react-native-clipboard/clipboard', () => ({}));
jest.mock('@rneui/themed', () => {
    const ListItem: any = ({ children }: any) => children;
    ListItem.Title = require('react-native').Text;
    return { ListItem, Divider: 'Divider' };
});
jest.mock('../../../components/Button', () => 'Button');
jest.mock('../../../components/KeyValue', () => 'KeyValue');
jest.mock('../../../components/Header', () => 'Header');
jest.mock('../../../components/Screen', () => 'Screen');
jest.mock('../../../components/Switch', () => 'Switch');

import * as React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import DisasterRecovery from './DisasterRecovery';
import { channelBackupStore, settingsStore } from '../../../stores/Stores';
import { restartNeeded } from '../../../utils/RestartUtils';

describe('DisasterRecovery', () => {
    // The error handler clears the message after 5 seconds
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // @rneui's Button renders title as children, so an Error object there
    // throws "Objects are not valid as a React child" and takes down the
    // screen. The title has to be the message string.
    it('shows the Olympus recovery error message on the button', async () => {
        (
            channelBackupStore.recoverStaticChannelBackup as jest.Mock
        ).mockRejectedValue(new Error('No backup found'));

        await render(<DisasterRecovery navigation={{} as any} />);
        const titles = () =>
            screen.container
                .queryAll((n) => n.type === 'Button')
                .map((n) => n.props.title);
        const recoverButton = screen.container
            .queryAll((n) => n.type === 'Button')
            .find(
                (n) =>
                    n.props.title ===
                    'views.Settings.EmbeddedNode.initiateDisasterRecoveryOlympus'
            )!;
        await act(async () => {
            await recoverButton.props.onPress();
        });

        expect(titles()).toContain('No backup found');
        for (const title of titles()) {
            expect(typeof title).toBe('string');
        }

        await act(async () => {
            jest.advanceTimersByTime(5000);
        });
        expect(titles()).not.toContain('No backup found');
        expect(titles()).toContain(
            'views.Settings.EmbeddedNode.initiateDisasterRecoveryOlympus'
        );
    });

    describe('automatic backups switch', () => {
        const backupSwitch = () =>
            screen.container.queryAll((n) => n.type === 'Switch')[0];

        it.each([
            ['on for a stored true', true, true],
            ['off for a stored false', false, false],
            ['off when unset, like Wallet.tsx', undefined, false]
        ])('is %s', async (_, stored, shown) => {
            (settingsStore as any).settings = {
                automaticDisasterRecoveryBackup: stored
            };

            await render(<DisasterRecovery navigation={{} as any} />);

            expect(backupSwitch().props.value).toBe(shown);
        });

        it('turns automatic backups back on when they are off', async () => {
            (settingsStore as any).settings = {
                automaticDisasterRecoveryBackup: false
            };

            await render(<DisasterRecovery navigation={{} as any} />);
            await act(async () => {
                await backupSwitch().props.onValueChange();
            });

            expect(settingsStore.updateSettings).toHaveBeenCalledWith({
                automaticDisasterRecoveryBackup: true
            });
            expect(restartNeeded).toHaveBeenCalled();
            expect(backupSwitch().props.value).toBe(true);
        });
    });
});
