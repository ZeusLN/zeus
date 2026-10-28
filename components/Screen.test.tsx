import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

jest.mock('mobx-react', () => ({
    observer: (component: any) => component
}));

const mockTheme: { [key: string]: any } = {};
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn((key: string) => mockTheme[key])
}));

jest.mock('./LinearGradient', () => {
    const { View } = require('react-native');
    return (props: any) => (
        <View testID="linear" {...props}>
            {props.children}
        </View>
    );
});

jest.mock('./RadialGradient', () => {
    const { View } = require('react-native');
    return (props: any) => (
        <View testID="radial" {...props}>
            {props.children}
        </View>
    );
});

import Screen from './Screen';

const setTheme = (theme: { [key: string]: any }) => {
    Object.keys(mockTheme).forEach((key) => delete mockTheme[key]);
    Object.assign(mockTheme, theme);
};

const renderScreen = () =>
    render(
        <Screen>
            <Text>content</Text>
        </Screen>
    );

describe('Screen', () => {
    it('fills a flat background with a two-stop linear gradient', async () => {
        setTheme({ background: '#1F242D' });
        await renderScreen();
        expect(screen.getByTestId('linear')).toHaveProp('colors', [
            '#1F242D',
            '#1F242D'
        ]);
        expect(screen.queryByTestId('radial')).toBeNull();
        expect(screen.getByText('content')).toBeTruthy();
    });

    it('passes a theme gradient and its stops to the linear gradient', async () => {
        setTheme({
            background: '#000',
            gradientBackground: ['#1E2022', '#000000'],
            gradientLocations: [0, 0.5]
        });
        await renderScreen();
        const linear = screen.getByTestId('linear');
        expect(linear).toHaveProp('colors', ['#1E2022', '#000000']);
        expect(linear).toHaveProp('locations', [0, 0.5]);
    });

    it('draws a radial gradient when the theme defines a radial shape', async () => {
        const shape = { cx: 0, cy: 0, rx: 1.4, ry: 0.8 };
        setTheme({
            background: '#000',
            gradientBackground: ['#4F473C', '#000000'],
            gradientLocations: [0, 1],
            gradientRadial: shape
        });
        await renderScreen();
        const radial = screen.getByTestId('radial');
        expect(radial).toHaveProp('colors', ['#4F473C', '#000000']);
        expect(radial).toHaveProp('locations', [0, 1]);
        expect(radial).toHaveProp('shape', shape);
        expect(screen.queryByTestId('linear')).toBeNull();
        expect(screen.getByText('content')).toBeTruthy();
    });

    it('ignores a radial shape without a gradient', async () => {
        setTheme({
            background: '#000',
            gradientRadial: { cx: 0, cy: 0, rx: 1, ry: 1 }
        });
        await renderScreen();
        expect(screen.getByTestId('linear')).toHaveProp('colors', [
            '#000',
            '#000'
        ]);
    });
});
