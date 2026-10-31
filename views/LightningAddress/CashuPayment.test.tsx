import * as React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('../../stores/Stores', () => ({
    cashuStore: {
        mintInfos: { 'https://mint.example.com': { name: 'Example Mint' } },
        cashuWallets: {}
    },
    lightningAddressStore: { redeemCashu: jest.fn(), deletePayment: jest.fn() }
}));
// The swipe actions are not opened here; reanimated's ESM entry does not
// load in jest
jest.mock('react-native-reanimated', () => {
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: { View },
        Extrapolation: { CLAMP: 'clamp' },
        interpolate: () => 0,
        useAnimatedStyle: () => ({})
    };
});
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: ({ children }: any) => <View>{children}</View>
    };
});
// ListItem.Title and ListItem.Subtitle are Text in @rneui/base
jest.mock('@rneui/themed', () => {
    const { View, Text } = require('react-native');
    const ListItem: any = ({ children }: any) => <View>{children}</View>;
    ListItem.Content = ({ children }: any) => <View>{children}</View>;
    ListItem.Title = ({ children }: any) => <Text>{children}</Text>;
    ListItem.Subtitle = ({ children }: any) => (
        <Text testID="list-item-subtitle">{children}</Text>
    );
    return { ListItem };
});
jest.mock('../../components/Text', () => {
    const { Text } = require('react-native');
    return ({ children, style }: any) => <Text style={style}>{children}</Text>;
});
jest.mock('../../components/Amount', () => () => null);
jest.mock('../../components/Button', () => () => null);
jest.mock('../../assets/images/SVG/Receive.svg', () => () => null);
jest.mock('../../utils/DateTimeUtils', () => ({
    formatDateTimeShort: (value: any) => String(value)
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));

import CashuPayment from './CashuPayment';

const { cashuStore } = jest.requireMock('../../stores/Stores');

const MINT_URL = 'https://mint.example.com';
const UPDATED_AT = '2026-10-29T14:00:00Z';

const renderPayment = (fields: any) =>
    render(
        <CashuPayment
            item={{
                quote_id: 'quote-1',
                amount_msat: 21000,
                updated_at: UPDATED_AT,
                ...fields
            }}
            index={0}
        />
    );

// The mint line is the subtitle just above the date
const mintLine = () => {
    const lines = screen.getAllByTestId('list-item-subtitle');
    return lines[lines.length - 2];
};

describe('CashuPayment mint line', () => {
    afterEach(() => {
        cashuStore.cashuWallets = {};
    });

    it('shows the mint name for a known mint', async () => {
        await renderPayment({ mint_url: MINT_URL });

        expect(mintLine()).toHaveTextContent('Example Mint');
    });

    it('uses the warning color when the mint wallet cannot connect', async () => {
        cashuStore.cashuWallets = { [MINT_URL]: { errorConnecting: true } };
        await renderPayment({ mint_url: MINT_URL });

        expect(screen.getByText('Example Mint')).toHaveStyle({
            color: 'theme:warning'
        });
    });

    it('shows the mint URL when the mint has no name', async () => {
        await renderPayment({ mint_url: 'https://other.example.com' });

        expect(mintLine()).toHaveTextContent('https://other.example.com');
    });

    // ZEUS Pay sends mint_url in the status response, so a bad server
    // can send any JSON value here
    it.each([
        ['a number', 12345],
        ['an object', { url: MINT_URL }],
        ['an array', [MINT_URL]],
        ['null', null]
    ])(
        'renders the row with an empty mint line when mint_url is %s',
        async (_name, mint_url) => {
            await renderPayment({ mint_url });

            expect(screen.getByText(UPDATED_AT)).toBeOnTheScreen();
            expect(mintLine()).toHaveTextContent('', { exact: true });
        }
    );

    it('does not take the warning color from the mint an array mint_url names', async () => {
        cashuStore.cashuWallets = { [MINT_URL]: { errorConnecting: true } };
        await renderPayment({ mint_url: [MINT_URL] });

        expect(
            screen.root!.queryAll(
                (node) => node.props.style?.color === 'theme:warning'
            )
        ).toHaveLength(0);
    });
});

describe('CashuPayment comment line', () => {
    it('shows the comment above the mint line', async () => {
        await renderPayment({ mint_url: MINT_URL, comment: 'hi' });

        expect(
            screen.getByText('views.LnurlPay.LnurlPay.comment: hi')
        ).toBeOnTheScreen();
        expect(mintLine()).toHaveTextContent('Example Mint');
    });

    // comment also comes from the status response; a 0 here was rendered
    // as bare text outside <Text>
    it('renders the row without a comment line when comment is 0', async () => {
        await renderPayment({ mint_url: MINT_URL, comment: 0 });

        expect(mintLine()).toHaveTextContent('Example Mint');
        expect(
            screen.queryByText(/views\.LnurlPay\.LnurlPay\.comment/)
        ).toBeNull();
    });
});
