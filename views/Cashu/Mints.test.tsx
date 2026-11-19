jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => {
    const { Text, TouchableOpacity, View } = require('react-native');
    const ListItem: any = ({ children, onPress }: any) => (
        <TouchableOpacity onPress={onPress}>{children}</TouchableOpacity>
    );
    ListItem.Content = View;
    ListItem.Title = Text;
    ListItem.Subtitle = Text;
    return { Button: 'Button', Icon: 'Icon', ListItem };
});
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/Header', () => {
    const { Text } = require('react-native');
    return ({ centerComponent, onBack }: any) => (
        <Text testID="header" onPress={onBack}>
            {centerComponent.text}
        </Text>
    );
});
jest.mock('../../components/MintAvatar', () => 'MintAvatar');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return View;
});
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../assets/images/SVG/Add.svg', () => 'Add');
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../utils/LightningAddressMintUtils', () => ({
    ...jest.requireActual('../../utils/LightningAddressMintUtils'),
    offerLightningAddressMintSwitch: jest.fn()
}));
jest.mock('../../stores/CashuStore', () => ({}));
jest.mock('../../stores/LightningAddressStore', () => ({}));
jest.mock('../../stores/SettingsStore', () => ({}));

import * as React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import Mints from './Mints';
import { offerLightningAddressMintSwitch } from '../../utils/LightningAddressMintUtils';

const WALLET_MINT = 'https://wallet.mint.test';
const ADDRESS_MINT = 'https://address.mint.test';

const flush = () => new Promise((resolve) => setImmediate(resolve));

const renderMints = async (
    params: any = {},
    setMintUrl = jest.fn().mockResolvedValue({ success: true }),
    cashuOverrides: any = {},
    addressOverrides: any = {}
) => {
    let onFocus: () => Promise<void> = async () => {};
    const navigation = {
        addListener: jest.fn((_event: string, cb: any) => {
            onFocus = cb;
            return jest.fn();
        }),
        goBack: jest.fn(),
        navigate: jest.fn()
    };
    const CashuStore = {
        cashuWallets: {},
        mintUrls: [WALLET_MINT, ADDRESS_MINT],
        mintInfos: {
            [WALLET_MINT]: { name: 'Wallet Mint' },
            [ADDRESS_MINT]: { name: 'Address Mint' }
        },
        mintBalances: {},
        selectedMintUrl: WALLET_MINT,
        multiMintSelectedUrls: [],
        randomizeMintSelection: false,
        clearInvoice: jest.fn(),
        setSelectedMint: jest.fn().mockResolvedValue(undefined),
        setMultiMintSelectedUrls: jest.fn(),
        setReceiveMint: jest.fn(),
        toggleMultiMintSelection: jest.fn(),
        setRandomizeMintSelection: jest.fn(),
        ...cashuOverrides
    };
    const LightningAddressStore = {
        lightningAddress: 'hal@zeuspay.com',
        lightningAddressType: 'cashu',
        error_msg: '',
        setMintUrl,
        ...addressOverrides
    };
    const SettingsStore = {
        settings: { lightningAddress: { mintUrl: ADDRESS_MINT } }
    };

    await render(
        <Mints
            {...({
                navigation,
                route: { params },
                CashuStore,
                LightningAddressStore,
                SettingsStore
            } as any)}
        />
    );
    await act(() => onFocus());

    return { navigation, CashuStore, LightningAddressStore, SettingsStore };
};

