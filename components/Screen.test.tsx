jest.mock('mobx-react', () => ({
    observer: (component: any) => component
}));
import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

jest.mock('./LinearGradient', () => 'LinearGradient');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn((key: string) => `theme:${key}`)
}));

import Screen from './Screen';
import { MAX_CONTENT_WIDTH } from '../utils/LayoutUtils';

const contentStyle = async (element: React.ReactElement) => {
    await render(element);
    return screen.getByText('content').parent!.props.style;
};

describe('Screen', () => {
    it('lets content fill the window by default', async () => {
        expect(
            await contentStyle(
                <Screen>
                    <Text>content</Text>
                </Screen>
            )
        ).toEqual({ flex: 1 });
    });

    it('centers content in a limited-width column with limitWidth', async () => {
        expect(
            await contentStyle(
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
