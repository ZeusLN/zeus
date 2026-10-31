jest.mock('mobx-react', () => ({
    observer: (component: any) => component
}));

// The selected theme stays Dark; every preview below draws another theme
jest.mock('../../stores/Stores', () => ({
    settingsStore: { settings: { display: { theme: 'dark' } } }
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));

jest.mock('../LinearGradient', () => {
    const { View } = require('react-native');
    return (props: any) => <View testID="linear" {...props} />;
});
jest.mock('../RadialGradient', () => {
    const { View } = require('react-native');
    return (props: any) => <View testID="radial" {...props} />;
});
jest.mock('../SVG/LightningSvg', () => {
    const { View } = require('react-native');
    return (props: any) => <View testID="lightning-svg" {...props} />;
});
jest.mock('../SVG/OnChainSvg', () => {
    const { View } = require('react-native');
    return (props: any) => <View testID="onchain-svg" {...props} />;
});
jest.mock('react-native-qrcode-svg', () => {
    const { View } = require('react-native');
    return (props: any) => <View testID="qr" {...props} />;
});

jest.mock('../../assets/images/SVG/Add.svg', () => 'AddIcon');
jest.mock('../../assets/images/SVG/Arrow_left.svg', () => 'ArrowLeftIcon');
jest.mock('../../assets/images/SVG/Bitcoin.svg', () => 'BitcoinIcon');
jest.mock('../../assets/images/SVG/Caret Up.svg', () => 'CaretUpIcon');
jest.mock('../../assets/images/SVG/Channels.svg', () => 'ChannelsIcon');
jest.mock('../../assets/images/SVG/DeleteKey.svg', () => 'DeleteKeyIcon');
jest.mock('../../assets/images/SVG/Menu.svg', () => 'MenuIcon');
jest.mock('../../assets/images/SVG/Scan.svg', () => 'ScanIcon');
jest.mock('../../assets/images/SVG/Search.svg', () => 'SearchIcon');
jest.mock('../../assets/images/SVG/Temple.svg', () => 'TempleIcon');

import * as React from 'react';
import { StyleSheet } from 'react-native';
import { configure, render, screen } from '@testing-library/react-native';

import ThemePreview, { THEME_PREVIEW_VIEWS, ThemePreviewView } from './index';
import BalancePreview from './BalancePreview';
import ReceivePreview from './ReceivePreview';
import { BASE_WIDTH, PREVIEW_ASPECT_RATIO } from './constants';
import { themeColorFor } from '../../utils/ThemeUtils';

// The preview hides itself from screen readers, which also hides it from
// the default queries
configure({ defaultIncludeHiddenElements: true });

const renderPreview = (theme: string, view: ThemePreviewView, width = 195) =>
    render(<ThemePreview theme={theme} view={view} width={width} />);

const colorOf = (text: string) =>
    StyleSheet.flatten(screen.getByText(text).props.style).color;

const backgrounds = () =>
    screen.container
        .queryAll((node) => node.type === 'View')
        .map((node) => StyleSheet.flatten(node.props.style)?.backgroundColor)
        .filter(Boolean);

describe('ThemePreview', () => {
    it('scales the mock to the requested width', async () => {
        await renderPreview('ember', 'balance', 195);
        const nodes = screen.container.queryAll((node) => node.type === 'View');
        const frame = StyleSheet.flatten(nodes[0].props.style);
        expect(frame.width).toBe(195);
        expect(frame.height).toBe(195 * PREVIEW_ASPECT_RATIO);
        const canvas = StyleSheet.flatten(nodes[1].props.style);
        expect(canvas.width).toBe(BASE_WIDTH);
        expect(canvas.transform).toEqual([{ scale: 195 / BASE_WIDTH }]);
    });

    it("draws the previewed theme's background, not the selected one", async () => {
        // The channels mock has no gradients of its own
        await renderPreview('ember', 'channels');
        expect(screen.getByTestId('radial')).toHaveProp('colors', [
            '#4D3300',
            '#332200',
            '#170F00',
            '#000000'
        ]);
        expect(screen.queryByTestId('linear')).toBeNull();
    });

    describe('balance', () => {
        it('fills the layer rows with the button background', async () => {
            await renderPreview('ember', 'balance');
            const rows = screen
                .getAllByTestId('linear')
                .map((row) => row.props.colors);
            expect(rows).toEqual([
                ['#FFA900', '#FFA900'],
                ['#FFA900', '#FFA900']
            ]);
            expect(colorOf('general.lightning')).toBe('#1A1814');
            expect(screen.getByTestId('lightning-svg')).toHaveProp(
                'theme',
                'ember'
            );
            expect(screen.getByTestId('onchain-svg')).toHaveProp(
                'theme',
                'ember'
            );
        });

        it('prefers the button gradient when the theme has one', async () => {
            await renderPreview('kyriaki', 'balance');
            const rows = screen
                .getAllByTestId('linear')
                .map((row) => row.props.colors)
                // The first linear gradient is the screen background
                .slice(1);
            expect(rows).toEqual([
                ['#FF9000', '#FFA900'],
                ['#FF9000', '#FFA900']
            ]);
        });

        it('falls back to the secondary color without button colors', async () => {
            await renderPreview('blueberry', 'balance');
            const rows = screen
                .getAllByTestId('linear')
                .map((row) => row.props.colors)
                .slice(1);
            expect(rows).toEqual([
                ['#064490', '#064490'],
                ['#064490', '#064490']
            ]);
        });
    });

    it('draws keypad buttons in the button colors', async () => {
        await renderPreview('ember', 'keypad');
        expect(colorOf('general.request')).toBe('#1A1814');
        expect(colorOf('general.send')).toBe('#1A1814');
        expect(colorOf('5')).toBe('#FFFFFF');
        expect(backgrounds()).toContain('#FFA900');
    });

    it('draws channel bars in the outbound and inbound colors', async () => {
        await renderPreview('ember', 'channels');
        const colors = backgrounds();
        expect(colors).toContain('#FFA900');
        expect(colors).toContain('#5E5442');
        // Dark's outbound color must not leak in
        expect(colors).not.toContain('#FFD93F');
    });

    describe('receive', () => {
        it('draws the QR in the theme QR colors', async () => {
            await renderPreview('ember', 'receive');
            const qr = screen.getByTestId('qr');
            expect(qr).toHaveProp('color', '#000');
            expect(qr).toHaveProp('backgroundColor', '#FFA900');
            expect(qr).toHaveProp('logoBackgroundColor', '#FFA900');
            expect(qr).toHaveProp(
                'logo',
                require('../../assets/images/icon_black.png')
            );
        });

        it('uses the white logo for themes that invert QR icons', async () => {
            await renderPreview('pub', 'receive');
            expect(screen.getByTestId('qr')).toHaveProp(
                'logo',
                require('../../assets/images/icon_white.png')
            );
        });

        it('falls back to black on white for themes without QR colors', async () => {
            await renderPreview('light', 'receive');
            const qr = screen.getByTestId('qr');
            expect(qr).toHaveProp('color', 'black');
            expect(qr).toHaveProp('backgroundColor', 'white');
        });
    });

    describe('a theme without buttonText', () => {
        // Every shipped theme resolves buttonText through its fallback
        // palette, so this palette is Dark with the key removed
        const color = (key: string) =>
            key === 'buttonText' ? undefined : themeColorFor('dark', key);

        // Amount, which the real rows and QR panel use, falls back to text
        // for the number and secondaryText for the unit
        it('colors the layer row amounts like Amount does', async () => {
            await render(<BalancePreview theme="dark" color={color} />);
            expect(colorOf('845,210')).toBe(color('text'));
            const units = screen.getAllByText(' general.sats');
            // The first unit belongs to the total balance
            expect(StyleSheet.flatten(units[1].props.style).color).toBe(
                color('secondaryText')
            );
        });

        it('colors the QR amount panel like Amount does', async () => {
            await render(<ReceivePreview color={color} />);
            expect(colorOf('250,000')).toBe(color('text'));
            expect(colorOf(' general.sats')).toBe(color('secondaryText'));
        });
    });

    it.each(['dark', 'light', 'purple', 'popsicle', 'gilded', 'orange'])(
        'renders every view for %s',
        async (theme) => {
            for (const view of THEME_PREVIEW_VIEWS) {
                await renderPreview(theme, view);
                expect(screen.container.children.length).toBeGreaterThan(0);
            }
        }
    );
});