describe('Mints', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('wallet mint (default)', () => {
        it('marks the wallet mint as selected and tags the address mint', async () => {
            await renderMints();

            expect(
                screen.getByText(`general.selected | ${WALLET_MINT}`)
            ).toBeTruthy();
            expect(
                screen.getByText(`general.lightningAddress | ${ADDRESS_MINT}`)
            ).toBeTruthy();
        });

        it('tags a mint that is both selected and the address mint', async () => {
            await renderMints({}, undefined, { selectedMintUrl: ADDRESS_MINT });

            expect(
                screen.getByText(
                    `general.lightningAddress | general.selected | ${ADDRESS_MINT}`
                )
            ).toBeTruthy();
        });

        it('does not tag any mint for an NWC address', async () => {
            await renderMints(
                {},
                undefined,
                {},
                { lightningAddressType: 'nwc' }
            );

            expect(screen.getByText(ADDRESS_MINT)).toBeTruthy();
            expect(screen.queryByText(/general\.lightningAddress/)).toBeNull();
        });

        it('selects the mint and offers to move the Lightning address', async () => {
            const { navigation, CashuStore, LightningAddressStore } =
                await renderMints();

            await fireEvent.press(screen.getByText('Address Mint'));
            await act(flush);

            expect(CashuStore.setSelectedMint).toHaveBeenCalledWith(
                ADDRESS_MINT
            );
            expect(offerLightningAddressMintSwitch).toHaveBeenCalledWith({
                lightningAddressStore: LightningAddressStore,
                settingsStore: expect.anything(),
                cashuStore: CashuStore,
                newMintUrl: ADDRESS_MINT
            });
            expect(LightningAddressStore.setMintUrl).not.toHaveBeenCalled();
            expect(navigation.goBack).toHaveBeenCalled();
        });

        it('clears the open invoice on back', async () => {
            const { CashuStore } = await renderMints();

            await fireEvent.press(screen.getByTestId('header'));

            expect(CashuStore.clearInvoice).toHaveBeenCalled();
        });
    });

    describe('Lightning address mint', () => {
        const params = { lightningAddressMint: true, disableRandom: true };

        it('titles the list and marks the address mint as selected', async () => {
            await renderMints(params);

            expect(screen.getByTestId('header')).toHaveTextContent(
                'views.Cashu.LightningAddress.receivingMint'
            );
            expect(
                screen.getByText(`general.selected | ${ADDRESS_MINT}`)
            ).toBeTruthy();
            expect(screen.getByText(WALLET_MINT)).toBeTruthy();
        });

        it('moves the address without touching the wallet mint', async () => {
            const { navigation, CashuStore, LightningAddressStore } =
                await renderMints(params);

            await fireEvent.press(screen.getByText('Wallet Mint'));
            await act(flush);

            expect(LightningAddressStore.setMintUrl).toHaveBeenCalledWith(
                WALLET_MINT
            );
            expect(CashuStore.setSelectedMint).not.toHaveBeenCalled();
            expect(offerLightningAddressMintSwitch).not.toHaveBeenCalled();
            expect(navigation.goBack).toHaveBeenCalled();
        });

        it('goes back without a request when the mint is already in use', async () => {
            const { navigation, CashuStore, LightningAddressStore } =
                await renderMints(params);

            await fireEvent.press(screen.getByText('Address Mint'));
            await act(flush);

            expect(LightningAddressStore.setMintUrl).not.toHaveBeenCalled();
            expect(CashuStore.setSelectedMint).not.toHaveBeenCalled();
            expect(navigation.goBack).toHaveBeenCalled();
        });

        it('stays on the list and shows the error when ZEUS Pay rejects', async () => {
            const alertSpy = jest
                .spyOn(Alert, 'alert')
                .mockImplementation(() => {});
            const setMintUrl = jest.fn(async () => {
                LightningAddressStore.error_msg = 'mint not supported';
                throw 'mint not supported';
            });
            const { navigation, LightningAddressStore } = await renderMints(
                params,
                setMintUrl
            );

            await fireEvent.press(screen.getByText('Wallet Mint'));
            await act(flush);

            expect(alertSpy).toHaveBeenCalledWith(
                'general.error',
                'mint not supported'
            );
            expect(navigation.goBack).not.toHaveBeenCalled();
            alertSpy.mockRestore();
        });

        it('ignores taps while a change is on its way to ZEUS Pay', async () => {
            const { navigation, LightningAddressStore } = await renderMints(
                params
            );
            (LightningAddressStore as any).loading = true;

            await fireEvent.press(screen.getByText('Wallet Mint'));
            await act(flush);

            expect(LightningAddressStore.setMintUrl).not.toHaveBeenCalled();
            expect(navigation.goBack).not.toHaveBeenCalled();
        });

        it('keeps the open invoice on back', async () => {
            const { CashuStore } = await renderMints(params);

            await fireEvent.press(screen.getByTestId('header'));

            expect(CashuStore.clearInvoice).not.toHaveBeenCalled();
        });
    });
});
