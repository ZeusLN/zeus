// Runs the notice under a real NavigationContainer and a MobX observable to
// check the assumption PaymentInFlightNotice relies on: when a pay screen
// sets the in-flight guard and navigates away in the same handler, the
// store update and the focus change render together, so the notice never
// renders on the departing screen.

// mobx-react's CommonJS build requires react-dom; for function components
// its observer is mobx-react-lite's
jest.mock('mobx-react', () => ({
    observer: jest.requireActual('mobx-react-lite').observer
}));
// counts every render of the notice text, including ones that a later
// render in the same act() would hide
const mockLocaleString = jest.fn((key: string) => key);
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => mockLocaleString(key)
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../stores/TransactionsStore', () => ({}));
jest.mock('./Button', () => () => null);

import * as React from 'react';
import { Pressable, Text, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { action, observable } from 'mobx';
import {
    createNavigatorFactory,
    NavigationContainer,
    StackRouter,
    useNavigation,
    useNavigationBuilder
} from '@react-navigation/native';

import PaymentInFlightNotice from './PaymentInFlightNotice';

const CHECKING = 'components.PaymentInFlightNotice.checking';

const checkingRenders = () =>
    mockLocaleString.mock.calls.filter(([key]) => key === CHECKING).length;

// Keeps every route in the stack mounted, as a native stack keeps the
// previous screen mounted while it animates out
function KeepMountedStack({ initialRouteName, children }: any) {
    const { state, descriptors, NavigationContent } = useNavigationBuilder(
        StackRouter,
        { initialRouteName, children }
    );
    return (
        <NavigationContent>
            {state.routes.map((route) => (
                <View key={route.key}>{descriptors[route.key].render()}</View>
            ))}
        </NavigationContent>
    );
}
const createKeepMountedStack = createNavigatorFactory(KeepMountedStack);

describe('PaymentInFlightNotice with real navigation', () => {
    it('does not render on the screen that dispatched the payment, and renders when the user returns', async () => {
        const store: any = observable({
            paymentInFlight: false,
            paymentInFlightConfirmed: false
        });
        // stands in for TransactionsStore.sendPayment setting the guard
        const sendPayment = action(() => {
            store.paymentInFlight = true;
        });

        function PaymentRequest() {
            const navigation: any = useNavigation();
            return (
                <View>
                    <PaymentInFlightNotice TransactionsStore={store} />
                    <Pressable
                        onPress={() => {
                            sendPayment();
                            navigation.navigate('SendingLightning');
                        }}
                    >
                        <Text>pay</Text>
                    </Pressable>
                </View>
            );
        }
        function SendingLightning() {
            const navigation: any = useNavigation();
            return (
                <Pressable onPress={() => navigation.goBack()}>
                    <Text>back</Text>
                </Pressable>
            );
        }

        const Stack = createKeepMountedStack();
        await render(
            <NavigationContainer>
                <Stack.Navigator initialRouteName="PaymentRequest">
                    <Stack.Screen
                        name="PaymentRequest"
                        component={PaymentRequest}
                    />
                    <Stack.Screen
                        name="SendingLightning"
                        component={SendingLightning}
                    />
                </Stack.Navigator>
            </NavigationContainer>
        );

        await fireEvent.press(screen.getByText('pay'));
        expect(screen.getByText('back')).toBeTruthy();
        expect(store.paymentInFlight).toBe(true);
        expect(checkingRenders()).toBe(0);

        // the payment is still tracked when the user goes back
        await fireEvent.press(screen.getByText('back'));
        expect(screen.queryByText('back')).toBeNull();
        expect(screen.getByText(CHECKING)).toBeTruthy();
    });
});
