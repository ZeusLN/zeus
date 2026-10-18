jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('react-native-gesture-handler', () => {
    const { TouchableOpacity } = require('react-native');
    return { TouchableOpacity };
});
jest.mock('../../utils/AddressUtils', () => {
    const bitcoin = require('bitcoinjs-lib');
    return {
        bitcoinNetworkForNode: () => bitcoin.networks.regtest,
        isValidBitcoinAddressForNode: () => true
    };
});
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../assets/images/SVG/Scan.svg', () => 'Scan');
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/OnchainFeeInput', () => 'OnchainFeeInput');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/ShowHideToggle', () => 'ShowHideToggle');
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../../components/TextInput', () => 'TextInput');

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import WIFSweeper from './WIFSweeper';

// The same key encoded for mainnet and for the test networks
const MAINNET_WIF = 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn';
const REGTEST_WIF = 'cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA';

const renderView = () =>
    render(
        <WIFSweeper
            {...({
                navigation: { navigate: jest.fn() },
                route: { params: {} },
                InvoicesStore: { reset: jest.fn() },
                SweepStore: {
                    destination: '',
                    resetSweepError: jest.fn()
                }
            } as any)}
        />
    );

const hosts = (type: string) =>
    screen.container.queryAll((n) => n.type === type);

const typeKey = (text: string) =>
    fireEvent.changeText(hosts('TextInput')[0], text);

const generateButton = () =>
    hosts('Button').find(
        (n) => n.props.title === 'views.Swaps.generateOnchainAddress'
    )!;

describe('WIFSweeper key field', () => {
    it('explains why a key for another network is refused', async () => {
        await renderView();
        await typeKey(MAINNET_WIF);

        expect(screen.getByText('views.Wif.wrongNetwork')).toBeTruthy();
        expect(generateButton().props.disabled).toBe(true);
    });

    it('shows no error for a key on the node network', async () => {
        await renderView();
        await typeKey(REGTEST_WIF);

        expect(
            screen.queryByText(/^views\.Wif\.(invalid|wrongNetwork)/)
        ).toBeNull();
        expect(generateButton().props.disabled).toBe(false);
    });

    it('clears the error when the field is emptied', async () => {
        await renderView();
        await typeKey(MAINNET_WIF);
        await typeKey('');

        expect(screen.queryByText('views.Wif.wrongNetwork')).toBeNull();
    });
});
