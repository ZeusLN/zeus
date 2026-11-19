import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { render, screen, within } from '@testing-library/react-native';

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

    describe('theme switches', () => {
        const radialTheme = {
            background: '#000',
            gradientBackground: ['#4F473C', '#000000'],
            gradientLocations: [0, 1],
            gradientRadial: { cx: 0, cy: 0, rx: 1.4, ry: 0.8 }
        };
        const linearTheme = { background: '#1F242D' };

        // Counts mounts and unmounts of the app tree under Screen. A remount
        // there re-runs every componentDidMount below it, which registered
        // PushNotificationManager's listeners a second time.
        const lifecycle = { mounts: 0, unmounts: 0 };
        const Probe = () => {
            useEffect(() => {
                lifecycle.mounts++;
                return () => {
                    lifecycle.unmounts++;
                };
            }, []);
            return <Text>content</Text>;
        };
        const tree = () => (
            <Screen>
                <Probe />
            </Screen>
        );

        beforeEach(() => {
            lifecycle.mounts = 0;
            lifecycle.unmounts = 0;
        });

        it('keeps the children mounted when a linear theme becomes radial', async () => {
            setTheme(linearTheme);
            const { rerender } = await render(tree());
            expect(screen.getByTestId('linear')).toBeTruthy();

            setTheme(radialTheme);
            await rerender(tree());
            expect(screen.getByTestId('radial')).toBeTruthy();
            expect(screen.queryByTestId('linear')).toBeNull();

            expect(lifecycle).toEqual({ mounts: 1, unmounts: 0 });
        });

        it('keeps the children mounted when a radial theme becomes linear', async () => {
            setTheme(radialTheme);
            const { rerender } = await render(tree());

            setTheme(linearTheme);
            await rerender(tree());
            expect(screen.getByTestId('linear')).toBeTruthy();

            setTheme(radialTheme);
            await rerender(tree());
            expect(screen.getByTestId('radial')).toBeTruthy();

            expect(lifecycle).toEqual({ mounts: 1, unmounts: 0 });
        });

        it.each([
            ['linear', linearTheme],
            ['radial', radialTheme]
        ])(
            'draws the %s gradient as a full-size background behind the children',
            async (testID, theme) => {
                setTheme(theme);
                await render(tree());
                const gradient = screen.getByTestId(testID);
                expect(StyleSheet.flatten(gradient.props.style)).toMatchObject({
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0
                });
                expect(within(gradient).queryByText('content')).toBeNull();
                expect(screen.getByText('content')).toBeTruthy();
            }
        );
    });
});
