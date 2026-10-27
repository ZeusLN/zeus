jest.mock('../stores/Stores', () => ({
    fiatStore: { getSymbol: () => ({ separatorSwap: false }) },
    settingsStore: { settings: {} },
    unitsStore: { units: 'sats' }
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('react-native-haptic-feedback', () => ({ trigger: jest.fn() }));
jest.mock('../assets/images/SVG/Success.svg', () => 'SuccessIcon');
jest.mock('../assets/images/SVG/DeleteKey.svg', () => 'DeleteKey');

import * as React from 'react';
import { AppState, Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import PinPad from './PinPad';
import * as Stores from '../stores/Stores';

const { fiatStore, settingsStore, unitsStore } = Stores as any;

// React Native's own components subscribe too, so a change goes to every
// listener
let appStateListeners: ((state: string) => void)[] = [];
const onAppStateChange = (state: string) =>
    appStateListeners.forEach((listener) => listener(state));
const removeAppStateListener = jest.fn();

beforeEach(() => {
    appStateListeners = [];
    removeAppStateListener.mockClear();
    (ReactNativeHapticFeedback.trigger as jest.Mock).mockClear();
    settingsStore.settings = {};
    unitsStore.units = 'sats';
    fiatStore.getSymbol = () => ({ separatorSwap: false });
    jest.spyOn(AppState, 'addEventListener').mockImplementation(
        (_type: any, handler: any) => {
            appStateListeners.push(handler);
            return { remove: removeAppStateListener } as any;
        }
    );
});

afterEach(() => jest.restoreAllMocks());

const renderPad = (props: Record<string, any> = {}) => {
    const appendValue = jest.fn((_digit: string) => true);
    const clearValue = jest.fn();
    const deleteValue = jest.fn();
    const submitValue = jest.fn();
    return render(
        <PinPad
            appendValue={appendValue}
            clearValue={clearValue}
            deleteValue={deleteValue}
            submitValue={submitValue}
            {...props}
        />
    ).then((view) => ({
        appendValue,
        clearValue,
        deleteValue,
        submitValue,
        unmount: view.unmount
    }));
};

const press = (label: string) => fireEvent.press(screen.getByText(label));
const typeDigits = async (digits: string) => {
    for (const digit of digits) await press(digit);
};
const haptics = () =>
    (ReactNativeHapticFeedback.trigger as jest.Mock).mock.calls.map(
        ([type]) => type
    );
const submitKey = () =>
    screen.container.queryAll((n) => n.type === 'SuccessIcon')[0];

describe('PinPad digits', () => {
    it('lays out 1 to 9 in order with 0 at the bottom', async () => {
        await renderPad();

        const digits = screen.getAllByText(/^\d$/).map((n) => n.props.children);
        expect(digits).toEqual([
            '1',
            '2',
            '3',
            '4',
            '5',
            '6',
            '7',
            '8',
            '9',
            '0'
        ]);
    });

    it('passes each pressed digit to the parent', async () => {
        const { appendValue } = await renderPad();

        await typeDigits('5190');

        expect(appendValue.mock.calls.map(([d]) => d)).toEqual([
            '5',
            '1',
            '9',
            '0'
        ]);
    });

    it('shuffles the digits once for a shuffled PIN pad', async () => {
        jest.spyOn(Math, 'random')
            .mockReturnValueOnce(0.9)
            .mockReturnValueOnce(0.8)
            .mockReturnValueOnce(0.7)
            .mockReturnValueOnce(0.6)
            .mockReturnValueOnce(0.5)
            .mockReturnValueOnce(0.4)
            .mockReturnValueOnce(0.3)
            .mockReturnValueOnce(0.2)
            .mockReturnValueOnce(0.1)
            .mockReturnValueOnce(0.0);
        const { appendValue } = await renderPad({ shuffle: true });
        const layout = () =>
            screen.getAllByText(/^\d$/).map((n) => n.props.children);

        // reversed: the key in the 1 position now enters 8, and so on
        expect(layout()).toEqual([
            '8',
            '7',
            '6',
            '5',
            '4',
            '3',
            '2',
            '1',
            '0',
            '9'
        ]);

        await press('8');
        expect(layout()).toEqual([
            '8',
            '7',
            '6',
            '5',
            '4',
            '3',
            '2',
            '1',
            '0',
            '9'
        ]);
        expect(appendValue).toHaveBeenCalledWith('8');
    });

    it('gives a click on an accepted digit and an error buzz on a rejected one', async () => {
        const { appendValue } = await renderPad();

        await press('1');
        appendValue.mockReturnValueOnce(false);
        await press('2');

        expect(haptics()).toEqual([
            Platform.OS === 'android' ? 'effectClick' : 'soft',
            'notificationError'
        ]);
    });

    it('uses larger keys when big keypad buttons are on', async () => {
        settingsStore.settings = { display: { bigKeypadButtons: true } };
        await renderPad();

        expect(screen.getByText('1')).toHaveStyle({ fontSize: 50 });
    });
});

describe('PinPad PIN entry', () => {
    it('deletes a digit with < and clears with C', async () => {
        const { deleteValue, clearValue } = await renderPad();

        await press('<');
        await press('C');

        expect(deleteValue).toHaveBeenCalledTimes(1);
        expect(clearValue).toHaveBeenCalledTimes(1);
    });

    it('clears everything on a long press of <', async () => {
        const { deleteValue, clearValue } = await renderPad();

        await fireEvent(screen.getByText('<'), 'longPress');

        expect(clearValue).toHaveBeenCalledTimes(1);
        expect(deleteValue).not.toHaveBeenCalled();
    });

    it('clears the PIN when the app goes to the background', async () => {
        const { clearValue } = await renderPad();

        await act(() => onAppStateChange('active'));
        await act(() => onAppStateChange('inactive'));
        expect(clearValue).not.toHaveBeenCalled();

        await act(() => onAppStateChange('background'));
        expect(clearValue).toHaveBeenCalledTimes(1);
    });

    it('stops listening to the app state on unmount', async () => {
        const { unmount } = await renderPad();

        removeAppStateListener.mockClear();

        await unmount();

        expect(removeAppStateListener).toHaveBeenCalled();
    });
});

describe('PinPad with a hidden PIN length', () => {
    it('offers submit only once the minimum length is reached', async () => {
        await renderPad({ hidePinLength: true, minLength: 4 });
        expect(screen.queryByText('C')).not.toBeOnTheScreen();

        await typeDigits('123');
        expect(submitKey()).toBeUndefined();

        await press('4');
        expect(submitKey()).toBeDefined();
    });

    it('does not count rejected digits toward the minimum', async () => {
        const { appendValue } = await renderPad({
            hidePinLength: true,
            minLength: 2
        });
        appendValue.mockReturnValueOnce(false);

        await typeDigits('12');

        expect(submitKey()).toBeUndefined();
    });

    it('counts deletions back down', async () => {
        await renderPad({ hidePinLength: true, minLength: 2 });

        await typeDigits('12');
        await press('<');

        expect(submitKey()).toBeUndefined();
    });

    it('starts over after a long press of <', async () => {
        await renderPad({ hidePinLength: true, minLength: 4 });
        await typeDigits('1234');

        await fireEvent(screen.getByText('<'), 'longPress');
        expect(submitKey()).toBeUndefined();

        await typeDigits('123');
        expect(submitKey()).toBeUndefined();

        await press('4');
        expect(submitKey()).toBeDefined();
    });

    it('does not count past the maximum length', async () => {
        await renderPad({ hidePinLength: true, minLength: 3, maxLength: 3 });

        await typeDigits('12345');
        await press('<');

        // 3 counted, one deleted
        expect(submitKey()).toBeUndefined();
    });

    it('submits and starts over', async () => {
        const { submitValue } = await renderPad({
            hidePinLength: true,
            minLength: 4
        });
        await typeDigits('1234');

        await fireEvent.press(submitKey());

        expect(submitValue).toHaveBeenCalledTimes(1);
        expect(submitKey()).toBeUndefined();
    });

    it('starts over after the app is backgrounded', async () => {
        await renderPad({ hidePinLength: true, minLength: 4 });
        await typeDigits('1234');

        await act(() => onAppStateChange('background'));

        expect(submitKey()).toBeUndefined();
    });
});

describe('PinPad amount entry', () => {
    const deleteKey = () =>
        screen.container.queryAll((n) => n.type === 'DeleteKey')[0];

    it('has a decimal point and a delete key instead of < and C', async () => {
        const { appendValue } = await renderPad({ amount: true });

        expect(screen.queryByText('<')).not.toBeOnTheScreen();
        expect(screen.queryByText('C')).not.toBeOnTheScreen();

        await press('.');
        expect(appendValue).toHaveBeenCalledWith('.');
    });

    it('shows a comma for the point in fiat with swapped separators', async () => {
        unitsStore.units = 'fiat';
        fiatStore.getSymbol = () => ({ separatorSwap: true });
        const { appendValue } = await renderPad({ amount: true });

        await press(',');

        // the parent still receives a point
        expect(appendValue).toHaveBeenCalledWith('.');
    });

    it('keeps the point in fiat with standard separators', async () => {
        unitsStore.units = 'fiat';
        await renderPad({ amount: true });

        expect(screen.getByText('.')).toBeOnTheScreen();
    });

    it('keeps the point for swapped separators outside fiat', async () => {
        fiatStore.getSymbol = () => ({ separatorSwap: true });
        await renderPad({ amount: true });

        expect(screen.getByText('.')).toBeOnTheScreen();
    });

    it('deletes on press and clears on a long press', async () => {
        const { deleteValue, clearValue } = await renderPad({ amount: true });

        await fireEvent.press(deleteKey());
        await fireEvent(deleteKey(), 'longPress');

        expect(deleteValue).toHaveBeenCalledTimes(1);
        expect(clearValue).toHaveBeenCalledTimes(1);
    });

    it('keeps the amount when the app is backgrounded', async () => {
        const { clearValue } = await renderPad({ amount: true });

        await act(() => onAppStateChange('background'));

        expect(clearValue).not.toHaveBeenCalled();
    });
});

describe('PinPad highlight', () => {
    it('uses the highlighting touchable when asked to', async () => {
        const { appendValue } = await renderPad({ numberHighlight: true });

        await press('7');

        expect(appendValue).toHaveBeenCalledWith('7');
    });
});
