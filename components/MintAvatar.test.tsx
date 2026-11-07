import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn((key: string) => `theme:${key}`)
}));
jest.mock('../assets/images/SVG/Ecash.svg', () => 'Ecash');

import MintAvatar from './MintAvatar';

const imageUris = () =>
    screen.container
        .queryAll((n) => n.type === 'Image')
        .map((n) => n.props.source?.uri);

describe('MintAvatar', () => {
    it('loads an https icon on a public host', async () => {
        await render(
            <MintAvatar
                name="Mint"
                iconUrl="https://cdn.example/icon.png"
                mintUrl="https://mint.example"
            />
        );
        expect(imageUris()).toEqual(['https://cdn.example/icon.png']);
    });

    it('loads an icon served by the mint itself', async () => {
        await render(
            <MintAvatar
                name="Home mint"
                iconUrl="http://192.168.1.20:3338/icon.png"
                mintUrl="http://192.168.1.20:3338"
            />
        );
        expect(imageUris()).toEqual(['http://192.168.1.20:3338/icon.png']);
    });

    it.each([
        'http://cdn.example/icon.png',
        'http://192.168.1.1/apply.cgi?action=reboot',
        'https://127.0.0.1:8443/shutdown',
        'https://abcdefg.onion/icon.png',
        `https://${'a'.repeat(56)}.onion./icon.png`,
        'https://%zz@mint.example/icon.png'
    ])('shows initials instead of loading %p', async (iconUrl) => {
        await render(
            <MintAvatar
                name="Mint"
                iconUrl={iconUrl}
                mintUrl="https://mint.example"
            />
        );
        expect(imageUris()).toEqual([]);
        expect(screen.getByText('M')).toBeOnTheScreen();
    });
});
