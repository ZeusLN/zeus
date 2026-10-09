import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

jest.mock('./PinPad', () => () => null);
jest.mock('./PinCircles', () => () => null);
jest.mock('./ShowHideToggle', () => () => null);

import Pin from './Pin';
import PinCircles from './PinCircles';
import PinPad from './PinPad';
import ShowHideToggle from './ShowHideToggle';

const props = {
    onSubmit: jest.fn(),
    hidePinLength: false,
    pinLength: 4,
    pinConfirm: true
};

// two of four digits typed, show-PIN switched on
const renderWithTwoDigitsShown = () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
        tree = renderer.create(<Pin {...props} />);
    });
    act(() => tree!.root.findByType(PinPad).props.appendValue('1'));
    act(() => tree!.root.findByType(PinPad).props.appendValue('2'));
    act(() => tree!.root.findByType(ShowHideToggle).props.onPress());
    return tree!;
};

const shownText = (tree: renderer.ReactTestRenderer) =>
    tree.root.findAllByType(Text).map((node) => node.props.children);

const padContainerStyle = (tree: renderer.ReactTestRenderer) =>
    tree.root.findByType(PinPad).parent!.props.style;

describe('Pin', () => {
    it('shows the typed digits and leaves the pad usable when enabled', () => {
        const tree = renderWithTwoDigitsShown();
        expect(shownText(tree)).toEqual(['12']);
        expect(tree.root.findAllByType(PinCircles)).toHaveLength(0);
        expect(padContainerStyle(tree)).toMatchObject({
            opacity: 1,
            pointerEvents: 'auto'
        });

        act(() => tree.root.findByType(ShowHideToggle).props.onPress());
        expect(tree.root.findByType(PinCircles).props.numFilled).toBe(2);
    });

    it('fills all circles, hides the PIN and locks the pad when disabled', () => {
        const tree = renderWithTwoDigitsShown();
        act(() => tree.update(<Pin {...props} disabled />));
        expect(shownText(tree)).toEqual([]);
        expect(tree.root.findByType(PinCircles).props.numFilled).toBe(4);
        expect(padContainerStyle(tree)).toMatchObject({
            opacity: 0.25,
            pointerEvents: 'none'
        });
    });
});
