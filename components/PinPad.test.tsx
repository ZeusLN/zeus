import React from 'react';
import { AppState } from 'react-native';
import renderer, { act } from 'react-test-renderer';

jest.mock('../assets/images/SVG/Success.svg', () => () => null);
jest.mock('../assets/images/SVG/DeleteKey.svg', () => () => null);
jest.mock('./Touchable', () => () => null);
jest.mock('./layout/Row', () => ({
    Row: ({ children }: any) => children
}));
jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: {} },
    fiatStore: { getSymbol: () => ({}) },
    unitsStore: {}
}));
jest.mock('react-native-haptic-feedback', () => ({ trigger: jest.fn() }));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000')
}));

import PinPad from './PinPad';

let appStateHandler: ((state: string) => void) | undefined;
let addEventListenerSpy: jest.SpyInstance;
beforeEach(() => {
    appStateHandler = undefined;
    addEventListenerSpy = jest
        .spyOn(AppState, 'addEventListener')
        .mockImplementation((_type: any, handler: any) => {
            appStateHandler = handler;
            return { remove: jest.fn() } as any;
        });
});
afterEach(() => addEventListenerSpy.mockRestore());

const renderPad = (props: any) => {
    const clearValue = jest.fn();
    act(() => {
        renderer.create(
            <PinPad
                appendValue={jest.fn(() => true)}
                clearValue={clearValue}
                deleteValue={jest.fn()}
                {...props}
            />
        );
    });
    return clearValue;
};

describe('PinPad', () => {
    // keeps the PIN out of the OS task-switcher snapshot
    it('clears a PIN entry when the app goes to the background', () => {
        const clearValue = renderPad({});
        act(() => appStateHandler!('inactive'));
        expect(clearValue).not.toHaveBeenCalled();
        act(() => appStateHandler!('background'));
        expect(clearValue).toHaveBeenCalledTimes(1);
    });

    it('keeps an amount entry when the app goes to the background', () => {
        const clearValue = renderPad({ amount: true });
        expect(addEventListenerSpy).not.toHaveBeenCalled();
        expect(clearValue).not.toHaveBeenCalled();
    });
});
