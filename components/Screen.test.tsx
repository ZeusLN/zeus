jest.mock('mobx-react', () => ({
    observer: (component: any) => component
}));
import React from 'react';
import { Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

jest.mock('./LinearGradient', () => 'LinearGradient');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn((key: string) => `theme:${key}`)
}));

import Screen from './Screen';
import { MAX_CONTENT_WIDTH } from '../utils/LayoutUtils';

const contentStyle = (element: React.ReactElement) => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
        tree = renderer.create(element);
    });
    return tree!.root.findByType(View).props.style;
};

describe('Screen', () => {
    it('lets content fill the window by default', () => {
        expect(
            contentStyle(
                <Screen>
                    <Text>content</Text>
                </Screen>
            )
        ).toEqual({ flex: 1 });
    });

    it('centers content in a limited-width column with limitWidth', () => {
        expect(
            contentStyle(
                <Screen limitWidth>
                    <Text>content</Text>
                </Screen>
            )
        ).toEqual({
            flex: 1,
            width: '100%',
            maxWidth: MAX_CONTENT_WIDTH,
            alignSelf: 'center'
        });
    });
});
