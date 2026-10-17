jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: { supportsCustomFeeLimit: jest.fn() }
}));
// FeeLimit imports AmountUtils, which loads the store graph and its native
// modules
jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: {} },
    fiatStore: {},
    unitsStore: {}
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('./Amount', () => 'Amount');
// The suffix names each field: 'general.sats' for the fixed limit, '%' for
// the percentage
jest.mock('./TextInput', () => {
    const { TextInput } = require('react-native');
    return ({ suffix, ...props }: any) => (
        <TextInput accessibilityLabel={suffix} {...props} />
    );
});

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import FeeLimit from './FeeLimit';
import BackendUtils from '../utils/BackendUtils';

beforeEach(() => {
    (BackendUtils.supportsCustomFeeLimit as jest.Mock).mockReturnValue(true);
});

const renderFeeLimit = async ({
    payments = {},
    feeEstimate,
    ...props
}: {
    payments?: Record<string, string>;
    feeEstimate?: string;
    [prop: string]: any;
} = {}) => {
    const onFeeLimitSatChange = jest.fn();
    const onMaxFeePercentChange = jest.fn();
    const onFeeOptionChange = jest.fn();
    const SettingsStore: any = {
        getSettings: jest.fn(async () => ({ payments }))
    };
    const element = (extra: Record<string, any> = {}) => (
        <FeeLimit
            {...({
                onFeeLimitSatChange,
                onMaxFeePercentChange,
                onFeeOptionChange,
                SettingsStore,
                InvoicesStore: { feeEstimate },
                ...props,
                ...extra
            } as any)}
        />
    );
    const view = await render(element());
    return {
        onFeeLimitSatChange,
        onMaxFeePercentChange,
        onFeeOptionChange,
        rerender: (extra: Record<string, any>) => view.rerender(element(extra))
    };
};

const fixedField = () => screen.getByLabelText('general.sats');
const percentField = () => screen.getByLabelText('%');
const percentShown = () =>
    screen.container.queryAll((n) => n.type === 'Amount')[0].props.sats;

describe('FeeLimit defaults', () => {
    it('starts at 100 sats and 5%', async () => {
        const { onFeeLimitSatChange } = await renderFeeLimit({
            satAmount: 10_000
        });

        expect(fixedField()).toHaveDisplayValue('100');
        expect(percentField()).toHaveDisplayValue('5.0');
        expect(percentShown()).toBe('500');
        expect(onFeeLimitSatChange).toHaveBeenLastCalledWith('100');
    });

    it('starts from the saved payment defaults', async () => {
        const { onFeeLimitSatChange } = await renderFeeLimit({
            satAmount: 10_000,
            payments: { defaultFeeFixed: '42', defaultFeePercentage: '1' }
        });

        expect(fixedField()).toHaveDisplayValue('42');
        expect(percentField()).toHaveDisplayValue('1');
        expect(percentShown()).toBe('100');
        expect(onFeeLimitSatChange).toHaveBeenLastCalledWith('42');
    });

    it('reports the percentage limit when the percent option is passed in', async () => {
        const { onFeeLimitSatChange } = await renderFeeLimit({
            satAmount: 10_000,
            feeOption: 'percent'
        });

        expect(onFeeLimitSatChange).toHaveBeenLastCalledWith('500');
        expect(percentField()).toHaveStyle({ opacity: 1 });
        expect(fixedField()).toHaveStyle({ opacity: 0.25 });
    });

    it('reports the fixed limit when the backend has no custom fee limit', async () => {
        (BackendUtils.supportsCustomFeeLimit as jest.Mock).mockReturnValue(
            false
        );
        const { onFeeLimitSatChange } = await renderFeeLimit({
            satAmount: 10_000,
            feeOption: 'percent'
        });

        expect(onFeeLimitSatChange).toHaveBeenLastCalledWith('100');
        expect(screen.queryByLabelText('%')).not.toBeOnTheScreen();
    });

    it('calculates the limit even when hidden', async () => {
        const { onFeeLimitSatChange } = await renderFeeLimit({
            satAmount: 10_000,
            feeOption: 'percent',
            hide: true
        });

        expect(screen.queryByLabelText('%')).not.toBeOnTheScreen();
        expect(onFeeLimitSatChange).toHaveBeenLastCalledWith('500');
    });
});

