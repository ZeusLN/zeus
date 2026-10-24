import * as React from 'react';
import { render, screen } from '@testing-library/react-native';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({
    ButtonGroup: 'ButtonGroup',
    Icon: 'Icon'
}));
jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('../../assets/images/SVG/History.svg', () => 'History');
jest.mock('../../assets/images/SVG/Olympus.svg', () => 'Olympus');
jest.mock('../../components/Accordion', () => 'Accordion');
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/KeyValue', () => {
    const { Text } = require('react-native');
    return ({ keyValue, value }: any) => <Text>{`${keyValue}: ${value}`}</Text>;
});
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/Text', () => {
    const { Text } = require('react-native');
    return ({ children }: any) => <Text>{children}</Text>;
});
jest.mock('../../components/TextInput', () => {
    const { TextInput } = require('react-native');
    return (props: any) => <TextInput {...props} />;
});
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: () => null
}));
jest.mock('../../components/layout/Row', () => {
    const { View } = require('react-native');
    return { Row: ({ children }: any) => <View>{children}</View> };
});
jest.mock('./OrderResponse', () => 'LSPS1OrderResponse');
jest.mock('../../utils/BackendUtils', () => ({
    supportsLSPS1native: () => false,
    supportsLSPS1rest: () => true,
    supportsLSPScustomMessage: () => false,
    supportsFlowLSP: () => false
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../../utils/UnitsUtils', () => ({
    numberWithCommas: (value: any) => String(value)
}));
jest.mock('../../utils/LocaleUtils');

import LSPS1 from './index';

// lsps1.get_info example from the LSPS1 spec (bLIP-51)
const SPEC_GET_INFO = {
    min_required_channel_confirmations: 0,
    min_funding_confirms_within_blocks: 6,
    supports_zero_channel_reserve: true,
    max_channel_expiry_blocks: 20160,
    min_initial_client_balance_sat: '20000',
    max_initial_client_balance_sat: '100000000',
    min_initial_lsp_balance_sat: '0',
    max_initial_lsp_balance_sat: '100000000',
    min_channel_balance_sat: '50000',
    max_channel_balance_sat: '100000000'
};

// lsps1.get_info example from the earlier LSPS1 spec, before the
// options were renamed (BitcoinAndLightningLayerSpecs/lsp, Jan 2024)
const LEGACY_GET_INFO = {
    website: 'http://example.com/contact',
    options: {
        min_channel_confirmations: 0,
        min_onchain_payment_confirmations: null,
        supports_zero_channel_reserve: true,
        min_onchain_payment_size_sat: null,
        max_channel_expiry_blocks: 20160,
        min_initial_client_balance_sat: '20000',
        max_initial_client_balance_sat: '100000000',
        min_initial_lsp_balance_sat: '0',
        max_initial_lsp_balance_sat: '100000000',
        min_channel_balance_sat: '50000',
        max_channel_balance_sat: '100000000'
    }
};

const REFUND_ADDRESS = 'views.LSPS1.refundOnchainAddress';

const legacyGetInfoWith = (options: any) => ({
    ...LEGACY_GET_INFO,
    options: { ...LEGACY_GET_INFO.options, ...options }
});

const renderView = (getInfoData: any) =>
    render(
        <LSPS1
            LSPStore={
                {
                    getInfoData,
                    createOrderResponse: {},
                    loadingLSPS1: false,
                    error: false,
                    error_msg: '',
                    resetLSPS1Data: jest.fn(),
                    lsps1GetInfoREST: jest.fn(),
                    isOlympus: () => false,
                    getLSPS1Rest: () => 'https://lsps1.example.com',
                    getLSPSPubkey: () => '',
                    getLSPSHost: () => ''
                } as any
            }
            ChannelsStore={{} as any}
            SettingsStore={{ settings: { lsps1Token: '' } } as any}
            NodeInfoStore={
                {
                    flowLspNotConfigured: () => ({
                        flowLspNotConfigured: true
                    })
                } as any
            }
            navigation={{ addListener: jest.fn(), navigate: jest.fn() } as any}
        />
    );

describe('LSPS1 service info with zero values', () => {
    it('shows min_required_channel_confirmations 0 from the spec example', async () => {
        await renderView(SPEC_GET_INFO);

        expect(
            screen.getByText('views.LSPS1.minRequiredChannelConfirmations: 0')
        ).toBeOnTheScreen();
    });

    it('shows min_channel_confirmations 0 from the earlier spec example', async () => {
        await renderView(LEGACY_GET_INFO);

        expect(
            screen.getByText('views.LSPS1.minChannelConfirmations: 0')
        ).toBeOnTheScreen();
    });

    it('shows min_onchain_payment_confirmations 0 and asks for a refund address', async () => {
        await renderView(
            legacyGetInfoWith({
                min_onchain_payment_confirmations: 0,
                min_onchain_payment_size_sat: '50000'
            })
        );

        expect(
            screen.getByText('views.LSPS1.minOnchainPaymentConfirmations: 0')
        ).toBeOnTheScreen();
        expect(screen.getByPlaceholderText(REFUND_ADDRESS)).toBeOnTheScreen();
    });

    it.each([
        ['null', LEGACY_GET_INFO],
        ['missing', SPEC_GET_INFO]
    ])(
        'does not ask for a refund address when min_onchain_payment_confirmations is %s',
        async (_label, getInfoData) => {
            await renderView(getInfoData);

            expect(
                screen.queryByText(
                    /views\.LSPS1\.minOnchainPaymentConfirmations/
                )
            ).toBeNull();
            expect(screen.queryByPlaceholderText(REFUND_ADDRESS)).toBeNull();
        }
    );
});
