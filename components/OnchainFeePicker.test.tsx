jest.mock('mobx-react', () => ({
    observer: (component: any) => component
}));
jest.mock('../stores/Stores', () => ({
    feeStore: {},
    modalStore: {},
    settingsStore: {}
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('@rneui/themed', () => {
    const { Pressable } = require('react-native');
    return {
        Icon: ({ onPress, accessibilityLabel }: any) =>
            onPress ? (
                <Pressable
                    role="button"
                    onPress={onPress}
                    accessibilityLabel={accessibilityLabel}
                />
            ) : null
    };
});
jest.mock('./LoadingIndicator', () => 'LoadingIndicator');
jest.mock('./TextInput', () => 'TextInput');

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import OnchainFeePicker from './OnchainFeePicker';
import * as Stores from '../stores/Stores';

const { feeStore, modalStore, settingsStore } = Stores as any;

const FEES = { fastestFee: 5, halfHourFee: 4, hourFee: 1, minimumFee: 1 };

// resolves the mempool fetch the way FeeStore does: on failure it sets
// error and resolves with nothing
const fetchResult = (fees: any) =>
    jest.fn(async () => {
        Object.assign(feeStore, {
            loading: false,
            error: !fees,
            recommendedFees: fees || {}
        });
        return fees;
    });

beforeEach(() => {
    Object.assign(settingsStore, {
        settings: {
            privacy: { enableMempoolRates: true },
            payments: { preferredMempoolRate: 'fastestFee' }
        }
    });
    Object.assign(feeStore, {
        loading: false,
        error: false,
        recommendedFees: {},
        getOnchainFeesviaMempool: fetchResult(FEES)
    });
    Object.assign(modalStore, { toggleInfoModal: jest.fn() });
});

const TITLE = 'views.Send.feeSatsVbyte';
// the title that opens and closes the card, when it can be closed
const toggle = () => screen.queryByRole('button', { name: TITLE });
const isOpen = () => toggle()!.props.accessibilityState.expanded;

// Renders the picker in a host that keeps the rate the way Send does,
// passing each reported rate back in. Unless `closed`, it then opens the
// card the way a tap on its title does, so the presets can be pressed.
const renderPicker = async (fee = '', { closed = false } = {}) => {
    const onChangeFee = jest.fn();
    let setFee: (value: string) => void = () => {};
    function Host() {
        const [value, setValue] = React.useState(fee);
        setFee = setValue;
        return (
            <OnchainFeePicker
                fee={value}
                onChangeFee={(rate: string) => {
                    onChangeFee(rate);
                    setValue(rate);
                }}
            />
        );
    }
    await render(<Host />);
    // let the mempool fetch settle
    await act(async () => {});
    if (!closed && toggle() && !isOpen()) {
        await fireEvent.press(toggle()!);
    }
    return {
        onChangeFee,
        // a rate set from outside, like new route params on Send
        rerender: (value: string) => act(() => setFee(value))
    };
};

const preset = (name: string) => screen.getByRole('button', { name });
const isSelected = (name: string) =>
    preset(name).props.accessibilityState.selected;
const FASTEST = 'views.EditFee.fastestFee 5';
const HALF_HOUR = 'views.EditFee.halfHourFee 4';
const HOUR = 'views.EditFee.hourFee 1';
const MINIMUM = 'views.EditFee.minimumFee 1';
const CUSTOM = 'general.custom';
const rateInput = () =>
    screen.container.queryAll((n) => n.type === 'TextInput')[0];

describe('OnchainFeePicker closed card', () => {
    it('starts closed with the preferred rate in the summary', async () => {
        await renderPicker('', { closed: true });

        expect(isOpen()).toBe(false);
        // the presets are hidden; the summary reads like the chosen one
        expect(screen.queryByRole('button', { name: CUSTOM })).toBeNull();
        expect(screen.getByText('views.EditFee.fastestFee')).toBeOnTheScreen();
        expect(screen.getByText('5')).toBeOnTheScreen();
    });

    it('opens and closes from the title', async () => {
        await renderPicker('', { closed: true });

        await fireEvent.press(toggle()!);
        expect(isOpen()).toBe(true);
        expect(preset(FASTEST)).toBeOnTheScreen();

        await fireEvent.press(toggle()!);
        expect(isOpen()).toBe(false);
        // the presets are hidden; the summary reads like the chosen one
        expect(screen.queryByRole('button', { name: CUSTOM })).toBeNull();
    });

    it('opens from the summary', async () => {
        await renderPicker('', { closed: true });

        await fireEvent.press(screen.getByText('5'));

        expect(isOpen()).toBe(true);
    });

    it('shows the picked preset once closed again', async () => {
        const { rerender } = await renderPicker();
        await fireEvent.press(preset(HOUR));
        // Send passes the reported rate back in
        await rerender('1');

        await fireEvent.press(toggle()!);

        expect(screen.getByText('views.EditFee.hourFee')).toBeOnTheScreen();
        expect(screen.getByText('1')).toBeOnTheScreen();
    });

    it('shows a custom rate as custom', async () => {
        await renderPicker('7', { closed: true });

        expect(screen.getByText('general.custom')).toBeOnTheScreen();
        expect(screen.getByText('7')).toBeOnTheScreen();
    });

    it.each([[''], ['5000']])(
        'asks for a rate when the custom rate is %p',
        async (rate) => {
            const { rerender } = await renderPicker();
            await fireEvent.press(preset(CUSTOM));
            await fireEvent.changeText(rateInput(), rate);
            await rerender(rate);

            await fireEvent.press(toggle()!);

            expect(
                screen.getByText('components.OnchainFeeInput.placeholder')
            ).toHaveStyle({ color: 'theme:warning' });
        }
    );

    it('shows a spinner in the summary while the rates load', async () => {
        feeStore.loading = true;
        feeStore.getOnchainFeesviaMempool = jest.fn(
            () => new Promise(() => {})
        );
        await renderPicker('', { closed: true });

        expect(isOpen()).toBe(false);
        expect(
            screen.container.queryAll((n) => n.type === 'LoadingIndicator')
        ).toHaveLength(1);
    });

    it('opens by itself when the rates cannot be fetched', async () => {
        feeStore.getOnchainFeesviaMempool = fetchResult(undefined);
        await renderPicker('', { closed: true });

        expect(isOpen()).toBe(true);
        expect(rateInput()).toBeDefined();
    });

    it('says the fetch failed once closed', async () => {
        feeStore.getOnchainFeesviaMempool = fetchResult(undefined);
        await renderPicker('', { closed: true });

        await fireEvent.press(toggle()!);

        expect(screen.getByText('views.EditFee.error')).toHaveStyle({
            color: 'theme:warning'
        });
    });
});

describe('OnchainFeePicker presets', () => {
    it('offers the four recommended rates and a custom one', async () => {
        await renderPicker();

        for (const name of [FASTEST, HALF_HOUR, HOUR, MINIMUM, CUSTOM]) {
            expect(preset(name)).toBeOnTheScreen();
        }
        expect(rateInput()).toBeUndefined();
    });

    it('starts on the preferred rate and reports it', async () => {
        const { onChangeFee } = await renderPicker();

        expect(isSelected(FASTEST)).toBe(true);
        expect(onChangeFee).toHaveBeenCalledWith('5');
    });

    it('starts on another preferred rate', async () => {
        settingsStore.settings.payments.preferredMempoolRate = 'minimumFee';
        const { onChangeFee } = await renderPicker();

        expect(isSelected(MINIMUM)).toBe(true);
        expect(isSelected(HOUR)).toBe(false);
        expect(onChangeFee).toHaveBeenCalledWith('1');
    });

    it('keeps a given rate that matches a preset', async () => {
        const { onChangeFee } = await renderPicker('4');

        expect(isSelected(HALF_HOUR)).toBe(true);
        expect(onChangeFee).not.toHaveBeenCalled();
    });

    it('shows a given rate that matches no preset as custom', async () => {
        const { onChangeFee } = await renderPicker('7');

        expect(isSelected(CUSTOM)).toBe(true);
        expect(rateInput().props.value).toBe('7');
        expect(onChangeFee).not.toHaveBeenCalled();
    });

    it('reports the rate of a pressed preset', async () => {
        const { onChangeFee } = await renderPicker();

        await fireEvent.press(preset(HOUR));

        expect(isSelected(HOUR)).toBe(true);
        expect(isSelected(FASTEST)).toBe(false);
        expect(onChangeFee).toHaveBeenLastCalledWith('1');
    });

    it('shows a spinner while the rates load', async () => {
        feeStore.loading = true;
        feeStore.getOnchainFeesviaMempool = jest.fn(
            () => new Promise(() => {})
        );
        await renderPicker();

        expect(
            screen.container.queryAll((n) => n.type === 'LoadingIndicator')
        ).toHaveLength(1);
    });
});

describe('OnchainFeePicker custom rate', () => {
    it('asks for a rate when Custom is pressed', async () => {
        const { onChangeFee } = await renderPicker();

        await fireEvent.press(preset(CUSTOM));

        expect(isSelected(CUSTOM)).toBe(true);
        expect(rateInput().props.value).toBe('');
        expect(rateInput().props.error).toBe(true);
        // an empty rate blocks Proceed on Send
        expect(onChangeFee).toHaveBeenLastCalledWith('');
    });

    it('reports a typed rate', async () => {
        const { onChangeFee } = await renderPicker();
        await fireEvent.press(preset(CUSTOM));

        await fireEvent.changeText(rateInput(), '12');

        expect(onChangeFee).toHaveBeenLastCalledWith('12');
        expect(rateInput().props.error).toBe(false);
    });

    it('keeps a typed rate that equals a preset on Custom', async () => {
        const { onChangeFee, rerender } = await renderPicker();
        await fireEvent.press(preset(CUSTOM));
        await fireEvent.changeText(rateInput(), '4');

        // Send passes the reported rate back in
        await rerender('4');

        expect(isSelected(CUSTOM)).toBe(true);
        expect(onChangeFee).toHaveBeenLastCalledWith('4');
    });

    it('brings a typed rate back after another preset', async () => {
        const { onChangeFee } = await renderPicker();
        await fireEvent.press(preset(CUSTOM));
        await fireEvent.changeText(rateInput(), '12');
        await fireEvent.press(preset(HOUR));

        await fireEvent.press(preset(CUSTOM));

        expect(rateInput().props.value).toBe('12');
        expect(onChangeFee).toHaveBeenLastCalledWith('12');
    });

    it('warns about an out of range rate', async () => {
        await renderPicker();
        await fireEvent.press(preset(CUSTOM));

        await fireEvent.changeText(rateInput(), '5000');

        expect(rateInput().props.error).toBe(true);
        expect(
            screen.getByText('views.EditFee.customFeeOutOfRange')
        ).toBeOnTheScreen();
    });
});

describe('OnchainFeePicker fetch failure', () => {
    beforeEach(() => {
        feeStore.getOnchainFeesviaMempool = fetchResult(undefined);
    });

    it('says so and asks for a rate', async () => {
        const { onChangeFee } = await renderPicker();

        expect(screen.getByText('views.EditFee.error')).toBeOnTheScreen();
        expect(screen.queryByRole('button', { name: CUSTOM })).toBeNull();
        expect(rateInput().props.value).toBe('');
        expect(onChangeFee).toHaveBeenCalledWith('');
    });

    it('keeps a given rate in the input', async () => {
        const { onChangeFee } = await renderPicker('6');

        expect(rateInput().props.value).toBe('6');
        expect(onChangeFee).toHaveBeenCalledWith('6');
    });

    it('treats a rejected fetch the same way', async () => {
        feeStore.getOnchainFeesviaMempool = jest.fn(async () => {
            Object.assign(feeStore, { error: true, recommendedFees: {} });
            throw new Error('offline');
        });
        await renderPicker();

        expect(screen.getByText('views.EditFee.error')).toBeOnTheScreen();
        expect(rateInput().props.value).toBe('');
    });
});

describe('OnchainFeePicker rate set from outside', () => {
    it('selects the matching preset', async () => {
        const { rerender } = await renderPicker();

        await rerender('1');

        expect(isSelected(HOUR)).toBe(true);
    });

    it('shows any other rate as custom', async () => {
        const { rerender } = await renderPicker();

        await rerender('9');

        expect(isSelected(CUSTOM)).toBe(true);
        expect(rateInput().props.value).toBe('9');
    });
});

describe('OnchainFeePicker without mempool rates', () => {
    beforeEach(() => {
        settingsStore.settings.privacy.enableMempoolRates = false;
    });

    it('does not fetch and asks for a rate directly', async () => {
        const { onChangeFee } = await renderPicker('3');

        expect(feeStore.getOnchainFeesviaMempool).not.toHaveBeenCalled();
        expect(toggle()).toBeNull();
        expect(screen.queryByRole('button', { name: CUSTOM })).toBeNull();
        expect(rateInput().props.value).toBe('3');

        await fireEvent.changeText(rateInput(), '8');

        expect(onChangeFee).toHaveBeenCalledWith('8');
    });

    it('explains the rate without mentioning presets', async () => {
        await renderPicker();

        await fireEvent.press(
            screen.getByRole('button', { name: 'general.info' })
        );

        expect(modalStore.toggleInfoModal).toHaveBeenCalledWith({
            title: 'views.Send.feeSatsVbyte',
            text: ['components.OnchainFeePicker.info.rate']
        });
    });
});

it('explains the rate and presets from the info button', async () => {
    await renderPicker();

    await fireEvent.press(screen.getByRole('button', { name: 'general.info' }));

    expect(modalStore.toggleInfoModal).toHaveBeenCalledWith({
        title: 'views.Send.feeSatsVbyte',
        text: [
            'components.OnchainFeePicker.info.rate',
            'components.OnchainFeePicker.info.presets'
        ]
    });
});