describe('FeeLimit percentage', () => {
    it.each([
        ['5.0', 1010, '51'],
        ['0,5', 10_000, '50'],
        ['5.0', 9, '1'],
        ['0', 10_000, '0'],
        ['1', 0, '0'],
        ['abc', 10_000, '0']
    ])(
        'turns %p of %p sats into %p sats',
        async (percent, satAmount, limit) => {
            await renderFeeLimit({
                satAmount,
                payments: { defaultFeePercentage: percent }
            });

            expect(percentShown()).toBe(limit);
        }
    );

    it.each([
        ['1', 0],
        ['abc', 10_000]
    ])(
        'reports an empty limit, not a 0 sat cap, for %p of %p sats',
        async (percent, satAmount) => {
            const { onFeeLimitSatChange } = await renderFeeLimit({
                satAmount,
                feeOption: 'percent',
                payments: { defaultFeePercentage: percent }
            });

            expect(onFeeLimitSatChange).toHaveBeenLastCalledWith('');
        }
    );

    it('reports an empty limit when the percentage is cleared', async () => {
        const { onFeeLimitSatChange } = await renderFeeLimit({
            satAmount: 10_000,
            feeOption: 'percent'
        });

        await fireEvent.changeText(percentField(), '');

        expect(percentShown()).toBe('0');
        expect(onFeeLimitSatChange).toHaveBeenLastCalledWith('');
    });

    it('reports a 0 sat limit for an explicit 0%', async () => {
        const { onFeeLimitSatChange } = await renderFeeLimit({
            satAmount: 10_000,
            feeOption: 'percent',
            payments: { defaultFeePercentage: '0' }
        });

        expect(onFeeLimitSatChange).toHaveBeenLastCalledWith('0');
    });

    it('switches to the percentage on press and reports its limit', async () => {
        const { onFeeLimitSatChange, onFeeOptionChange } = await renderFeeLimit(
            { satAmount: 10_000 }
        );

        await fireEvent(percentField(), 'pressIn');

        expect(onFeeOptionChange).toHaveBeenCalledWith('percent');
        expect(onFeeLimitSatChange).toHaveBeenLastCalledWith('500');
        expect(percentField()).toHaveStyle({ opacity: 1 });
    });

    it('recalculates the limit as the percentage is typed', async () => {
        const { onFeeLimitSatChange, onMaxFeePercentChange } =
            await renderFeeLimit({ satAmount: 10_000 });

        await fireEvent.changeText(percentField(), '2.5');

        expect(percentShown()).toBe('250');
        expect(onFeeLimitSatChange).toHaveBeenLastCalledWith('250');
        expect(onMaxFeePercentChange).toHaveBeenCalledWith('2.5');
    });

    it('recalculates the limit when the amount changes', async () => {
        const { onFeeLimitSatChange, rerender } = await renderFeeLimit({
            satAmount: 10_000,
            feeOption: 'percent'
        });

        await rerender({ satAmount: 20_000 });

        expect(percentShown()).toBe('1000');
        expect(onFeeLimitSatChange).toHaveBeenLastCalledWith('1000');
    });
});

describe('FeeLimit fixed', () => {
    it('reports a typed fixed limit', async () => {
        const { onFeeLimitSatChange } = await renderFeeLimit({
            satAmount: 10_000
        });

        await fireEvent.changeText(fixedField(), '250');

        expect(fixedField()).toHaveDisplayValue('250');
        expect(onFeeLimitSatChange).toHaveBeenLastCalledWith('250');
    });

    it('switches back to the fixed limit on press', async () => {
        const { onFeeLimitSatChange, onFeeOptionChange } = await renderFeeLimit(
            { satAmount: 10_000, feeOption: 'percent' }
        );

        await fireEvent(fixedField(), 'pressIn');

        expect(onFeeOptionChange).toHaveBeenCalledWith('fixed');
        expect(onFeeLimitSatChange).toHaveBeenLastCalledWith('100');
        expect(fixedField()).toHaveStyle({ opacity: 1 });
    });

    it('keeps reporting the fixed limit when the amount changes', async () => {
        const { onFeeLimitSatChange, rerender } = await renderFeeLimit({
            satAmount: 10_000
        });

        onFeeLimitSatChange.mockClear();
        await rerender({ satAmount: 20_000 });

        expect(onFeeLimitSatChange).toHaveBeenCalledTimes(1);
        expect(onFeeLimitSatChange).toHaveBeenCalledWith('100');
    });
});

describe('FeeLimit fee estimate warning', () => {
    const warning = 'views.PaymentRequest.feeEstimateExceedsLimit';

    it('warns when the estimate is over the fixed limit', async () => {
        await renderFeeLimit({
            feeEstimate: '150',
            displayFeeRecommendation: true
        });

        expect(screen.getByText(warning)).toBeOnTheScreen();
    });

    it('does not warn when the estimate fits', async () => {
        await renderFeeLimit({
            feeEstimate: '100',
            displayFeeRecommendation: true
        });

        expect(screen.queryByText(warning)).not.toBeOnTheScreen();
    });

    it('does not warn unless asked to', async () => {
        await renderFeeLimit({ feeEstimate: '150' });

        expect(screen.queryByText(warning)).not.toBeOnTheScreen();
    });
});
