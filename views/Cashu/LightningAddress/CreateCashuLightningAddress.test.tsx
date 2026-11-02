jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));
jest.mock('../../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../../components/Button', () => 'Button');
jest.mock('../../../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../../../components/Screen', () => 'Screen');
jest.mock('../../../components/Header', () => 'Header');
jest.mock('../../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../../../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../../../assets/images/SVG/zeus-pay.svg', () => 'ZeusPayIcon');
jest.mock('../../../stores/CashuStore', () => ({}));
jest.mock('../../../stores/LightningAddressStore', () => ({}));
jest.mock('../../../stores/SettingsStore', () => ({}));

import * as React from 'react';
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor
} from '@testing-library/react-native';
import CreateCashuLightningAddress from './CreateCashuLightningAddress';

const MINT_URL = 'https://mint.example.com';

const flush = () => new Promise((resolve) => setImmediate(resolve));

// routes: the stack below this screen, by route name
const renderCreate = async (
    routes: string[],
    params: any = {},
    mintUrls: string[] = [MINT_URL]
) => {
    const navigation = {
        navigate: jest.fn(),
        addListener: jest.fn(),
        getState: () => ({
            routes: [...routes, 'CreateCashuLightningAddress'].map((name) => ({
                name
            }))
        }),
        popTo: jest.fn(),
        goBack: jest.fn(),
        // false once the route is removed or another screen is on top
        isFocused: jest.fn(() => true)
    };
    const LightningAddressStore = {
        createCashu: jest.fn(() => Promise.resolve({ success: true })),
        update: jest.fn(() => Promise.resolve({ success: true })),
        loading: false,
        error_msg: ''
    };
    const SettingsStore = {
        updateSettingsGroup: jest.fn(() => Promise.resolve())
    };
    await render(
        <CreateCashuLightningAddress
            {...({
                navigation,
                route: { params },
                CashuStore: {
                    selectedMintUrl: MINT_URL,
                    mintUrls,
                    mintInfos: { [MINT_URL]: { name: 'Example Mint' } },
                    cashuWallets: { [MINT_URL]: { pubkey: 'pubkey' } }
                },
                LightningAddressStore,
                SettingsStore
            } as any)}
        />
    );
    return { navigation, LightningAddressStore, SettingsStore };
};

const findButton = (title: string) =>
    screen.root!.queryAll((node: any) => node.props.title === title)[0];

const pressButton = async (title: string) => {
    await fireEvent.press(findButton(title));
};

const mintPickers = () =>
    screen.root!.queryAll((node: any) => node.type === 'DropdownSetting');

