import { Dimensions, ScaledSize } from 'react-native';
import { autorun } from 'mobx';

import {
    MAX_CONTENT_WIDTH,
    getContentWidth,
    getWindowDimensions
} from './LayoutUtils';

const size = (width: number, height: number): ScaledSize => ({
    width,
    height,
    scale: 3,
    fontScale: 1
});

describe('LayoutUtils', () => {
    describe('getContentWidth', () => {
        it('uses the full width on phones', () => {
            expect(getContentWidth(320)).toBe(320);
            expect(getContentWidth(440)).toBe(440);
        });

        it('caps the width on wide windows', () => {
            expect(getContentWidth(MAX_CONTENT_WIDTH)).toBe(MAX_CONTENT_WIDTH);
            expect(getContentWidth(MAX_CONTENT_WIDTH + 1)).toBe(
                MAX_CONTENT_WIDTH
            );
            expect(getContentWidth(1366)).toBe(MAX_CONTENT_WIDTH);
        });

        it('never returns a negative width', () => {
            expect(getContentWidth(0)).toBe(0);
            expect(getContentWidth(-10)).toBe(0);
        });
    });

    describe('getWindowDimensions', () => {
        it('notifies observers when the window is resized', () => {
            const widths: number[] = [];
            const dispose = autorun(() =>
                widths.push(getWindowDimensions().width)
            );

            Dimensions.set({
                window: size(390, 844),
                screen: size(390, 844)
            });
            Dimensions.set({
                window: size(844, 390),
                screen: size(844, 390)
            });
            dispose();

            expect(widths.slice(-2)).toEqual([390, 844]);
            expect(getWindowDimensions()).toEqual(size(844, 390));
        });
    });
});
