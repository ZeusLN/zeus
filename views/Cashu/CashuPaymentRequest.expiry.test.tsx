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
jest.mock('../../components/Screen', () => 'Screen');
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

import * as React from 'react';

import CashuPaymentRequest from './CashuPaymentRequest';
import Invoice from '../../models/Invoice';
import Bolt11Utils from '../../utils/Bolt11Utils';

// decodes with expiry 3600 and min_final_cltv_expiry 80
const paymentRequest =
    'lnbcrt1230n1pj429x7pp57t97q4awqj3f529snr0pa6senk83sq5pp760qf5a4jzvd7xgwcksdqqcqzzsxqrrsssp57eqtv7vxr46arupna3w4ct0lkf2mqmz9wt044cwkks0rwlnhfr5s9qyyssqragwpwav7nfwv2xyuuamxxj4pnnpzv2hlw7j473repd3sq7st698ta9kmzmygt0w7tmncl56a6mnma0w7e5dlpqd0wy6x3v35rssldspjhh8p0';

// BOLT11 spec test vector with no expiry (x) or min_final_cltv_expiry (c)
const noCltvPaymentRequest =
    'lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap9us6v52vjjsrvywa6rt52cm9r9zqt8r2t7mlcwspyetp5h2tztugp9lfyql';

// CashuStore.getPayReq builds payReq from Bolt11Utils.decode output
const renderKeyValues = (bolt11: string) => {
    const screen = new CashuPaymentRequest({
        navigation: { navigate: jest.fn() },
        CashuStore: {
            paymentRequest: bolt11,
            payReq: new Invoice(Bolt11Utils.decode(bolt11) as any),
            multiMintSelectedUrls: []
        },
        LnurlPayStore: {},
        NodeInfoStore: {},
        SettingsStore: { settings: { locale: 'en', payments: {} } }
    } as any);

    const keyValues: { [key: string]: any } = {};
    const walk = (node: any) => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (!React.isValidElement(node)) return;
        const { props, type } = node as any;
        if (type === 'KeyValue') keyValues[props.keyValue] = props.value;
        walk(props.children);
    };
    walk(screen.render());
    return keyValues;
};

describe('CashuPaymentRequest invoice details', () => {
    it('shows the expiry as a duration and the CLTV expiry in blocks', () => {
        const keyValues = renderKeyValues(paymentRequest);

        expect(keyValues['views.PaymentRequest.expiry']).toBe('1 hour');
        expect(keyValues['views.PaymentRequest.cltvExpiry']).toBe(
            '80 general.blocks'
        );
    });

    it('omits the CLTV expiry row when the invoice has no CLTV expiry', () => {
        const keyValues = renderKeyValues(noCltvPaymentRequest);

        expect(keyValues).not.toHaveProperty('views.PaymentRequest.cltvExpiry');
    });
});
