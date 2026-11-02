jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#ffffff' }));
jest.mock('../../utils/LocaleUtils');

import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import LnurlPaySuccess from './Success';

const renderUrlAction = (url: string) =>
    render(
        <LnurlPaySuccess
            domain="pay.example.com"
            preimage={'00'.repeat(32)}
            successAction={
                {
                    tag: 'url',
                    description: 'Your receipt',
                    url
                } as any
            }
        />
    );

describe('LNURL-pay url success action', () => {
    let canOpenURL: jest.SpyInstance;
    let openURL: jest.SpyInstance;

    beforeEach(() => {
        canOpenURL = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
        openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
        // the react-native jest preset already mocks Linking
        canOpenURL.mockClear();
        openURL.mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('opens an https url', async () => {
        await renderUrlAction('https://pay.example.com/receipt/1');

        await fireEvent.press(screen.getByText('Your receipt'));
        await new Promise(setImmediate);

        expect(openURL).toHaveBeenCalledWith(
            'https://pay.example.com/receipt/1'
        );
    });

    it.each([
        'http://pay.example.com/receipt/1',
        'intent://scan/#Intent;scheme=zxing;end',
        // eslint-disable-next-line no-script-url -- rejected input
        'javascript:alert(1)',
        'zeusln:lnbc1'
    ])('shows %s as text without opening it', async (url) => {
        await renderUrlAction(url);

        expect(screen.getByText(url)).toBeOnTheScreen();
        await fireEvent.press(screen.getByText(url));
        await new Promise(setImmediate);

        expect(canOpenURL).not.toHaveBeenCalled();
        expect(openURL).not.toHaveBeenCalled();
    });
});
