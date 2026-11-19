import React from 'react';
import { render, screen } from '@testing-library/react-native';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('react-native-gesture-handler', () => ({
    ScrollView: require('react-native').ScrollView
}));
jest.mock('../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../components/Amount', () => {
    const { Text } = require('react-native');
    return ({ sats }: any) => <Text>{`amount:${sats}`}</Text>;
});
jest.mock('../components/KeyValue', () => {
    const { Text } = require('react-native');
    return ({ value }: any) => <Text>{value}</Text>;
});
jest.mock('../components/Header', () => () => null);
jest.mock('../components/Button', () => () => null);
jest.mock('../components/LoadingIndicator', () => () => null);
jest.mock('../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../assets/images/SVG/QR.svg', () => 'QRIcon');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../utils/LocaleUtils');

import WithdrawalRequestInfo from './WithdrawalRequestInfo';

describe('WithdrawalRequestInfo', () => {
    // a getPayReq started during the decode (deep link, NFC) supersedes it,
    // so withdrawal_req stays null and only the returned decode is left
    it('shows the decode getWithdrawalReq returns when withdrawal_req was not set', async () => {
        const InvoicesStore: any = {
            withdrawal_req: null,
            getWithdrawalReq: jest.fn(() =>
                Promise.resolve({
                    invreq_amount_msat: 21000,
                    offer_description: 'refund'
                })
            )
        };

        await render(
            <WithdrawalRequestInfo
                InvoicesStore={InvoicesStore}
                navigation={{ navigate: jest.fn() } as any}
                route={{ params: { bolt12: 'lnr1withdrawal' } } as any}
            />
        );

        expect(await screen.findByText('refund')).toBeTruthy();
        expect(screen.getByText('amount:21')).toBeTruthy();
        expect(InvoicesStore.getWithdrawalReq).toHaveBeenCalledWith(
            'lnr1withdrawal'
        );
    });
});
