jest.mock('mobx-react', () => ({
    observer: (component: any) => component
}));
jest.mock('../utils/LocaleUtils', () => ({ localeString: (s: string) => s }));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../stores/TransactionsStore', () => ({}));
const mockUseIsFocused = jest.fn(() => true);
jest.mock('@react-navigation/native', () => ({
    useIsFocused: () => mockUseIsFocused()
}));

import * as React from 'react';
import { render, screen } from '@testing-library/react-native';

import OnchainSendInFlightNotice from './OnchainSendInFlightNotice';

const renderNotice = (onchainSendInFlight: boolean) =>
    render(
        <OnchainSendInFlightNotice
            TransactionsStore={{ onchainSendInFlight } as any}
        />
    );

describe('OnchainSendInFlightNotice', () => {
    afterEach(() => {
        mockUseIsFocused.mockReturnValue(true);
    });

    it('renders nothing when no on-chain send is in flight', async () => {
        await renderNotice(false);
        expect(screen.toJSON()).toBeNull();
    });

    it('explains the wait while an on-chain send is in flight', async () => {
        await renderNotice(true);
        expect(
            screen.getByText('components.OnchainSendInFlightNotice.text')
        ).toBeTruthy();
    });

    // the screen that just dispatched the send renders again while it
    // navigates away to SendingOnChain; it must not call that send
    // "a previous on-chain send"
    it('renders nothing on an unfocused screen', async () => {
        mockUseIsFocused.mockReturnValue(false);
        await renderNotice(true);
        expect(screen.toJSON()).toBeNull();
    });
});
