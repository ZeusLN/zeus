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
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import WIFSweeper from './WIFSweeper';

// The same key encoded for mainnet and for the test networks
const MAINNET_WIF = 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn';
const REGTEST_WIF = 'cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA';

// Fills in the defaults on the given store mocks rather than copying them,
// so the test and the view share the objects the handlers mutate
const renderView = ({
    SweepStore = {},
    InvoicesStore = {}
}: { SweepStore?: any; InvoicesStore?: any } = {}) =>
    render(
        <WIFSweeper
            {...({
                navigation: { navigate: jest.fn() },
                route: { params: {} },
                InvoicesStore: Object.assign(InvoicesStore, {
                    reset: jest.fn()
                }),
                SweepStore: Object.assign(SweepStore, {
                    destination: '',
                    resetSweepError: jest.fn()
                })
            } as any)}
        />
    );

const deferred = () => {
    let resolve!: () => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

// Lets pending promise callbacks and the state updates they make run
const flush = () =>
    act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });

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

    it('clears the error when an invalid key is corrected', async () => {
        await renderView();
        await typeKey(MAINNET_WIF);
        await typeKey(REGTEST_WIF);

        expect(
            screen.queryByText(/^views\.Wif\.(invalid|wrongNetwork)/)
        ).toBeNull();
        expect(generateButton().props.disabled).toBe(false);
    });
});

describe('WIFSweeper Generate on-chain address', () => {
    // Starts the handler without waiting for it, since it only finishes
    // once the test settles the deferred promises
    const pressGenerate = () =>
        act(async () => {
            generateButton().props.onPress();
        });

    it('stays disabled while preparing and generating, and recovers when generation fails', async () => {
        const prepare = deferred();
        const generate = deferred();
        const SweepStore: any = {
            sweepError: false,
            prepareSweepInputs: jest.fn(() =>
                prepare.promise.then(() => {
                    SweepStore.onChainBalance = 100_000;
                })
            )
        };
        const InvoicesStore = {
            createUnifiedInvoice: jest.fn(() => generate.promise)
        };
        await renderView({ SweepStore, InvoicesStore });
        await typeKey(REGTEST_WIF);

        await pressGenerate();
        expect(SweepStore.prepareSweepInputs).toHaveBeenCalledWith(REGTEST_WIF);
        expect(generateButton().props.disabled).toBe(true);

        prepare.resolve();
        await flush();
        expect(InvoicesStore.createUnifiedInvoice).toHaveBeenCalled();
        expect(generateButton().props.disabled).toBe(true);

        generate.reject(new Error('address generation failed'));
        await flush();
        expect(generateButton().props.disabled).toBe(false);
        expect(hosts('ErrorMessage')[0].props.message).toBe(
            'address generation failed'
        );
    });

    it('recovers when preparing the sweep reports an error', async () => {
        const prepare = deferred();
        const SweepStore: any = {
            sweepError: false,
            prepareSweepInputs: jest.fn(() =>
                prepare.promise.then(() => {
                    SweepStore.sweepError = true;
                    SweepStore.sweepErrorMsg = 'views.Wif.noUtxosFound';
                })
            )
        };
        const InvoicesStore = { createUnifiedInvoice: jest.fn() };
        await renderView({ SweepStore, InvoicesStore });
        await typeKey(REGTEST_WIF);

        await pressGenerate();
        expect(generateButton().props.disabled).toBe(true);

        prepare.resolve();
        await flush();
        expect(InvoicesStore.createUnifiedInvoice).not.toHaveBeenCalled();
        expect(generateButton().props.disabled).toBe(false);
        expect(hosts('ErrorMessage')[0].props.message).toBe(
            'views.Wif.noUtxosFound'
        );
    });
});
