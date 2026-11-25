jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../../stores/ChannelBackupStore', () => ({}));
jest.mock('../../../utils/DateTimeUtils', () => ({
    __esModule: true,
    default: { formatDateTimeShort: () => 'date' }
}));
jest.mock('../../../utils/LocaleUtils');
jest.mock('../../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
// Renders every row; the real list is slow to load on a cold Jest cache
jest.mock('react-native/Libraries/Lists/FlatList', () => ({
    __esModule: true,
    default: ({ data, renderItem, keyExtractor }: any) => {
        const React = require('react');
        return data.map((item: any, index: number) => (
            <React.Fragment key={keyExtractor(item, index)}>
                {renderItem({ item, index })}
            </React.Fragment>
        ));
    }
}));
jest.mock('@rneui/themed', () => ({ ListItem: 'ListItem' }));
jest.mock('../../../components/Button', () => 'Button');
jest.mock('../../../components/Header', () => 'Header');
jest.mock('../../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../../components/Screen', () => 'Screen');
jest.mock('../../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));

import * as React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import DisasterRecoveryAdvanced from './DisasterRecoveryAdvanced';

const SELECT = 'views.Settings.EmbeddedNode.AdvancedDisasterRecovery.select';
const START =
    'views.Settings.EmbeddedNode.AdvancedDisasterRecovery.startRecovery';

describe('DisasterRecoveryAdvanced', () => {
    const backups = [
        { id: 1, backup: 'backup-one', created_at: '2026-11-01' },
        { id: 2, backup: 'backup-two', created_at: '2026-11-02' }
    ];

    const renderView = async () => {
        const store = {
            backups,
            loading: false,
            error: false,
            error_msg: '',
            resetRecoveryState: jest.fn(),
            advancedRecoveryList: jest.fn(),
            triggerRecovery: jest.fn().mockResolvedValue(undefined)
        };
        const navigation = { popTo: jest.fn() };
        await render(
            <DisasterRecoveryAdvanced
                navigation={navigation as any}
                ChannelBackupStore={store as any}
            />
        );
        return { store, navigation };
    };

    const button = () =>
        screen.container.queryAll((n) => n.type === 'Button')[0];
    const rows = () => screen.container.queryAll((n) => n.type === 'ListItem');

    it('keeps the button disabled until a backup is selected', async () => {
        await renderView();

        expect(button().props.title).toBe(SELECT);
        expect(button().props.disabled).toBe(true);

        await act(async () => {
            rows()[1].props.onPress();
        });

        expect(button().props.title).toBe(START);
        expect(button().props.disabled).toBe(false);
    });

    it('starts recovery with the selected backup', async () => {
        const { store, navigation } = await renderView();

        await act(async () => {
            rows()[1].props.onPress();
        });
        await act(async () => {
            await button().props.onPress();
        });

        expect(store.triggerRecovery).toHaveBeenCalledTimes(1);
        expect(store.triggerRecovery).toHaveBeenCalledWith('backup-two');
        expect(navigation.popTo).toHaveBeenCalledWith('Wallet');
    });
});
