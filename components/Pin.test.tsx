import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

jest.mock('./PinPad', () => 'PinPad');
jest.mock('./PinCircles', () => 'PinCircles');
jest.mock('./ShowHideToggle', () => 'ShowHideToggle');

import Pin from './Pin';

const props = {
    onSubmit: jest.fn(),
    hidePinLength: false,
    pinLength: 4,
    pinConfirm: true
};

const nodes = (type: string) =>
    screen.container.queryAll((node) => node.type === type);
const node = (type: string) => nodes(type)[0];

// two of four digits typed, show-PIN switched on
const renderWithTwoDigitsShown = async () => {
    const view = await render(<Pin {...props} />);
    await act(() => node('PinPad').props.appendValue('1'));
    await act(() => node('PinPad').props.appendValue('2'));
    await act(() => node('ShowHideToggle').props.onPress());
    return view;
};

const shownText = () => nodes('Text').map((text) => text.props.children);

const padContainerStyle = () => node('PinPad').parent!.props.style;

describe('Pin', () => {
    it('shows the typed digits and leaves the pad usable when enabled', async () => {
        await renderWithTwoDigitsShown();
        expect(shownText()).toEqual(['12']);
        expect(nodes('PinCircles')).toHaveLength(0);
        expect(padContainerStyle()).toMatchObject({
            opacity: 1,
            pointerEvents: 'auto'
        });

        await act(() => node('ShowHideToggle').props.onPress());
        expect(node('PinCircles').props.numFilled).toBe(2);
    });

    it('fills all circles, hides the PIN and locks the pad when disabled', async () => {
        const view = await renderWithTwoDigitsShown();
        await view.rerender(<Pin {...props} disabled />);
        expect(shownText()).toEqual([]);
        expect(node('PinCircles').props.numFilled).toBe(4);
        expect(padContainerStyle()).toMatchObject({
            opacity: 0.25,
            pointerEvents: 'none'
        });
    });
});
