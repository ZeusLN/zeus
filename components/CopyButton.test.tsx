jest.mock('@react-native-clipboard/clipboard', () => ({
    __esModule: true,
    default: { setString: jest.fn(), getString: jest.fn() }
}));
jest.mock('../utils/ClipboardUtils', () => ({
    copySensitive: jest.fn()
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('@rneui/themed', () => {
    const { Text } = require('react-native');
    return { Icon: ({ name }: any) => <Text>{name}</Text> };
});
jest.mock('./Button', () => {
    const { TouchableOpacity, Text } = require('react-native');
    return ({ title, onPress }: any) => (
        <TouchableOpacity accessibilityRole="button" onPress={onPress}>
            <Text>{title}</Text>
        </TouchableOpacity>
    );
});

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Clipboard from '@react-native-clipboard/clipboard';

import CopyButton from './CopyButton';
import { copySensitive } from '../utils/ClipboardUtils';

describe('CopyButton', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('copies a plain value without scheduling a clear', async () => {
        await render(<CopyButton copyValue="bc1qaddress" />);

        await fireEvent.press(screen.getByRole('button'));

        expect(Clipboard.setString).toHaveBeenCalledWith('bc1qaddress');
        expect(copySensitive).not.toHaveBeenCalled();
    });

    it('copies a sensitive value through copySensitive', async () => {
        await render(<CopyButton copyValue="seed words" sensitive />);

        await fireEvent.press(screen.getByRole('button'));

        expect(copySensitive).toHaveBeenCalledWith('seed words');
        expect(Clipboard.setString).not.toHaveBeenCalled();
    });

    it('routes the icon-only variant the same way', async () => {
        await render(<CopyButton copyValue="seed words" sensitive iconOnly />);

        // the icon-only variant is a bare TouchableOpacity around the icon
        await fireEvent.press(screen.getByText('content-copy'));

        expect(copySensitive).toHaveBeenCalledWith('seed words');
    });
});
