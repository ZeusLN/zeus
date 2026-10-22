jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/Stores');
jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));
jest.mock('@react-native-documents/picker', () => ({
    errorCodes: {},
    isErrorWithCode: () => false
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) =>
        key === 'views.Swaps.rescueKey.deleteUnfinishedSwaps'
            ? 'Unfinished swaps: {{swaps}}'
            : key
}));
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#000' }));
jest.mock('../../utils/MigrationUtils', () => ({
    IS_BACKED_UP_KEY: 'backed-up'
}));
jest.mock('../../utils/ChannelMigrationUtils', () => ({
    graphDataExists: jest.fn(async () => false),
    handleExportChannels: jest.fn()
}));
const mockStored: { [key: string]: string | undefined } = {};
jest.mock('../../storage', () => ({
    getItem: jest.fn(async (key: string) => mockStored[key]),
    removeItem: jest.fn(async () => {})
}));
jest.mock('../../utils/SwapUtils', () => ({
    SWAPS_KEY: 'swaps',
    REVERSE_SWAPS_KEY: 'reverse-swaps',
    SWAPS_LAST_USED_KEY: 'swaps-last-used-key',
    SWAPS_RESCUE_KEY: 'swaps-rescue-key',
    purgeLegacyRescueKeyFiles: jest.fn(async () => {}),
    saveRescueKeyFile: jest.fn(),
    unlinkRescueKeyStagingFile: jest.fn(async () => {})
}));
jest.mock('../../components/Button', () => {
    const { Text, TouchableOpacity } = require('react-native');
    return ({ title, onPress }: any) => (
        <TouchableOpacity accessibilityRole="button" onPress={onPress}>
            <Text>{title}</Text>
        </TouchableOpacity>
    );
});
jest.mock('../../components/ModalBox', () => {
    const { View } = require('react-native');
    return ({ isOpen, children }: any) =>
        isOpen ? <View>{children}</View> : null;
});
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/CopyButton', () => 'CopyButton');
jest.mock('../../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));
jest.mock(
    '../../components/Modals/ChannelBackupLoadingModal',
    () => 'ChannelBackupLoadingModal'
);
jest.mock('../../assets/images/SVG/Skull.svg', () => 'Skull');
jest.mock('../../assets/images/SVG/QR.svg', () => 'QR');

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Storage from '../../storage';
import Seed from './Seed';

const removeItem = Storage.removeItem as jest.Mock;

const RESCUE_KEY = 'abandon '.repeat(11).concat('about').split(' ');

const mountRescueKey = async () => {
    const navigation = { popTo: jest.fn(), navigate: jest.fn() };
    await render(
        <Seed
            navigation={navigation as any}
            SettingsStore={{ getSettings: jest.fn() } as any}
            NodeInfoStore={{ nodeInfo: {} } as any}
            SyncStore={{ isSyncing: false } as any}
            ChannelsStore={
                {
                    channels: [],
                    pendingChannels: [],
                    closedChannels: []
                } as any
            }
            route={
                {
                    params: { seedPhrase: RESCUE_KEY, skipWarning: true }
                } as any
            }
        />
    );
    await fireEvent.press(screen.getByText('views.Swaps.rescueKey.delete'));
    return navigation;
};

const pressConfirm = () => fireEvent.press(screen.getByText('general.confirm'));

describe('Seed rescue key deletion', () => {
    beforeEach(() => {
        for (const key of Object.keys(mockStored)) delete mockStored[key];
        removeItem.mockClear();
    });

    it('deletes on the first confirmation when every swap is finished', async () => {
        mockStored.swaps = JSON.stringify([
            { id: 'sub1', type: 'Submarine', status: 'transaction.claimed' }
        ]);
        mockStored['reverse-swaps'] = JSON.stringify([
            { id: 'rev1', type: 'Reverse', status: 'invoice.settled' }
        ]);
        const navigation = await mountRescueKey();

        await pressConfirm();

        expect(removeItem).toHaveBeenCalledWith('swaps-rescue-key');
        expect(removeItem).toHaveBeenCalledWith('swaps');
        expect(removeItem).toHaveBeenCalledWith('reverse-swaps');
        expect(navigation.popTo).toHaveBeenCalledWith('Swaps');
    });

    it('asks again and names the swaps when a swap is unfinished', async () => {
        mockStored.swaps = JSON.stringify([
            { id: 'sub1', type: 'Submarine', status: 'swap.expired' }
        ]);
        mockStored['reverse-swaps'] = JSON.stringify([
            { id: 'rev1', type: 'Reverse', status: 'transaction.mempool' },
            { id: 'rev2', type: 'Reverse', status: 'invoice.settled' }
        ]);
        const navigation = await mountRescueKey();

        await pressConfirm();

        expect(removeItem).not.toHaveBeenCalled();
        expect(navigation.popTo).not.toHaveBeenCalled();
        expect(screen.getByText('Unfinished swaps: sub1, rev1')).toBeTruthy();

        await pressConfirm();

        expect(removeItem).toHaveBeenCalledWith('swaps-rescue-key');
        expect(removeItem).toHaveBeenCalledWith('swaps');
        expect(removeItem).toHaveBeenCalledWith('reverse-swaps');
        expect(navigation.popTo).toHaveBeenCalledWith('Swaps');
    });

    it('asks again after a cancel', async () => {
        mockStored.swaps = JSON.stringify([
            { id: 'sub1', type: 'Submarine', status: 'invoice.pending' }
        ]);
        await mountRescueKey();

        await pressConfirm();
        await fireEvent.press(screen.getByText('general.cancel'));
        await fireEvent.press(screen.getByText('views.Swaps.rescueKey.delete'));
        await pressConfirm();

        expect(removeItem).not.toHaveBeenCalled();
    });
});
