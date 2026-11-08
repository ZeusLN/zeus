jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('react-native-svg', () => ({
    Svg: 'Svg',
    Circle: 'Circle',
    Defs: 'Defs',
    Line: 'Line',
    Mask: 'Mask',
    Path: 'Path',
    Rect: 'Rect'
}));

import * as React from 'react';
import { render, screen } from '@testing-library/react-native';

import MatiSvg from './MatiSvg';

const all = (type: string) =>
    screen.container
        .queryAll((n: any) => n.type === type)
        .map((n: any) => n.props);

describe('MatiSvg', () => {
    it('draws the eye on a background circle by default', async () => {
        await render(<MatiSvg />);

        expect(all('Svg')[0].viewBox).toBe('0 0 50 50');
        expect(all('Circle')).toHaveLength(1);
        expect(all('Path')[0].fill).toBe('theme:chain');
        expect(all('Line')).toHaveLength(0);
        expect(all('Mask')).toHaveLength(0);
    });

    it('crops to the eye without the circle', async () => {
        await render(<MatiSvg circle={false} color="#123456" />);

        expect(all('Svg')[0].viewBox).toBe('14 14 22 22');
        expect(all('Circle')).toHaveLength(0);
        expect(all('Path')[0].fill).toBe('#123456');
    });

    it('crosses out the eye with a gap around the slash when off', async () => {
        await render(<MatiSvg circle={false} off color="#123456" />);

        const eye = all('Path')[0];
        expect(eye.mask).toBe('url(#matiSlashGap)');
        expect(all('Mask')[0].id).toBe('matiSlashGap');
        // one line cuts the gap inside the mask, the other is the slash
        const [gap, slash] = all('Line');
        expect(gap.stroke).toBe('black');
        expect(slash.stroke).toBe('#123456');
        expect(Number(gap.strokeWidth)).toBeGreaterThan(
            Number(slash.strokeWidth)
        );
    });
});