describe('CreateCashuLightningAddress after a successful save', () => {
    it('goes back to Receive when opened from ReceiveEcash', async () => {
        const { navigation, LightningAddressStore } = await renderCreate([
            'Wallet',
            'ReceiveEcash'
        ]);

        await pressButton('views.Settings.LightningAddress.create');

        await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
        expect(LightningAddressStore.createCashu).toHaveBeenCalledWith(
            MINT_URL
        );
        expect(navigation.popTo).not.toHaveBeenCalled();
    });

    it('returns to the ZEUS Pay screen when opened from it', async () => {
        const { navigation } = await renderCreate([
            'Wallet',
            'LightningAddress'
        ]);

        await pressButton('views.Settings.LightningAddress.create');

        await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
        expect(navigation.popTo).not.toHaveBeenCalled();
    });

    it('returns to the ZEUS Pay screen after a switch from its settings', async () => {
        const { navigation, LightningAddressStore } = await renderCreate(
            ['Wallet', 'LightningAddress', 'LightningAddressSettings'],
            { switchTo: true }
        );

        await pressButton('views.Settings.LightningAddress.switchToCashu');

        await waitFor(() =>
            expect(navigation.popTo).toHaveBeenCalledWith('LightningAddress')
        );
        expect(LightningAddressStore.update).toHaveBeenCalled();
        expect(navigation.goBack).not.toHaveBeenCalled();
    });

    it('stays on the screen when the create fails', async () => {
        const { navigation, LightningAddressStore } = await renderCreate([
            'Wallet',
            'ReceiveEcash'
        ]);
        LightningAddressStore.createCashu.mockImplementation(() =>
            Promise.resolve({ success: false })
        );

        await pressButton('views.Settings.LightningAddress.create');

        await waitFor(() =>
            expect(LightningAddressStore.createCashu).toHaveBeenCalled()
        );
        // let the createCashu().then() run before checking
        await flush();
        expect(navigation.goBack).not.toHaveBeenCalled();
        expect(navigation.popTo).not.toHaveBeenCalled();
    });

    it('does not go back when the user left during the create', async () => {
        const { navigation, LightningAddressStore } = await renderCreate([
            'Wallet',
            'ReceiveEcash'
        ]);
        let resolveCreate: (value: any) => void = () => {};
        LightningAddressStore.createCashu.mockImplementation(
            () => new Promise((resolve) => (resolveCreate = resolve))
        );

        await pressButton('views.Settings.LightningAddress.create');
        await screen.unmount();
        navigation.isFocused.mockReturnValue(false);
        resolveCreate({ success: true });
        await flush();

        expect(navigation.goBack).not.toHaveBeenCalled();
        expect(navigation.popTo).not.toHaveBeenCalled();
    });

    it('does not go back when the Lockscreen covers it', async () => {
        const { navigation, LightningAddressStore } = await renderCreate([
            'Wallet',
            'ReceiveEcash'
        ]);
        let resolveCreate: (value: any) => void = () => {};
        LightningAddressStore.createCashu.mockImplementation(
            () => new Promise((resolve) => (resolveCreate = resolve))
        );

        await pressButton('views.Settings.LightningAddress.create');
        navigation.isFocused.mockReturnValue(false);
        resolveCreate({ success: true });
        await flush();

        expect(navigation.goBack).not.toHaveBeenCalled();
        expect(navigation.popTo).not.toHaveBeenCalled();
    });

    it('stays on the screen after a switch when the Lockscreen covers it', async () => {
        const { navigation, LightningAddressStore, SettingsStore } =
            await renderCreate(
                ['Wallet', 'LightningAddress', 'LightningAddressSettings'],
                { switchTo: true }
            );
        let resolveUpdate: (value: any) => void = () => {};
        LightningAddressStore.update.mockImplementation(
            () => new Promise((resolve) => (resolveUpdate = resolve))
        );

        // the switch handler awaits update(), so start it without waiting
        await act(async () => {
            findButton(
                'views.Settings.LightningAddress.switchToCashu'
            ).props.onPress();
        });
        expect(
            findButton('views.Settings.LightningAddress.switchToCashu')
        ).toBeUndefined();
        navigation.isFocused.mockReturnValue(false);
        await act(async () => {
            resolveUpdate({ success: true });
            await flush();
        });

        expect(SettingsStore.updateSettingsGroup).toHaveBeenCalled();
        expect(navigation.popTo).not.toHaveBeenCalled();
        expect(navigation.goBack).not.toHaveBeenCalled();
        // no spinner left on the screen after the unlock
        expect(
            findButton('views.Settings.LightningAddress.switchToCashu')
        ).toBeDefined();
    });
});

describe('CreateCashuLightningAddress mints', () => {
    it('links to the Mints screen and disables create without mints', async () => {
        const { navigation } = await renderCreate(
            ['Wallet', 'ReceiveEcash'],
            {},
            []
        );

        expect(mintPickers()).toHaveLength(0);
        // fireEvent.press does not check disabled, so read the prop
        expect(
            findButton('views.Settings.LightningAddress.create').props.disabled
        ).toBe(true);

        await pressButton('cashu.tapToConfigure');
        expect(navigation.navigate).toHaveBeenCalledWith('Mints');
    });

    it('shows the mint picker and enables create with a mint', async () => {
        await renderCreate(['Wallet', 'ReceiveEcash']);

        expect(mintPickers()).toHaveLength(1);
        expect(findButton('cashu.tapToConfigure')).toBeUndefined();
        expect(
            findButton('views.Settings.LightningAddress.create').props.disabled
        ).toBe(false);
    });
});
