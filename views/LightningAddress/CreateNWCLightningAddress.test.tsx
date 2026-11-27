jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../components/TextInput', () => 'TextInput');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage',
    SuccessMessage: 'SuccessMessage'
}));
jest.mock('../../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../../assets/images/SVG/zeus-pay.svg', () => 'ZeusPayIcon');
jest.mock('../../stores/LightningAddressStore', () => ({}));
jest.mock('../../stores/SettingsStore', () => ({}));

import * as React from 'react';
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor
} from '@testing-library/react-native';
import CreateNWCLightningAddress from './CreateNWCLightningAddress';

const NWC_URL =
    'nostr+walletconnect://b889ff5b1513b641e2a139f661a661364979c5beee91842f8f0ef42ab558e9d4?relay=wss://relay.example.com&secret=71a8c14c1407c113601079c4302dab36460f0ccd0ad506f1f2dc73b5100e4f3c';

const TEST = 'views.Settings.LightningAddress.testConnectionString';
const CREATE = 'views.Settings.LightningAddress.create';
const SWITCH = 'views.Settings.LightningAddress.switchToNWC';
const UPDATE = 'views.Settings.LightningAddress.changeConnectionString';

const flush = () => new Promise((resolve) => setImmediate(resolve));

const renderCreate = async (params: any = {}) => {
    const navigation = {
        navigate: jest.fn(),
        // returns the unsubscribe function, as the navigator does
        addListener: jest.fn(() => jest.fn()),
        popTo: jest.fn(),
        goBack: jest.fn(),
        // false once the route is removed or another screen is on top
        isFocused: jest.fn(() => true)
    };
    const LightningAddressStore = {
        createNWC: jest.fn(() => Promise.resolve({ success: true })),
        update: jest.fn(() => Promise.resolve({ success: true })),
        testNWCConnectionString: jest.fn(() =>
            Promise.resolve({ success: true })
        ),
        loading: false,
        error_msg: ''
    };
    const result = await render(
        <CreateNWCLightningAddress
            {...({
                navigation,
                route: { params },
                LightningAddressStore,
                SettingsStore: {}
            } as any)}
        />
    );
    return { navigation, LightningAddressStore, unmount: result.unmount };
};

const findButton = (title: string) =>
    screen.root!.queryAll((node: any) => node.props.title === title)[0];

const pressButton = async (title: string) => {
    await fireEvent.press(findButton(title));
};

const spinners = () =>
    screen.root!.queryAll((node: any) => node.type === 'LoadingIndicator');

// enters the connection string and passes the server test, so the next
// press saves
const enterAndTest = async () => {
    const input = screen.root!.queryAll(
        (node: any) => node.type === 'TextInput'
    )[0];
    await act(async () => input.props.onChangeText(NWC_URL));
    await pressButton(TEST);
    await act(flush);
};

// the switch and update handler awaits update(), so start it without
// waiting
const startSave = async (title: string) => {
    await act(async () => {
        findButton(title).props.onPress();
    });
};

const focusHandler = (navigation: any) =>
    (navigation.addListener.mock.calls[0] as any[])[1];

describe('CreateNWCLightningAddress after a successful save', () => {
    it('returns to the ZEUS Pay screen after a create', async () => {
        const { navigation, LightningAddressStore } = await renderCreate();
        await enterAndTest();

        await pressButton(CREATE);

        await waitFor(() =>
            expect(navigation.popTo).toHaveBeenCalledWith('LightningAddress')
        );
        expect(LightningAddressStore.createNWC).toHaveBeenCalledWith(NWC_URL);
    });

    it.each([
        ['a switch', { switchTo: true }, SWITCH],
        ['a connection update', { updateConnection: true }, UPDATE]
    ])(
        'returns to the ZEUS Pay screen after %s',
        async (_name: string, params: any, button: string) => {
            const { navigation, LightningAddressStore } = await renderCreate(
                params
            );
            await enterAndTest();

            await pressButton(button);

            await waitFor(() =>
                expect(navigation.popTo).toHaveBeenCalledWith(
                    'LightningAddress'
                )
            );
            expect(LightningAddressStore.update).toHaveBeenCalledWith({
                nwc_string: NWC_URL,
                address_type: 'nwc'
            });
        }
    );

    it('does not leave when the Lockscreen covers it during a create', async () => {
        const { navigation, LightningAddressStore } = await renderCreate();
        await enterAndTest();
        let resolveCreate: (value: any) => void = () => {};
        LightningAddressStore.createNWC.mockImplementation(
            () => new Promise((resolve) => (resolveCreate = resolve))
        );

        await pressButton(CREATE);
        navigation.isFocused.mockReturnValue(false);
        resolveCreate({ success: true });
        await act(flush);

        expect(navigation.popTo).not.toHaveBeenCalled();
    });

    it('stops the spinner after a switch when the Lockscreen covers it', async () => {
        const { navigation, LightningAddressStore } = await renderCreate({
            switchTo: true
        });
        await enterAndTest();
        let resolveUpdate: (value: any) => void = () => {};
        LightningAddressStore.update.mockImplementation(
            () => new Promise((resolve) => (resolveUpdate = resolve))
        );

        await startSave(SWITCH);
        expect(spinners()).toHaveLength(1);
        navigation.isFocused.mockReturnValue(false);
        await act(async () => {
            resolveUpdate({ success: true });
            await flush();
        });

        expect(navigation.popTo).not.toHaveBeenCalled();
        expect(spinners()).toHaveLength(0);
    });
});

