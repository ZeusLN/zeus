jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: { supportsAccounts: jest.fn() }
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
const mockLabels = new Map<string, string>();
jest.mock('../storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (key: string) => mockLabels.get(key) ?? false)
    }
}));
// The sheet's children render only while it is open; onClosed is how a
// swipe or backdrop press closes it
jest.mock('./ModalBox', () => {
    const { View } = require('react-native');
    return ({ isOpen, onClosed, children }: any) =>
        isOpen ? (
            <View testID="utxo-sheet" onClosed={onClosed}>
                {children}
            </View>
        ) : null;
});
jest.mock('../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress, disabled }: any) => (
        <Pressable role="button" onPress={onPress} disabled={disabled}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('@rneui/themed', () => {
    const { Pressable } = require('react-native');
    return {
        Icon: ({ onPress, accessibilityLabel }: any) => (
            <Pressable
                role="button"
                onPress={onPress}
                accessibilityLabel={accessibilityLabel}
            />
        )
    };
});
jest.mock('../components/AccountFilter', () => 'AccountFilter');
jest.mock('./Amount', () => 'Amount');
jest.mock('./LoadingIndicator', () => 'LoadingIndicator');

import * as React from 'react';
import { observable, runInAction } from 'mobx';
import {
    act,
    fireEvent,
    render,
    screen,
    within
} from '@testing-library/react-native';

import UTXOPicker from './UTXOPicker';
import Utxo from '../models/Utxo';
import BackendUtils from '../utils/BackendUtils';
import storage from '../storage';

const TXID_A = 'aaaa' + '0'.repeat(56) + '1111';
const TXID_B = 'bbbb' + '0'.repeat(56) + '2222';
const TXID_C = 'cccc' + '0'.repeat(56) + '3333';
const A = `${TXID_A}:0`;
const B = `${TXID_B}:1`;
const C = `${TXID_C}:0`;

const utxo = (txid: string, output: number, amount_sat: number) =>
    new Utxo({ txid, output, amount_sat });

const UTXOS = () => [
    utxo(TXID_A, 0, 10_000),
    utxo(TXID_B, 1, 25_000),
    utxo(TXID_C, 0, 5_000)
];

beforeEach(() => {
    mockLabels.clear();
    (storage.getItem as jest.Mock).mockClear();
    (BackendUtils.supportsAccounts as jest.Mock).mockReturnValue(false);
});

const renderPicker = async ({
    utxos = UTXOS(),
    loading = false,
    accounts = [],
    ...props
}: {
    utxos?: Utxo[];
    loading?: boolean;
    accounts?: any[];
    [prop: string]: any;
} = {}) => {
    const UTXOsStore: any = observable({
        utxos,
        loading,
        accounts,
        getUTXOs: jest.fn(),
        listAccounts: jest.fn()
    });
    const ModalStore: any = { toggleInfoModal: jest.fn() };
    const onValueChange = jest.fn();
    const element = () => (
        <UTXOPicker
            {...({ UTXOsStore, ModalStore, onValueChange, ...props } as any)}
        />
    );
    const view = await render(element());
    // observer is mocked out, so store changes need an explicit rerender
    const rerender = () => view.rerender(element());
    return {
        UTXOsStore,
        ModalStore,
        onValueChange,
        rerender,
        unmount: view.unmount
    };
};

const button = (name: string) => screen.getByRole('button', { name });
const row = (outpoint: string) =>
    screen.getByText(outpoint).parent!.parent as any;
const isChecked = (outpoint: string) =>
    row(outpoint).props.accessibilityState.checked;
const sheetOpen = () => screen.queryByTestId('utxo-sheet') !== null;
// the jumbo amount at the top of the sheet
const selectedBalance = () =>
    screen.container.queryAll(
        (n) => n.type === 'Amount' && n.props.jumboText
    )[0].props.sats;

const openPicker = () =>
    fireEvent.press(screen.getByText('components.UTXOPicker.selectUTXOs'));
const pick = (...outpoints: string[]) =>
    outpoints.reduce(
        (done, outpoint) => done.then(() => fireEvent.press(row(outpoint))),
        Promise.resolve()
    );
const setSelection = () =>
    fireEvent.press(button('components.UTXOPicker.modal.set'));
const cancel = () => fireEvent.press(button('general.cancel'));
// the field behind the sheet has its own Clear once a selection is set
const clearInSheet = () =>
    fireEvent.press(
        within(screen.getByTestId('utxo-sheet')).getByRole('button', {
            name: 'general.clear'
        })
    );

describe('UTXOPicker loading', () => {
    it('fetches the default account and its accounts when supported', async () => {
        (BackendUtils.supportsAccounts as jest.Mock).mockReturnValue(true);
        const { UTXOsStore } = await renderPicker();

        expect(UTXOsStore.getUTXOs).toHaveBeenCalledWith({
            account: 'default'
        });
        expect(UTXOsStore.listAccounts).toHaveBeenCalled();
    });

    it('does not list accounts when the backend has none', async () => {
        const { UTXOsStore } = await renderPicker();

        expect(UTXOsStore.listAccounts).not.toHaveBeenCalled();
    });

    it('shows the given title or the default one', async () => {
        await renderPicker({ title: 'Coins' });
        expect(screen.getByText('Coins')).toBeOnTheScreen();

        await renderPicker();
        expect(
            screen.getByText('components.UTXOPicker.defaultTitle')
        ).toBeOnTheScreen();
    });
});

describe('UTXOPicker field', () => {
    const fieldAmounts = () =>
        screen.container
            .queryAll((n) => n.type === 'Amount')
            .map((n) => n.props.sats);

    it('explains coin control from the info button', async () => {
        const { ModalStore } = await renderPicker();

        await fireEvent.press(button('general.info'));

        expect(ModalStore.toggleInfoModal).toHaveBeenCalledWith({
            title: 'components.UTXOPicker.defaultTitle',
            text: [
                'components.UTXOPicker.modal.description',
                'components.UTXOPicker.infoModal.automatic'
            ]
        });
        expect(sheetOpen()).toBe(false);
    });

    it('titles the info with the given title', async () => {
        const { ModalStore } = await renderPicker({ title: 'Coins' });

        await fireEvent.press(button('general.info'));

        expect(ModalStore.toggleInfoModal.mock.calls[0][0].title).toBe('Coins');
    });

    it('offers only the select button before anything is set', async () => {
        await renderPicker();

        expect(button('components.UTXOPicker.selectUTXOs')).toBeOnTheScreen();
        expect(
            screen.queryByRole('button', { name: 'general.clear' })
        ).toBeNull();
        expect(fieldAmounts()).toEqual([]);
    });

    it('shows the set UTXOs and their total', async () => {
        await renderPicker();
        await openPicker();
        await pick(A, C);

        await setSelection();

        expect(screen.getByText('aaaa...11:0, cccc...33:0')).toBeOnTheScreen();
        expect(fieldAmounts()).toEqual([15_000]);
        expect(button('general.clear')).toBeOnTheScreen();
    });

    it('drops the total when the selection is cleared', async () => {
        await renderPicker();
        await openPicker();
        await pick(A);
        await setSelection();

        await fireEvent.press(button('general.clear'));

        expect(fieldAmounts()).toEqual([]);
        expect(screen.queryByText('aaaa...11:0')).toBeNull();
    });
});

describe('UTXOPicker sheet', () => {
    it('refetches and lists the UTXOs with their amounts and labels', async () => {
        mockLabels.set(B, 'cold storage');
        const { UTXOsStore } = await renderPicker();
        UTXOsStore.getUTXOs.mockClear();

        await openPicker();

        expect(UTXOsStore.getUTXOs).toHaveBeenCalledWith({
            account: 'default'
        });
        expect(screen.getByText(A)).toBeOnTheScreen();
        expect(screen.getByText(C)).toBeOnTheScreen();
        expect(
            screen.getByText('general.label: cold storage')
        ).toBeOnTheScreen();
        expect(
            screen.container
                .queryAll((n) => n.type === 'Amount' && !n.props.jumboText)
                .map((n) => n.props.sats)
        ).toEqual([10_000, 25_000, 5_000]);
    });

    it('says there are no UTXOs and cannot be set', async () => {
        await renderPicker({ utxos: [] });

        await openPicker();

        expect(
            screen.getByText('views.UTXOs.CoinControl.noUTXOs')
        ).toBeOnTheScreen();
        expect(button('components.UTXOPicker.modal.set')).toBeDisabled();
    });

    it('shows a spinner while loading and cannot be set', async () => {
        await renderPicker({ loading: true });

        await openPicker();

        expect(
            screen.container.queryAll((n) => n.type === 'LoadingIndicator')
        ).toHaveLength(1);
        expect(button('components.UTXOPicker.modal.set')).toBeDisabled();
    });

    it('cannot be set once loading starts after a pick', async () => {
        const { UTXOsStore, rerender } = await renderPicker();
        await openPicker();
        await pick(A);
        expect(button('components.UTXOPicker.modal.set')).toBeEnabled();

        runInAction(() => {
            UTXOsStore.loading = true;
        });
        await rerender();

        expect(button('components.UTXOPicker.modal.set')).toBeDisabled();
    });

    it('cannot be set before anything is picked', async () => {
        await renderPicker();

        await openPicker();

        expect(button('components.UTXOPicker.modal.set')).toBeDisabled();
    });

    it('refetches on pull to refresh', async () => {
        const { UTXOsStore } = await renderPicker();
        await openPicker();
        UTXOsStore.getUTXOs.mockClear();

        await act(() =>
            screen.container
                .queryAll((n) => n.props.onRefresh)[0]
                .props.onRefresh()
        );

        expect(UTXOsStore.getUTXOs).toHaveBeenCalledWith({
            account: 'default'
        });
    });
});

describe('UTXOPicker selection', () => {
    it('adds up the picked UTXOs and reports them on set', async () => {
        const { onValueChange } = await renderPicker();
        await openPicker();

        await pick(A, B);

        expect(isChecked(A)).toBe(true);
        expect(isChecked(B)).toBe(true);
        expect(isChecked(C)).toBe(false);
        expect(selectedBalance()).toBe(35_000);
        expect(screen.getByText('general.selected: 2')).toBeOnTheScreen();

        await setSelection();

        expect(onValueChange).toHaveBeenCalledWith([A, B], 35_000, 'default');
        expect(sheetOpen()).toBe(false);
        expect(screen.getByText('aaaa...11:0, bbbb...22:1')).toBeOnTheScreen();
    });

    it('takes a UTXO back out when it is pressed again', async () => {
        await renderPicker();
        await openPicker();

        await pick(A, B, A);

        expect(isChecked(A)).toBe(false);
        expect(selectedBalance()).toBe(25_000);
    });

    it('reopens with the set selection', async () => {
        await renderPicker();
        await openPicker();
        await pick(A, C);
        await setSelection();

        await fireEvent.press(
            screen.getByLabelText('components.UTXOPicker.selectUTXOs')
        );

        expect(isChecked(A)).toBe(true);
        expect(isChecked(C)).toBe(true);
        expect(selectedBalance()).toBe(15_000);
    });

    it('drops set UTXOs that have since been spent when reopened', async () => {
        const { UTXOsStore } = await renderPicker();
        await openPicker();
        await pick(A, B);
        await setSelection();
        runInAction(() => {
            UTXOsStore.utxos = UTXOsStore.utxos.filter(
                (u: Utxo) => u.getOutpoint !== A
            );
        });

        await fireEvent.press(
            screen.getByLabelText('components.UTXOPicker.selectUTXOs')
        );

        expect(isChecked(B)).toBe(true);
        expect(selectedBalance()).toBe(25_000);
        expect(screen.getByText('general.selected: 1')).toBeOnTheScreen();
    });

    it('keeps the set selection when none of it is listed yet', async () => {
        const { UTXOsStore } = await renderPicker();
        await openPicker();
        await pick(A, B);
        await setSelection();
        runInAction(() => {
            UTXOsStore.utxos = [];
        });

        await fireEvent.press(
            screen.getByLabelText('components.UTXOPicker.selectUTXOs')
        );

        expect(screen.getByText('general.selected: 2')).toBeOnTheScreen();
        expect(selectedBalance()).toBe(35_000);
    });

    it('discards picks on cancel', async () => {
        const { onValueChange } = await renderPicker();
        await openPicker();
        await pick(A);

        await cancel();

        expect(sheetOpen()).toBe(false);
        expect(onValueChange).not.toHaveBeenCalled();
        expect(
            screen.getByText('components.UTXOPicker.selectUTXOs')
        ).toBeOnTheScreen();
    });

    it('closes like cancel when swiped away', async () => {
        const { onValueChange } = await renderPicker();
        await openPicker();
        await pick(A);

        await act(() => screen.getByTestId('utxo-sheet').props.onClosed());

        expect(sheetOpen()).toBe(false);
        expect(onValueChange).not.toHaveBeenCalled();
    });
});

describe('UTXOPicker clearing', () => {
    const selectAndSet = async () => {
        await openPicker();
        await pick(A, B);
        await setSelection();
    };
    const reopen = () =>
        fireEvent.press(
            screen.getByLabelText('components.UTXOPicker.selectUTXOs')
        );

    it('clears the set selection from the field', async () => {
        const { onValueChange } = await renderPicker();
        await selectAndSet();

        await fireEvent.press(button('general.clear'));

        expect(onValueChange).toHaveBeenLastCalledWith([], 0, 'default');
        expect(
            screen.getByText('components.UTXOPicker.selectUTXOs')
        ).toBeOnTheScreen();
    });

    it('clears the picks inside the sheet', async () => {
        await renderPicker();
        await openPicker();
        await pick(A);

        await clearInSheet();

        expect(isChecked(A)).toBe(false);
        expect(selectedBalance()).toBe(0);
    });

    it('applies a clear made in the sheet when it closes', async () => {
        const { onValueChange } = await renderPicker();
        await selectAndSet();
        await reopen();
        await clearInSheet();

        await cancel();

        expect(onValueChange).toHaveBeenLastCalledWith([], 0, 'default');
        expect(
            screen.getByText('components.UTXOPicker.selectUTXOs')
        ).toBeOnTheScreen();
    });

    it('keeps the set selection when picks follow the clear', async () => {
        const { onValueChange } = await renderPicker();
        await selectAndSet();
        await reopen();
        await clearInSheet();
        await pick(C);
        onValueChange.mockClear();

        await cancel();

        expect(onValueChange).not.toHaveBeenCalled();
        expect(screen.getByText('aaaa...11:0, bbbb...22:1')).toBeOnTheScreen();
    });
});

describe('UTXOPicker accounts', () => {
    const accountFilter = () =>
        screen.container.queryAll((n) => n.type === 'AccountFilter')[0];

    it('offers the visible accounts', async () => {
        (BackendUtils.supportsAccounts as jest.Mock).mockReturnValue(true);
        await renderPicker({
            accounts: [{ name: 'savings' }, { name: 'old', hidden: true }]
        });

        await openPicker();

        expect(accountFilter().props.items).toEqual([{ name: 'savings' }]);
        expect(accountFilter().props.default).toBe('default');
    });

    it('fetches and reports the chosen account, dropping earlier picks', async () => {
        (BackendUtils.supportsAccounts as jest.Mock).mockReturnValue(true);
        const { UTXOsStore, onValueChange } = await renderPicker({
            accounts: [{ name: 'savings' }]
        });
        await openPicker();
        await pick(A);

        await act(() => {
            accountFilter().props.onChangeAccount();
            accountFilter().props.refresh('savings');
        });

        expect(UTXOsStore.getUTXOs).toHaveBeenLastCalledWith({
            account: 'savings'
        });
        expect(isChecked(A)).toBe(false);
        expect(selectedBalance()).toBe(0);

        await pick(B);
        await setSelection();

        expect(onValueChange).toHaveBeenCalledWith([B], 25_000, 'savings');
    });
});

describe('UTXOPicker labels', () => {
    it('reloads labels when the UTXO list changes', async () => {
        const { UTXOsStore } = await renderPicker({ utxos: [] });
        mockLabels.set(A, 'from exchange');

        await act(async () => {
            runInAction(() => {
                UTXOsStore.utxos = UTXOS();
            });
        });
        await openPicker();

        expect(
            screen.getByText('general.label: from exchange')
        ).toBeOnTheScreen();
    });

    it('stops reloading labels once unmounted', async () => {
        const { UTXOsStore, unmount } = await renderPicker({ utxos: [] });
        await unmount();
        (storage.getItem as jest.Mock).mockClear();

        runInAction(() => {
            UTXOsStore.utxos = UTXOS();
        });

        expect(storage.getItem).not.toHaveBeenCalled();
    });
});
