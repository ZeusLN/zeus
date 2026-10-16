import React from 'react';
import { Dimensions, ScaledSize } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';

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
    it('re-mounts the gradient when the window is resized', async () => {
        await resize(820, 1180);
        await render(<LinearGradient colors={['#000', '#fff']} />);
        const before = screen.root!.children[0];

        await resize(1180, 820);
        const after = screen.root!.children[0];

        expect(after).not.toBe(before);
    });

    it('keeps the gradient mounted when the window size does not change', async () => {
        await resize(820, 1180);
        await render(<LinearGradient colors={['#000', '#fff']} />);
        const before = screen.root!.children[0];

        await screen.rerender(<LinearGradient colors={['#111', '#eee']} />);

        expect(screen.root!.children[0]).toBe(before);
    });
});