describe('CreateNWCLightningAddress after a save while covered', () => {
    it('returns to the ZEUS Pay screen once on the next focus after a create', async () => {
        const { navigation, LightningAddressStore } = await renderCreate();
        const handleFocus = focusHandler(navigation);
        // the screen opening
        await act(async () => handleFocus());
        await enterAndTest();
        let resolveCreate: (value: any) => void = () => {};
        LightningAddressStore.createNWC.mockImplementation(
            () => new Promise((resolve) => (resolveCreate = resolve))
        );

        await pressButton(CREATE);
        navigation.isFocused.mockReturnValue(false);
        resolveCreate({ success: true });
        await act(flush);
        expect(navigation.popTo).not.toHaveBeenCalled();

        // the Lockscreen is unlocked and the screen is on top again
        navigation.isFocused.mockReturnValue(true);
        await act(async () => handleFocus());
        expect(navigation.popTo).toHaveBeenCalledTimes(1);
        expect(navigation.popTo).toHaveBeenCalledWith('LightningAddress');

        // a later focus does not leave again
        await act(async () => handleFocus());
        expect(navigation.popTo).toHaveBeenCalledTimes(1);
    });

    it('waits for a later focus when the focus event arrives while covered', async () => {
        const { navigation, LightningAddressStore } = await renderCreate();
        const handleFocus = focusHandler(navigation);
        await act(async () => handleFocus());
        await enterAndTest();
        let resolveCreate: (value: any) => void = () => {};
        LightningAddressStore.createNWC.mockImplementation(
            () => new Promise((resolve) => (resolveCreate = resolve))
        );

        await pressButton(CREATE);
        navigation.isFocused.mockReturnValue(false);
        resolveCreate({ success: true });
        await act(flush);

        // the focus event is delivered after another screen was pushed
        await act(async () => handleFocus());
        expect(navigation.popTo).not.toHaveBeenCalled();

        navigation.isFocused.mockReturnValue(true);
        await act(async () => handleFocus());
        expect(navigation.popTo).toHaveBeenCalledTimes(1);
    });

    it('returns to the ZEUS Pay screen on the next focus after a switch', async () => {
        const { navigation, LightningAddressStore } = await renderCreate({
            switchTo: true
        });
        const handleFocus = focusHandler(navigation);
        await act(async () => handleFocus());
        await enterAndTest();
        let resolveUpdate: (value: any) => void = () => {};
        LightningAddressStore.update.mockImplementation(
            () => new Promise((resolve) => (resolveUpdate = resolve))
        );

        await startSave(SWITCH);
        navigation.isFocused.mockReturnValue(false);
        await act(async () => {
            resolveUpdate({ success: true });
            await flush();
        });
        expect(navigation.popTo).not.toHaveBeenCalled();

        navigation.isFocused.mockReturnValue(true);
        await act(async () => handleFocus());
        expect(navigation.popTo).toHaveBeenCalledTimes(1);
        expect(navigation.popTo).toHaveBeenCalledWith('LightningAddress');
    });

    it.each([
        ['create', {}, CREATE, 'createNWC' as const],
        ['switch', { switchTo: true }, SWITCH, 'update' as const]
    ])(
        'does not leave on the next focus after a failed %s',
        async (
            _name: string,
            params: any,
            button: string,
            call: 'createNWC' | 'update'
        ) => {
            const { navigation, LightningAddressStore } = await renderCreate(
                params
            );
            const handleFocus = focusHandler(navigation);
            await act(async () => handleFocus());
            await enterAndTest();
            LightningAddressStore[call].mockImplementation(() =>
                Promise.resolve({ success: false })
            );

            navigation.isFocused.mockReturnValue(false);
            await startSave(button);
            await act(flush);
            navigation.isFocused.mockReturnValue(true);
            await act(async () => handleFocus());

            expect(navigation.popTo).not.toHaveBeenCalled();
        }
    );
});

describe('CreateNWCLightningAddress focus listener', () => {
    it('is removed on unmount', async () => {
        const { navigation, unmount } = await renderCreate();
        const unsubscribe = (navigation.addListener.mock.results[0] as any)
            .value;

        expect(navigation.addListener).toHaveBeenCalledWith(
            'focus',
            expect.any(Function)
        );
        await act(async () => unmount());
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
});
