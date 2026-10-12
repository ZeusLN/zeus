import React from 'react';
import { Dimensions, ScaledSize } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import Svg from 'react-native-svg';

import LinearGradient from './LinearGradient';

const size = (width: number, height: number): ScaledSize => ({
    width,
    height,
    scale: 2,
    fontScale: 1
});

const resize = (width: number, height: number) =>
    act(() => {
        Dimensions.set({
            window: size(width, height),
            screen: size(width, height)
        });
    });

describe('LinearGradient', () => {
    // The native Svg view keeps its first frame after a resize, so it is
    // re-mounted whenever the window size changes.
    it('re-mounts the gradient when the window is resized', () => {
        resize(820, 1180);
        let tree: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(
                <LinearGradient colors={['#000', '#fff']} />
            );
        });
        const before = tree!.root.findByType(Svg).instance;

        resize(1180, 820);
        const after = tree!.root.findByType(Svg).instance;

        expect(after).not.toBe(before);
    });

    it('keeps the gradient mounted when the window size does not change', () => {
        resize(820, 1180);
        let tree: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(
                <LinearGradient colors={['#000', '#fff']} />
            );
        });
        const before = tree!.root.findByType(Svg).instance;

        act(() => {
            tree.update(<LinearGradient colors={['#111', '#eee']} />);
        });

        expect(tree!.root.findByType(Svg).instance).toBe(before);
    });
});
