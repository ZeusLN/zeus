import React from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

// mobx-react's main entry asks react-dom for this one function
jest.mock(
    'react-dom',
    () => ({ unstable_batchedUpdates: (update: () => void) => update() }),
    { virtual: true }
);
jest.mock('../stores/Stores', () => {
    const { observable } = require('mobx');
    const settingsStore = observable({
        loggedIn: true,
        posStatus: 'unselected',
        loginRequired: () => !settingsStore.loggedIn
    });
    return { settingsStore };
});
// each QR code drawn shows its value as text
jest.mock('react-native-qrcode-svg', () => {
    const { Text } = require('react-native');
    return ({ value }: any) => <Text>{value}</Text>;
});
jest.mock('@rneui/themed', () => ({ ButtonGroup: 'ButtonGroup' }));
jest.mock('./QRSpeedButton', () => 'QRSpeedButton');
jest.mock('./Amount', () => 'Amount');
jest.mock('./Button', () => 'Button');
jest.mock('./CopyButton', () => 'CopyButton');
jest.mock('./ShareButton', () => 'ShareButton');
jest.mock('./NFCButton', () => 'NFCButton');
jest.mock('./Touchable', () => 'Touchable');
jest.mock('./Conversion', () => 'Conversion');
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000')
}));

import CollapsedQR from './CollapsedQR';
import { settingsStore } from '../stores/Stores';

// The background lock pushes the Lockscreen over the screen without
// unmounting it. On iOS the enlarged QR's Modal would stay above it.
describe('CollapsedQR enlarged view', () => {
    it('is hidden while login is required and back after the login', async () => {
        await render(<CollapsedQR value="zprv-secret" expanded hideText />);
        // the small code, then the enlarged one in its Modal
        const codesDrawn = () => screen.queryAllByText('zprv-secret').length;
        expect(codesDrawn()).toBe(1);
        await fireEvent.press(screen.getByText('zprv-secret'));
        expect(codesDrawn()).toBe(2);

        await act(() => {
            settingsStore.loggedIn = false;
        });
        expect(codesDrawn()).toBe(1);

        await act(() => {
            settingsStore.loggedIn = true;
        });
        expect(codesDrawn()).toBe(2);
    });
});
