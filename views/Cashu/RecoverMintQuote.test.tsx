jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/CashuStore', () => ({}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000',
    placeholderColor: () => '#000000'
}));
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress, disabled }: any) => (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            disabled={disabled}
        >
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../components/EcashMintPicker', () => 'EcashMintPicker');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import RecoverMintQuote from './RecoverMintQuote';

const DEFERRED = 'views.Cashu.RecoverMintQuote.restoreDeferred';
const RECOVER = 'views.Cashu.RecoverMintQuote.recoverButton';

const recoverWith = async (result: any) => {
    const CashuStore = {
        selectedMintUrl: 'https://a.mint',
        checkInvoicePaid: jest.fn().mockResolvedValue(result)
    };
    await render(
        <RecoverMintQuote {...({ navigation: {}, CashuStore } as any)} />
    );
    await fireEvent.changeText(
        screen.getByPlaceholderText(
            'views.Cashu.RecoverMintQuote.quoteIdPlaceholder'
        ),
        'quote-x'
    );
    await fireEvent.press(screen.getByText(RECOVER));
    return CashuStore;
};

describe('RecoverMintQuote', () => {
    it('explains why an issued quote was not restored (#5567)', async () => {
        const store = await recoverWith({
            isPaid: false,
            restoreDeferred: true
        });

        expect(store.checkInvoicePaid).toHaveBeenCalledWith(
            'quote-x',
            'https://a.mint'
        );
        expect(screen.getByText(DEFERRED)).toBeTruthy();
        expect(
            screen.queryByText('views.Cashu.RecoverMintQuote.notOnDevice')
        ).toBeNull();
    });

    it('does not show the message for a quote that is not paid', async () => {
        await recoverWith({ isPaid: false, quoteState: 'UNPAID' });

        expect(screen.queryByText(DEFERRED)).toBeNull();
        expect(
            screen.getByText('views.Cashu.RecoverMintQuote.notReady')
        ).toBeTruthy();
    });

    it('drops the message when the quote ID is edited', async () => {
        await recoverWith({ isPaid: false, restoreDeferred: true });

        await fireEvent.changeText(
            screen.getByPlaceholderText(
                'views.Cashu.RecoverMintQuote.quoteIdPlaceholder'
            ),
            'quote-y'
        );

        expect(screen.queryByText(DEFERRED)).toBeNull();
    });
});
