jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress, disabled }: any) => (
        <Pressable role="button" disabled={disabled} onPress={onPress}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../components/Pill', () => 'Pill');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Text', () => {
    const { Text } = require('react-native');
    return ({ children }: any) => <Text>{children}</Text>;
});
jest.mock('../../components/Header', () => () => null);
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/layout/Row', () => {
    const { View } = require('react-native');
    return { Row: ({ children }: any) => <View>{children}</View> };
});
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../../stores/LightningAddressStore', () => ({}));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../utils/handleAnything', () => jest.fn());
jest.mock('../../utils/DateTimeUtils', () => ({
    formatEpoch: () => ''
}));
jest.mock('../../utils/FontUtils', () => ({
    font: () => ({})
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => key
}));
jest.mock('../../assets/images/SVG/Gear.svg', () => () => null);
jest.mock('../../assets/images/SVG/zeus-pay.svg', () => () => null);
jest.mock('./ZeusPayPlusSettings', () => 'ZeusPayPlusSettings');
jest.mock('./ZeusPayPlusPerksList', () => 'ZeusPayPlusPerksList');

import * as React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import ZeusPayPlus from './ZeusPayPlus';
import handleAnything from '../../utils/handleAnything';

const SUBSCRIBE = 'views.LightningAddress.ZeusPayPlus.subscribe';
const ZeusPayPlusView = ZeusPayPlus as unknown as React.ComponentType<any>;

describe('ZeusPayPlus Subscribe button', () => {
    let alert: jest.SpyInstance;
    let consoleLog: jest.SpyInstance;

    beforeEach(() => {
        alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        alert.mockRestore();
        consoleLog.mockRestore();
        (handleAnything as jest.Mock).mockReset();
    });

    const pressSubscribe = async (createZeusPayPlusOrder: jest.Mock) => {
        const navigation = { navigate: jest.fn() };
        const LightningAddressStore = {
            createZeusPayPlusOrder,
            lightningAddressType: 'zeuspay',
            zeusPlusExpiresAt: 0,
            zeusPlusAnnualFeeSats: 1000,
            loading: false,
            error: false,
            error_msg: ''
        };

        await render(
            <ZeusPayPlusView
                navigation={navigation}
                LightningAddressStore={LightningAddressStore}
                SettingsStore={{}}
                route={{ key: 'ZeusPayPlus', name: 'ZeusPayPlus' }}
            />
        );

        await fireEvent.press(screen.getByText(SUBSCRIBE));
        await act(() => new Promise((resolve) => setImmediate(resolve)));

        return navigation.navigate;
    };

    it('opens the route when the order resolves with bolt11 and handleAnything resolves a route', async () => {
        const createOrder = jest
            .fn()
            .mockResolvedValue({ bolt11: 'lnbc1000n1...' });
        (handleAnything as jest.Mock).mockResolvedValue(['PaymentRequest', {}]);

        const navigate = await pressSubscribe(createOrder);

        expect(handleAnything).toHaveBeenCalledWith('lnbc1000n1...');
        expect(navigate).toHaveBeenCalledWith('PaymentRequest', {});
        expect(alert).not.toHaveBeenCalled();
    });

    it.each([undefined, false])(
        'does nothing when handleAnything resolves %s',
        async (result) => {
            const createOrder = jest
                .fn()
                .mockResolvedValue({ bolt11: 'lnbc1000n1...' });
            (handleAnything as jest.Mock).mockResolvedValue(result);

            const navigate = await pressSubscribe(createOrder);

            expect(handleAnything).toHaveBeenCalledWith('lnbc1000n1...');
            expect(navigate).not.toHaveBeenCalled();
            expect(alert).not.toHaveBeenCalled();
            expect(consoleLog).not.toHaveBeenCalled();
        }
    );

    it('shows an alert when handleAnything rejects', async () => {
        const createOrder = jest
            .fn()
            .mockResolvedValue({ bolt11: 'bad-bolt11' });
        (handleAnything as jest.Mock).mockRejectedValue(
            new Error('Not a valid Lightning payment request')
        );

        const navigate = await pressSubscribe(createOrder);

        expect(handleAnything).toHaveBeenCalledWith('bad-bolt11');
        expect(navigate).not.toHaveBeenCalled();
        expect(alert).toHaveBeenCalledWith(
            'general.error',
            'Not a valid Lightning payment request',
            expect.any(Array),
            { cancelable: false }
        );
    });

    it('does not alert or invoke handleAnything when createZeusPayPlusOrder rejects', async () => {
        const createOrder = jest
            .fn()
            .mockRejectedValue(new Error('Order request failed'));

        const navigate = await pressSubscribe(createOrder);

        expect(handleAnything).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
        expect(alert).not.toHaveBeenCalled();
        expect(consoleLog).toHaveBeenCalledWith(
            'Error creating ZEUS Pay+ order',
            expect.any(Error)
        );
    });

    it('does not invoke handleAnything when order resolves without bolt11', async () => {
        const createOrder = jest.fn().mockResolvedValue({});

        const navigate = await pressSubscribe(createOrder);

        expect(handleAnything).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
        expect(alert).not.toHaveBeenCalled();
    });

    it('does nothing when the order resolves null', async () => {
        const createOrder = jest.fn().mockResolvedValue(null);

        const navigate = await pressSubscribe(createOrder);

        expect(handleAnything).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
        expect(alert).not.toHaveBeenCalled();
        expect(consoleLog).not.toHaveBeenCalled();
    });
});
