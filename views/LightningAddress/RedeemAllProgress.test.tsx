import * as React from 'react';
import { act, render, screen } from '@testing-library/react-native';

jest.mock('../../components/Amount', () => {
    const { Text } = require('react-native');
    return ({ sats }: any) => <Text testID="amount">{String(sats)}</Text>;
});
jest.mock('../../components/Text', () => {
    const { Text } = require('react-native');
    return ({ children, style }: any) => <Text style={style}>{children}</Text>;
});
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string, substitutions?: any) =>
        substitutions ? `${key} ${JSON.stringify(substitutions)}` : key
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));

import RedeemAllProgress, { COUNT_UP_DURATION_MS } from './RedeemAllProgress';

const amount = () => Number(screen.getByTestId('amount').props.children);

describe('RedeemAllProgress', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('shows how many of the payments have been redeemed', async () => {
        await render(
            <RedeemAllProgress redeemed={3} total={7} amountMsat={0} />
        );

        expect(
            screen.getByText(
                'views.Settings.LightningAddress.redeemAllProgress {"redeemed":3,"total":7}'
            )
        ).toBeTruthy();
    });

    it('starts at the amount it is given', async () => {
        await render(
            <RedeemAllProgress redeemed={1} total={2} amountMsat={21000} />
        );

        expect(amount()).toBe(21);
    });

    it('counts up to a new amount in whole sats', async () => {
        const { rerender } = await render(
            <RedeemAllProgress redeemed={0} total={2} amountMsat={0} />
        );

        await rerender(
            <RedeemAllProgress redeemed={1} total={2} amountMsat={100000} />
        );
        await act(async () => {
            jest.advanceTimersByTime(COUNT_UP_DURATION_MS / 4);
        });
        const partway = amount();
        expect(partway).toBeGreaterThan(0);
        expect(partway).toBeLessThan(100);
        expect(Number.isInteger(partway)).toBe(true);

        await act(async () => {
            jest.advanceTimersByTime(COUNT_UP_DURATION_MS);
        });
        expect(amount()).toBe(100);
    });

    it('lands on the exact amount, including millisats', async () => {
        const { rerender } = await render(
            <RedeemAllProgress redeemed={0} total={2} amountMsat={0} />
        );

        await rerender(
            <RedeemAllProgress redeemed={1} total={2} amountMsat={1500} />
        );
        await act(async () => {
            jest.advanceTimersByTime(COUNT_UP_DURATION_MS * 2);
        });

        expect(amount()).toBe(1.5);
    });

    it('counts up from the previous total, not from zero', async () => {
        const { rerender } = await render(
            <RedeemAllProgress redeemed={1} total={3} amountMsat={50000} />
        );

        await rerender(
            <RedeemAllProgress redeemed={2} total={3} amountMsat={60000} />
        );
        await act(async () => {
            jest.advanceTimersByTime(COUNT_UP_DURATION_MS / 4);
        });
        expect(amount()).toBeGreaterThanOrEqual(50);
        expect(amount()).toBeLessThan(60);

        await act(async () => {
            jest.advanceTimersByTime(COUNT_UP_DURATION_MS);
        });
        expect(amount()).toBe(60);
    });
});
