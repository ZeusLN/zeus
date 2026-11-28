jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('./EcashMintPicker', () => 'EcashMintPicker');
jest.mock('./Text', () => {
    const { Text } = require('react-native');
    return Text;
});
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../stores/LightningAddressStore', () => ({}));
jest.mock('../stores/SettingsStore', () => ({}));

import * as React from 'react';
import { render, screen } from '@testing-library/react-native';

import LightningAddressMintPicker from './LightningAddressMintPicker';

const ADDRESS_MINT = 'https://address.mint.test';

const renderPicker = async ({
    lightningAddressType = 'cashu',
    mintUrl = ADDRESS_MINT
}: { lightningAddressType?: string; mintUrl?: string } = {}) => {
    const navigation = { navigate: jest.fn() };
    await render(
        <LightningAddressMintPicker
            {...({
                navigation,
                LightningAddressStore: {
                    lightningAddress: 'hal@zeuspay.com',
                    lightningAddressType
                },
                SettingsStore: {
                    settings: { lightningAddress: { mintUrl } }
                }
            } as any)}
        />
    );
    return navigation;
};

const pickers = () =>
    screen.root
        ? screen.root.queryAll((node: any) => node.type === 'EcashMintPicker')
        : [];

describe('LightningAddressMintPicker', () => {
    it('shows the address mint, not the wallet mint', async () => {
        await renderPicker();

        expect(
            screen.getByText('views.Cashu.LightningAddress.receivingMint')
        ).toBeTruthy();
        expect(pickers()).toHaveLength(1);
        expect(pickers()[0].props.overrideMintUrl).toBe(ADDRESS_MINT);
        expect(pickers()[0].props.disableRandom).toBe(true);
    });

    it('opens the Mints list in Lightning address mode', async () => {
        const navigation = await renderPicker();

        pickers()[0].props.onPress();

        expect(navigation.navigate).toHaveBeenCalledWith('Mints', {
            lightningAddressMint: true,
            disableRandom: true
        });
    });

    it('renders nothing for an NWC address', async () => {
        await renderPicker({ lightningAddressType: 'nwc' });

        expect(pickers()).toHaveLength(0);
        expect(
            screen.queryByText('views.Cashu.LightningAddress.receivingMint')
        ).toBeNull();
    });

    it('renders nothing when the address mint is unknown', async () => {
        await renderPicker({ mintUrl: '' });

        expect(pickers()).toHaveLength(0);
    });
});
