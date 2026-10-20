jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ ButtonGroup: 'ButtonGroup' }));
jest.mock('react-native-nfc-manager', () => ({
    __esModule: true,
    default: { isSupported: jest.fn(async () => false) }
}));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../utils/BackendUtils', () => ({
    __esModule: true,
    default: { createOffer: jest.fn(), listOffers: jest.fn() }
}));
const mockNetworkFetch = jest.fn();
jest.mock('../../utils/NetworkUtils', () => ({
    networkFetch: (...args: any[]) => mockNetworkFetch(...args)
}));
jest.mock('../../components/CollapsedQR', () => 'CollapsedQR');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/TextInput', () => {
    const { TextInput } = require('react-native');
    return (props: any) => <TextInput testID="local-part" {...props} />;
});
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress }: any) => (
        <Pressable role="button" onPress={onPress}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return {
        ErrorMessage: ({ message }: any) => <Text>{message}</Text>
    };
});

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import BackendUtils from '../../utils/BackendUtils';
import Bolt12Address from './Bolt12Address';

const createOffer = BackendUtils.createOffer as jest.Mock;
const OFFER = 'lno1qgsqvgnwgcg35z6ee2h3yczraddm72xrfua9uve2rlrm9deu7xyfzr';

const requestAddress = async (enableTor: boolean) => {
    const SettingsStore = {
        enableTor,
        getSettings: jest.fn(async () => ({})),
        updateSettings: jest.fn(async () => undefined)
    };
    await render(
        <Bolt12Address
            navigation={{} as any}
            SettingsStore={SettingsStore as any}
        />
    );
    await fireEvent.changeText(screen.getByTestId('local-part'), 'satoshi');
    await fireEvent.press(
        screen.getByText('views.Settings.Bolt12Address.requestButton')
    );
    return SettingsStore;
};

describe('Bolt12Address request', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        createOffer.mockResolvedValue({ bolt12: OFFER });
        mockNetworkFetch.mockResolvedValue({ info: () => ({ status: 201 }) });
    });

    it.each([true, false])(
        'registers the offer with twelve.cash through networkFetch (Tor %s)',
        async (enableTor) => {
            const store = await requestAddress(enableTor);

            expect(mockNetworkFetch).toHaveBeenCalledTimes(1);
            const args = mockNetworkFetch.mock.calls[0][0];
            expect(args).toMatchObject({
                method: 'POST',
                url: 'https://twelve.cash/record',
                enableTor
            });
            expect(JSON.parse(args.body)).toEqual({
                localPart: 'satoshi',
                bolt12: OFFER
            });
            expect(store.updateSettings).toHaveBeenCalledWith({
                bolt12Address: { localPart: 'satoshi', offer: OFFER }
            });
        }
    );

    it('shows the handle-taken error on 409 and saves nothing', async () => {
        mockNetworkFetch.mockResolvedValue({ info: () => ({ status: 409 }) });

        const store = await requestAddress(false);

        expect(
            screen.getByText('views.Settings.Bolt12Address.error.handleTaken')
        ).toBeTruthy();
        expect(store.updateSettings).not.toHaveBeenCalled();
    });

    it('shows the create error on any other non-201 status', async () => {
        mockNetworkFetch.mockResolvedValue({ info: () => ({ status: 500 }) });

        const store = await requestAddress(false);

        expect(
            screen.getByText(
                'views.Settings.Bolt12Address.error.failedToCreate'
            )
        ).toBeTruthy();
        expect(store.updateSettings).not.toHaveBeenCalled();
    });
});
