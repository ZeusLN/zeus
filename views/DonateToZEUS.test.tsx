import * as React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

// mobx-react's main entry needs react-dom; the store arrives as a prop here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../components/Header', () => () => null);
jest.mock('../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../components/TextInput', () => () => null);
jest.mock('../components/CopyButton', () => () => null);
jest.mock('../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress }: any) => (
        <Pressable role="button" onPress={onPress}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../stores/InvoicesStore', () => ({}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => key
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/handleAnything', () => jest.fn());

import DonateToZEUS from './DonateToZEUS';
import handleAnything from '../utils/handleAnything';

const DONATE = 'views.PaymentRequest.donate';
const ADDRESS = 'tips@pay.zeusln.app';

// the view declares its state type as null, which JSX does not accept
const DonateView = DonateToZEUS as unknown as React.ComponentType<any>;

describe('DonateToZEUS Donate button', () => {
    let alert: jest.SpyInstance;

    beforeEach(() => {
        alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
        alert.mockRestore();
        (handleAnything as jest.Mock).mockReset();
    });

    // presses Donate and waits for handleAnything's result to be used
    const donate = async () => {
        const navigation = { navigate: jest.fn() };
        await render(<DonateView navigation={navigation} InvoicesStore={{}} />);

        await fireEvent.press(screen.getByText(DONATE));
        await act(() => new Promise((resolve) => setImmediate(resolve)));

        expect(handleAnything).toHaveBeenCalledWith(ADDRESS);
        return navigation.navigate;
    };

    it('opens the route for the address', async () => {
        (handleAnything as jest.Mock).mockResolvedValue([
            'LnurlPay',
            { lnurlParams: {} }
        ]);

        const navigate = await donate();

        expect(navigate).toHaveBeenCalledWith('LnurlPay', { lnurlParams: {} });
        expect(alert).not.toHaveBeenCalled();
    });

    // handleAnything has alerted already, or the user declined
    it.each([undefined, false])(
        'does nothing more when the address cannot be routed (%s)',
        async (result) => {
            (handleAnything as jest.Mock).mockResolvedValue(result);

            const navigate = await donate();

            expect(navigate).not.toHaveBeenCalled();
            expect(alert).not.toHaveBeenCalled();
        }
    );

    it('shows the error when the lookup fails', async () => {
        (handleAnything as jest.Mock).mockRejectedValue(
            new Error('Error fetching address')
        );

        const navigate = await donate();

        expect(navigate).not.toHaveBeenCalled();
        expect(alert).toHaveBeenCalledWith(
            'general.error',
            'Error fetching address',
            expect.any(Array),
            { cancelable: false }
        );
    });
});
