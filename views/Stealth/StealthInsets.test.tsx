import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

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

const mounted: renderer.ReactTestRenderer[] = [];

const render = async (element: React.ReactElement) => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
        tree = renderer.create(element);
    });
    mounted.push(tree!);
    return tree!;
};

const textsIn = (node: renderer.ReactTestInstance) =>
    node
        .findAllByType(Text)
        .map((t) => [t.props.children].flat().join(''))
        .map((s) => s.trim());

// Host Views whose flattened paddingBottom equals `value`
const viewsWithPaddingBottom = (
    tree: renderer.ReactTestRenderer,
    value: number
) =>
    tree.root.findAll(
        (n) =>
            n.type === View &&
            StyleSheet.flatten(n.props.style)?.paddingBottom === value
    );

const pressText = async (tree: renderer.ReactTestRenderer, label: string) => {
    const text = tree.root
        .findAllByType(Text)
        .find((t) => [t.props.children].flat().join('').trim() === label);
    let node = text?.parent;
    while (node && typeof node.props.onPress !== 'function') {
        node = node.parent;
    }
    await act(async () => {
        node!.props.onPress();
    });
};

describe('Stealth decoys respect the bottom safe-area inset', () => {
    afterEach(() => {
        // Unmount so the scan-line animation and list timers stop
        mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
        Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    });

    it('Calculator pads the keypad, including the "=" unlock key', async () => {
        const tree = await render(<CalculatorApp onUnlock={jest.fn()} />);
        const [keypad] = viewsWithPaddingBottom(tree, 20 + BOTTOM_INSET);
        expect(keypad).toBeDefined();
        expect(textsIn(keypad)).toEqual(expect.arrayContaining(['=', '0']));
    });

    it('QR Scanner pads the bottom bar holding the unlock title', async () => {
        const tree = await render(<QRScannerApp onUnlock={jest.fn()} />);
        const [bar] = viewsWithPaddingBottom(tree, 30 + BOTTOM_INSET);
        expect(bar).toBeDefined();
        expect(textsIn(bar)).toEqual(
            expect.arrayContaining(['QR Scanner', 'History'])
        );
    });

    it('QR Scanner pads the history sheet', async () => {
        const tree = await render(<QRScannerApp onUnlock={jest.fn()} />);
        await pressText(tree, 'History');
        const sheets = viewsWithPaddingBottom(tree, BOTTOM_INSET);
        expect(sheets.some((s) => textsIn(s).includes('Scan History'))).toBe(
            true
        );
    });

    it('VPN pads the location picker sheet', async () => {
        const tree = await render(<VPNApp onUnlock={jest.fn()} />);
        expect(viewsWithPaddingBottom(tree, BOTTOM_INSET)).toHaveLength(0);
        await pressText(tree, 'Select Location');
        const sheets = viewsWithPaddingBottom(tree, BOTTOM_INSET);
        expect(sheets).toHaveLength(1);
        expect(textsIn(sheets[0])).toContain('Switzerland');
    });

    it('Notepad pads the editor and the notes list', async () => {
        mockStorage['@stealth_notepad_notes'] = JSON.stringify([
            { id: '1', title: 'Groceries', content: 'milk', updatedAt: 1 }
        ]);
        const tree = await render(<NotepadApp onUnlock={jest.fn()} />);

        const list = tree.root.findByType(FlatList);
        expect(
            StyleSheet.flatten(list.props.contentContainerStyle).paddingBottom
        ).toBe(10 + BOTTOM_INSET);

        await pressText(tree, '+');
        const editors = viewsWithPaddingBottom(tree, BOTTOM_INSET);
        expect(editors.some((e) => textsIn(e).includes('New Note'))).toBe(true);
    });
});
