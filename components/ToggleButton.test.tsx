import React from 'react';
import { Dimensions, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn((key: string) => `theme:${key}`)
}));

import ToggleButton from './ToggleButton';

const options = [
    { key: 'a', label: 'A' },
    { key: 'b', label: 'B' }
];

const render = () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
        tree = renderer.create(
            <ToggleButton options={options} value="a" onToggle={jest.fn()} />
        );
    });
    return tree!;
};

const trackWidth = (tree: renderer.ReactTestRenderer) =>
    tree.root.findAllByType(View)[1].props.style.width;

const layout = (tree: renderer.ReactTestRenderer, width: number) =>
    act(() => {
        tree.root.findAllByType(View)[0].props.onLayout({
            nativeEvent: { layout: { width, height: 40, x: 0, y: 0 } }
        });
    });

describe('ToggleButton', () => {
    it('assumes the window width before it is measured', () => {
        const tree = render();
        expect(trackWidth(tree)).toBe(Dimensions.get('window').width - 32);
    });

    it('sizes the track from its own layout', () => {
        const tree = render();
        layout(tree, 600);
        expect(trackWidth(tree)).toBe(568);
    });

    it('resizes the track when its layout changes', () => {
        const tree = render();
        layout(tree, 600);
        layout(tree, 360);
        expect(trackWidth(tree)).toBe(328);
    });
});
