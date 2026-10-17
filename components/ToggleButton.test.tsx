import React from 'react';
import { Dimensions } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';

jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn((key: string) => `theme:${key}`)
}));

import ToggleButton from './ToggleButton';

const options = [
    { key: 'a', label: 'A' },
    { key: 'b', label: 'B' }
];

const renderToggle = () =>
    render(<ToggleButton options={options} value="a" onToggle={jest.fn()} />);

const trackWidth = () =>
    (screen.root!.children[0] as TestInstance).props.style.width;

const layout = (width: number) =>
    fireEvent(screen.root!, 'layout', {
        nativeEvent: { layout: { width, height: 40, x: 0, y: 0 } }
    });

describe('ToggleButton', () => {
    it('assumes the window width before it is measured', async () => {
        await renderToggle();
        expect(trackWidth()).toBe(Dimensions.get('window').width - 32);
    });

    it('sizes the track from its own layout', async () => {
        await renderToggle();
        await layout(600);
        expect(trackWidth()).toBe(568);
    });

    it('resizes the track when its layout changes', async () => {
        await renderToggle();
        await layout(600);
        await layout(360);
        expect(trackWidth()).toBe(328);
    });
});
