jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#ffffff' }));

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import Metadata from './Metadata';

const mount = (metadata: string) =>
    render(<Metadata metadata={metadata} showArrow={false} />);

const textShown = () =>
    screen.container.queryAll((n) => n.type === 'Text')[0]?.props.children;
const images = () => screen.container.queryAll((n) => n.type === 'Image');

describe('LnurlPayMetadata', () => {
    it('shows the text/plain entry and the image of LUD-06 metadata', async () => {
        await mount(
            JSON.stringify([
                ['text/plain', 'Tips%20for%20Polar%20Cafe'],
                ['image/png;base64', 'iVBORw0KGgo=']
            ])
        );

        expect(textShown()).toBe('Tips for Polar Cafe');
        expect(images()[0].props.source.uri).toBe(
            'data:image/png;base64,iVBORw0KGgo='
        );
    });

    it.each([
        '',
        'not json',
        '{}',
        '1',
        'null',
        'true',
        '"abc"',
        '[null]',
        '[1]',
        '[[]]',
        '[[null,1]]',
        '[["text/plain",{"a":1}]]',
        '[["text/plain",["x"]]]',
        '[["image/png;base64",null]]'
    ])('renders metadata that is not LUD-06 as empty: %s', async (metadata) => {
        await mount(metadata);

        expect(textShown()).toBeUndefined();
        expect(images()).toHaveLength(0);
    });

    it('keeps the well-formed pairs next to malformed ones', async () => {
        await mount(
            JSON.stringify([
                null,
                ['text/plain', 'Polar Cafe'],
                ['image/png;base64', 42],
                'x'
            ])
        );

        expect(textShown()).toBe('Polar Cafe');
        expect(images()).toHaveLength(0);
    });
});
