jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

import React from 'react';
import { StyleSheet } from 'react-native';
import {
    fireEvent,
    render,
    screen,
    within
} from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';

const BOTTOM_INSET = 48;

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 24, bottom: 48, left: 0, right: 0 })
}));

const mockStorage: { [key: string]: string } = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn((key: string) =>
        Promise.resolve(mockStorage[key] ?? null)
    ),
    setItem: jest.fn(() => Promise.resolve())
}));

jest.mock('react-native-vision-camera', () => ({
    Camera: Object.assign(() => null, {
        getCameraPermissionStatus: () => 'denied',
        requestCameraPermission: () => Promise.resolve('denied')
    }),
    useCameraDevice: () => undefined,
    useCodeScanner: () => ({})
}));

import CalculatorApp from './CalculatorApp';
import NotepadApp from './NotepadApp';
import QRScannerApp from './QRScannerApp';
import VPNApp from './VPNApp';

// Host Views whose flattened paddingBottom equals `value`
const viewsWithPaddingBottom = (value: number) =>
    screen.container.queryAll(
        (n) =>
            n.type === 'View' &&
            StyleSheet.flatten(n.props.style)?.paddingBottom === value
    );

const contains = (node: TestInstance, text: string) =>
    within(node).queryAllByText(text).length > 0;

describe('Stealth decoys respect the bottom safe-area inset', () => {
    afterEach(() => {
        Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    });

    it('Calculator pads the keypad, including the "=" unlock key', async () => {
        await render(<CalculatorApp onUnlock={jest.fn()} />);
        const [keypad] = viewsWithPaddingBottom(20 + BOTTOM_INSET);
        expect(keypad).toBeDefined();
        expect(within(keypad).getByText('=')).toBeOnTheScreen();
        expect(within(keypad).getByText('0')).toBeOnTheScreen();
    });

    it('QR Scanner pads the bottom bar holding the unlock title', async () => {
        await render(<QRScannerApp onUnlock={jest.fn()} />);
        const [bar] = viewsWithPaddingBottom(30 + BOTTOM_INSET);
        expect(bar).toBeDefined();
        expect(within(bar).getByText('QR Scanner')).toBeOnTheScreen();
        expect(within(bar).getByText('History')).toBeOnTheScreen();
    });

    it('QR Scanner pads the history sheet', async () => {
        await render(<QRScannerApp onUnlock={jest.fn()} />);
        await fireEvent.press(screen.getByText('History'));
        const sheets = viewsWithPaddingBottom(BOTTOM_INSET);
        expect(sheets.some((s) => contains(s, 'Scan History'))).toBe(true);
    });

    it('VPN pads the location picker sheet', async () => {
        await render(<VPNApp onUnlock={jest.fn()} />);
        expect(viewsWithPaddingBottom(BOTTOM_INSET)).toHaveLength(0);
        await fireEvent.press(screen.getByText('Select Location'));
        const sheets = viewsWithPaddingBottom(BOTTOM_INSET);
        expect(sheets).toHaveLength(1);
        expect(within(sheets[0]).getByText('Switzerland')).toBeOnTheScreen();
    });

    it('Notepad pads the editor and the notes list', async () => {
        mockStorage['@stealth_notepad_notes'] = JSON.stringify([
            { id: '1', title: 'Groceries', content: 'milk', updatedAt: 1 }
        ]);
        await render(<NotepadApp onUnlock={jest.fn()} />);

        // the FlatList's host scroll view keeps contentContainerStyle
        const [list] = screen.container.queryAll(
            (n) => n.type === 'RCTScrollView'
        );
        expect(within(list).getByText('Groceries')).toBeOnTheScreen();
        expect(
            StyleSheet.flatten(list.props.contentContainerStyle).paddingBottom
        ).toBe(10 + BOTTOM_INSET);

        await fireEvent.press(screen.getByText('+'));
        const editors = viewsWithPaddingBottom(BOTTOM_INSET);
        expect(editors.some((e) => contains(e, 'New Note'))).toBe(true);
    });
});
