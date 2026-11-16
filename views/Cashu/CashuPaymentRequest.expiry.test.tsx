jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('@rneui/themed', () => ({ ButtonGroup: 'ButtonGroup' }));
jest.mock('../../stores/Stores', () => ({}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/EcashMintPicker', () => 'EcashMintPicker');
jest.mock('../../components/SwipeButton', () => 'SwipeButton');
jest.mock('../../components/Conversion', () => 'Conversion');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/KeyValue', () => 'KeyValue');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage',
    WarningMessage: 'WarningMessage'
}));
jest.mock('../../utils/BackendUtils', () => ({
    supportsLightningSends: () => true
}));
jest.mock('../../utils/UnitsUtils', () => ({ numberWithCommas: String }));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../../utils/LnurlPayUtils', () => ({}));
jest.mock('../../utils/LinkingUtils', () => ({}));
jest.mock('../../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../../assets/images/SVG/Caret Down.svg', () => 'CaretDown');
jest.mock('../../assets/images/SVG/Caret Right.svg', () => 'CaretRight');
jest.mock('../../assets/images/SVG/QR.svg', () => 'QR');

import * as React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import { CashuPaymentRequestView } from './CashuPaymentRequest';
import Invoice from '../../models/Invoice';
import Bolt11Utils from '../../utils/Bolt11Utils';

// decodes with expiry 3600 and min_final_cltv_expiry 80
const paymentRequest =
    'lnbcrt1230n1pj429x7pp57t97q4awqj3f529snr0pa6senk83sq5pp760qf5a4jzvd7xgwcksdqqcqzzsxqrrsssp57eqtv7vxr46arupna3w4ct0lkf2mqmz9wt044cwkks0rwlnhfr5s9qyyssqragwpwav7nfwv2xyuuamxxj4pnnpzv2hlw7j473repd3sq7st698ta9kmzmygt0w7tmncl56a6mnma0w7e5dlpqd0wy6x3v35rssldspjhh8p0';

// BOLT11 spec test vector with no expiry (x) or min_final_cltv_expiry (c)
const noCltvPaymentRequest =
    'lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap9us6v52vjjsrvywa6rt52cm9r9zqt8r2t7mlcwspyetp5h2tztugp9lfyql';

// CashuStore.getPayReq builds the plan's payReq from Bolt11Utils.decode
// output; the screen shows the invoice of the plan it is answered with
const renderKeyValues = async (bolt11: string) => {
    const settings = { locale: 'en', payments: {}, ecash: {} };
    await render(
        <CashuPaymentRequestView
            {...({
                navigation: {
                    navigate: jest.fn(),
                    addListener: jest.fn(() => jest.fn())
                },
                route: { params: { paymentRequest: bolt11 } },
                CashuStore: {
                    multiMintSelectedUrls: [],
                    getPayReq: jest.fn(async () => ({
                        paymentRequest: bolt11,
                        payReq: new Invoice(Bolt11Utils.decode(bolt11) as any),
                        meltQuotes: [],
                        plannerSkips: [],
                        mintBalance: 0,
                        amount: 0
                    }))
                },
                NodeInfoStore: {},
                SettingsStore: {
                    settings,
                    getSettings: jest.fn(async () => settings)
                }
            } as any)}
        />
    );
    await act(async () => {
        await new Promise((resolve) => setImmediate(resolve));
    });

    const keyValues: { [key: string]: any } = {};
    screen.container
        .queryAll((n) => n.type === 'KeyValue')
        .forEach((n) => {
            keyValues[n.props.keyValue] = n.props.value;
        });
    return keyValues;
};

describe('CashuPaymentRequest invoice details', () => {
    it('shows the expiry as a duration and the CLTV expiry in blocks', async () => {
        const keyValues = await renderKeyValues(paymentRequest);

        // Invoice joins the number and unit with a non-breaking space
        expect(keyValues['views.PaymentRequest.expiry']).toBe('1\u00a0hour');
        expect(keyValues['views.PaymentRequest.cltvExpiry']).toBe(
            '80 general.blocks'
        );
    });

    it('omits the CLTV expiry row when the invoice has no CLTV expiry', async () => {
        const keyValues = await renderKeyValues(noCltvPaymentRequest);

        expect(keyValues).toHaveProperty(['views.PaymentRequest.paymentHash']);
        expect(keyValues).not.toHaveProperty([
            'views.PaymentRequest.cltvExpiry'
        ]);
    });
});
