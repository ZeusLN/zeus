import React from 'react';
import { View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#ffffff')
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('../utils/UrlUtils', () => ({ goToUrl: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
    initialWindowMetrics: { insets: { top: 40 } },
    useSafeAreaInsets: () => ({ top: 40 })
}));

import { ErrorMessage, WarningMessage } from './SuccessErrorMessage';
import ErrorBannerHost, {
    hideErrorBanner,
    showErrorBanner
} from './ErrorBanner';

const BANNER_ID = 'error-banner';
let measuredY = 300;

// the first match in the tree, ahead of the banner's copy of the message
const isInlineHidden = () =>
    screen.getAllByText('Oops', { includeHiddenElements: true })[0].parent
        ?.parent?.props.accessibilityElementsHidden;

const advance = (ms: number) =>
    act(async () => {
        jest.advanceTimersByTime(ms);
    });
const flushFrame = () => advance(120);

describe('SuccessErrorMessage', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        measuredY = 300;
        jest.spyOn(View.prototype as any, 'measureInWindow').mockImplementation(
            (callback: any) => callback(0, measuredY, 300, 60)
        );
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('does not show the banner when the error is on screen', async () => {
        await render(
            <>
                <ErrorMessage message="Oops" />
                <ErrorBannerHost />
            </>
        );
        await flushFrame();

        expect(screen.queryByTestId(BANNER_ID)).toBeNull();
    });

    it('shows the banner when the error is scrolled off screen', async () => {
        measuredY = -200;
        await render(
            <>
                <ErrorMessage message="Oops" />
                <ErrorBannerHost />
            </>
        );
        await flushFrame();

        expect(screen.getByTestId(BANNER_ID)).toBeTruthy();
        expect(isInlineHidden()).toBe(true);
    });

    it('brings the inline error back when the banner times out', async () => {
        measuredY = -200;
        await render(
            <>
                <ErrorMessage message="Oops" />
                <ErrorBannerHost />
            </>
        );
        await flushFrame();

        await advance(8000);
        await advance(300);

        expect(screen.queryByTestId(BANNER_ID)).toBeNull();
        expect(isInlineHidden()).toBe(false);
    });

    it('removes the inline error when the banner is closed', async () => {
        measuredY = -200;
        await render(
            <>
                <ErrorMessage message="Oops" />
                <ErrorBannerHost />
            </>
        );
        await flushFrame();

        await fireEvent.press(screen.getByLabelText('general.close'));
        await advance(300);

        expect(screen.queryByTestId(BANNER_ID)).toBeNull();
        expect(
            screen.queryByText('Oops', { includeHiddenElements: true })
        ).toBeNull();
    });

    it('lets a dismissable screen clear its error from the banner', async () => {
        measuredY = -200;
        const onPress = jest.fn();
        await render(
            <>
                <ErrorMessage message="Oops" dismissable onPress={onPress} />
                <ErrorBannerHost />
            </>
        );
        await flushFrame();

        await fireEvent.press(screen.getByLabelText('general.close'));

        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does not fire onPress when the banner closes a plain error', async () => {
        measuredY = -200;
        const onPress = jest.fn();
        await render(
            <>
                <ErrorMessage message="Oops" onPress={onPress} />
                <ErrorBannerHost />
            </>
        );
        await flushFrame();

        await fireEvent.press(screen.getByLabelText('general.close'));

        expect(onPress).not.toHaveBeenCalled();
    });

    it('shows a different error after the banner was closed', async () => {
        measuredY = -200;
        const Host = ({ error }: { error: string }) => (
            <>
                <ErrorMessage message={error} />
                <ErrorBannerHost />
            </>
        );
        const { rerender } = await render(<Host error="Oops" />);
        await flushFrame();
        await fireEvent.press(screen.getByLabelText('general.close'));
        await advance(300);

        await rerender(<Host error="Other" />);
        await flushFrame();

        expect(screen.getByTestId(BANNER_ID)).toBeTruthy();
    });

    it('swaps to the inline error when it is scrolled into view', async () => {
        measuredY = -200;
        await render(
            <>
                <ErrorMessage message="Oops" />
                <ErrorBannerHost />
            </>
        );
        await flushFrame();
        expect(screen.getByTestId(BANNER_ID)).toBeTruthy();

        measuredY = 300;
        await flushFrame();
        await advance(300);

        expect(screen.queryByTestId(BANNER_ID)).toBeNull();
        expect(isInlineHidden()).toBe(false);
    });

    it('shows the banner when a visible error is scrolled away', async () => {
        await render(
            <>
                <ErrorMessage message="Oops" />
                <ErrorBannerHost />
            </>
        );
        await flushFrame();
        expect(screen.queryByTestId(BANNER_ID)).toBeNull();

        measuredY = -200;
        await flushFrame();

        expect(screen.getByTestId(BANNER_ID)).toBeTruthy();
    });

    it('keeps the current view while the error rests at the edge', async () => {
        await render(
            <>
                <ErrorMessage message="Oops" />
                <ErrorBannerHost />
            </>
        );
        await flushFrame();

        // about three quarters of the 60pt card is below the header
        measuredY = 40 + 56 - 15;
        await flushFrame();
        expect(screen.queryByTestId(BANNER_ID)).toBeNull();

        measuredY = -200;
        await flushFrame();
        measuredY = 40 + 56 - 15;
        await flushFrame();
        expect(screen.getByTestId(BANNER_ID)).toBeTruthy();
    });

    it('does not bring a closed banner back on scroll', async () => {
        measuredY = -200;
        await render(
            <>
                <ErrorMessage message="Oops" />
                <ErrorBannerHost />
            </>
        );
        await flushFrame();

        await fireEvent.press(screen.getByLabelText('general.close'));
        await advance(300);
        measuredY = 300;
        await flushFrame();
        measuredY = -200;
        await flushFrame();

        expect(screen.queryByTestId(BANNER_ID)).toBeNull();
    });

    it('removes the banner when the error is cleared', async () => {
        measuredY = -200;
        const Host = ({ error }: { error?: string }) => (
            <>
                {!!error && <ErrorMessage message={error} />}
                <ErrorBannerHost />
            </>
        );
        const { rerender } = await render(<Host error="Oops" />);
        await flushFrame();
        expect(screen.getByTestId(BANNER_ID)).toBeTruthy();

        await rerender(<Host />);
        await advance(300);

        expect(screen.queryByTestId(BANNER_ID)).toBeNull();
    });

    it('shows an error raised before the host subscribed', async () => {
        showErrorBanner(9001, 'Early', () => {});
        await render(<ErrorBannerHost />);
        await flushFrame();

        expect(screen.getByTestId(BANNER_ID)).toBeTruthy();
        expect(screen.getByText('Early')).toBeTruthy();

        await act(async () => hideErrorBanner(9001));
    });

    it('does not truncate a long error in the banner', async () => {
        const message = 'Long error. '.repeat(40);
        showErrorBanner(9002, message, () => {});
        await render(<ErrorBannerHost />);
        await flushFrame();

        expect(screen.getByText(message.trim())).not.toHaveProp(
            'numberOfLines'
        );

        await act(async () => hideErrorBanner(9002));
    });

    it('keeps a long error up for longer before timing out', async () => {
        const message = 'Long error. '.repeat(40);
        showErrorBanner(9003, message, () => {});
        await render(<ErrorBannerHost />);
        await advance(8300);
        expect(screen.getByTestId(BANNER_ID)).toBeTruthy();

        await advance(21000);
        await advance(300);
        expect(screen.queryByTestId(BANNER_ID)).toBeNull();
    });

    it('never promotes a warning to the banner', async () => {
        measuredY = -200;
        await render(
            <>
                <WarningMessage message="Careful" />
                <ErrorBannerHost />
            </>
        );
        await flushFrame();

        expect(screen.queryByTestId(BANNER_ID)).toBeNull();
    });

    it('shows a new error after a previous one was dismissed', async () => {
        const { rerender } = await render(
            <ErrorMessage message="One" dismissable />
        );
        await fireEvent.press(screen.getByText('One'));
        expect(screen.queryByText('One')).toBeNull();

        await rerender(<ErrorMessage message="Two" dismissable />);

        expect(screen.getByText('Two')).toBeTruthy();
    });
});
