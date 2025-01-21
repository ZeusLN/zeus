import * as React from 'react';
import {
    Dimensions,
    NativeEventEmitter,
    NativeModules,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
    Platform
} from 'react-native';
import BigNumber from 'bignumber.js';
import { LNURLWithdrawParams } from 'js-lnurl';
import { ButtonGroup, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import _map from 'lodash/map';
import NfcManager, {
    NfcEvents,
    TagEvent,
    Ndef
} from 'react-native-nfc-manager';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import handleAnything from '../utils/handleAnything';

import Wordmark from '../assets/images/SVG/wordmark-black.svg';
const ZIcon = require('../assets/images/icon-black.png');
const LightningIcon = require('../assets/images/lightning-black.png');
const OnChainIcon = require('../assets/images/onchain-black.png');
const ZPayIcon = require('../assets/images/pay-z-black.png');

const ZIconWhite = require('../assets/images/icon-white.png');
const LightningIconWhite = require('../assets/images/lightning-white.png');
const OnChainIconWhite = require('../assets/images/onchain-white.png');
const ZPayIconWhite = require('../assets/images/pay-z-white.png');

import Amount from '../components/Amount';
import AmountInput, { getSatAmount } from '../components/AmountInput';
import Button from '../components/Button';
import CollapsedQR from '../components/CollapsedQR';
import Header from '../components/Header';
import LoadingIndicator from '../components/LoadingIndicator';
import PaidIndicator from '../components/PaidIndicator';
import ModalBox from '../components/ModalBox';
import { Row } from '../components/layout/Row';
import Screen from '../components/Screen';
import SuccessAnimation from '../components/SuccessAnimation';
import {
    SuccessMessage,
    WarningMessage,
    ErrorMessage
} from '../components/SuccessErrorMessage';
import Switch from '../components/Switch';
import Text from '../components/Text';
import TextInput from '../components/TextInput';

import Invoice from '../models/Invoice';
import Channel from '../models/Channel';

import ChannelsStore from '../stores/ChannelsStore';
import ModalStore from '../stores/ModalStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import InvoicesStore from '../stores/InvoicesStore';
import PosStore from '../stores/PosStore';
import SettingsStore, { TIME_PERIOD_KEYS } from '../stores/SettingsStore';
import LightningAddressStore from '../stores/LightningAddressStore';
import LSPStore from '../stores/LSPStore';
import UnitsStore from '../stores/UnitsStore';

import { localeString } from '../utils/LocaleUtils';
import BackendUtils from '../utils/BackendUtils';
import Base64Utils from '../utils/Base64Utils';
import NFCUtils from '../utils/NFCUtils';
import { themeColor } from '../utils/ThemeUtils';
import { SATS_PER_BTC } from '../utils/UnitsUtils';

import lndMobile from '../lndmobile/LndMobileInjection';
import { decodeSubscribeTransactionsResult } from '../lndmobile/onchain';
import {
    checkLndStreamErrorResponse,
    LndMobileEventEmitter
} from '../utils/LndMobileUtils';

import UnifiedSvg from '../assets/images/SVG/DynamicSVG/UnifiedSvg';
import LightningSvg from '../assets/images/SVG/DynamicSVG/LightningSvg';
import OnChainSvg from '../assets/images/SVG/DynamicSVG/OnChainSvg';
import AddressSvg from '../assets/images/SVG/DynamicSVG/AddressSvg';
import Gear from '../assets/images/SVG/Gear.svg';
import DropdownSetting from '../components/DropdownSetting';
import HopPicker from '../components/HopPicker';

interface ReceiveProps {
    exitSetup: any;
    navigation: StackNavigationProp<any, any>;
    ChannelsStore: ChannelsStore;
    InvoicesStore: InvoicesStore;
    PosStore: PosStore;
    ModalStore: ModalStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
    LSPStore: LSPStore;
    LightningAddressStore: LightningAddressStore;
    route: Route<
        'Receive',
        {
            lnurlParams: LNURLWithdrawParams | undefined;
            amount: string;
            autoGenerate: boolean;
            autoGenerateOnChain: boolean;
            autoGenerateChange?: boolean;
            account: string;
            addressType?: string;
            selectedIndex: number;
            memo: string;
            orderId: string;
            orderTotal: string;
            orderTip: string;
            exchangeRate: string;
            rate: number;
            hideRightHeaderComponent: boolean;
        }
    >;
}

interface ReceiveState {
    selectedIndex: number;
    expirationIndex: number;
    addressType: string;
    memo: string;
    value: string;
    satAmount: string | number;
    expiry: string;
    timePeriod: string;
    expirySeconds: string;
    customPreimage: string;
    ampInvoice: boolean;
    routeHints: boolean;
    account: string;
    blindedPaths: boolean;
    nfcSupported: boolean;
    // POS
    orderId: string;
    orderTotal: string;
    orderTip: string;
    exchangeRate: string;
    rate: number;
    // LSP
    needInbound: boolean;
    enableLSP: boolean;
    lspIsActive: boolean;
    flowLspNotConfigured: boolean;
    routeHintMode: RouteHintMode;
    selectedRouteHintChannels?: Channel[];
    hideRightHeaderComponent?: boolean;
}

enum RouteHintMode {
    Automatic = 0,
    Custom = 1
}

@inject(
    'ChannelsStore',
    'InvoicesStore',
    'SettingsStore',
    'UnitsStore',
    'PosStore',
    'NodeInfoStore',
    'LightningAddressStore',
    'LSPStore'
)
@observer
export default class Receive extends React.Component<
    ReceiveProps,
    ReceiveState
> {
    constructor(props: ReceiveProps) {
        super(props);
        this.state = {
            selectedIndex: props.route.params?.selectedIndex ?? 0,
            expirationIndex: 1,
            addressType: '0',
            memo: '',
            value: '',
            satAmount: '',
            expiry: '3600',
            timePeriod: 'Seconds',
            expirySeconds: '3600',
            customPreimage: '',
            ampInvoice: false,
            routeHints: false,
            account: 'default',
            blindedPaths: false,
            nfcSupported: false,
            // POS
            orderId: '',
            orderTip: '',
            orderTotal: '',
            exchangeRate: '',
            rate: 0,
            // LSP
            needInbound: false,
            enableLSP: true,
            lspIsActive: false,
            flowLspNotConfigured: true,
            routeHintMode: RouteHintMode.Automatic,
            selectedRouteHintChannels: undefined
        };
    }

    listener: any;
    listenerSecondary: any;
    lnInterval: any;
    onChainInterval: any;
    hopPickerRef: HopPicker | null;

    async UNSAFE_componentWillMount() {
        const {
            InvoicesStore,
            SettingsStore,
            LightningAddressStore,
            NodeInfoStore,
            route
        } = this.props;
        const { reset } = InvoicesStore;
        const { getSettings, posStatus } = SettingsStore;
        const { status, lightningAddressHandle } = LightningAddressStore;

        const settings = await getSettings();

        if (settings?.lightningAddress?.enabled && !lightningAddressHandle) {
            status();
        }

        const { flowLspNotConfigured } = NodeInfoStore.flowLspNotConfigured();

        const newExpirySeconds = settings?.invoices?.expirySeconds || '3600';

        let expirationIndex;
        if (newExpirySeconds === '600') {
            expirationIndex = 0;
        } else if (newExpirySeconds === '3600') {
            expirationIndex = 1;
        } else if (newExpirySeconds === '86400') {
            expirationIndex = 2;
        } else if (newExpirySeconds === '604800') {
            expirationIndex = 3;
        } else {
            expirationIndex = 4;
        }

        this.setState({
            addressType: settings?.invoices?.addressType || '0',
            expirationIndex,
            memo: settings?.invoices?.memo || '',
            expiry: settings?.invoices?.expiry || '3600',
            timePeriod: settings?.invoices?.timePeriod || 'Seconds',
            expirySeconds: newExpirySeconds,
            routeHints:
                settings?.invoices?.routeHints ||
                !this.props.ChannelsStore.haveAnnouncedChannels
                    ? true
                    : false,
            ampInvoice:
                (settings?.invoices?.ampInvoice &&
                    BackendUtils.supportsAMP()) ||
                false,
            blindedPaths:
                (settings?.invoices?.blindedPaths &&
                    BackendUtils.supportsBolt11BlindedRoutes()) ||
                false,
            enableLSP: settings?.enableLSP,
            lspIsActive:
                settings?.enableLSP &&
                BackendUtils.supportsFlowLSP() &&
                !flowLspNotConfigured,
            flowLspNotConfigured
        });

        const lnOnly =
            settings &&
            posStatus &&
            posStatus === 'active' &&
            settings.pos &&
            settings.pos.confirmationPreference &&
            settings.pos.confirmationPreference === 'lnOnly';

        reset();

        const {
            lnurlParams: lnurl,
            amount,
            autoGenerate,
            autoGenerateOnChain,
            autoGenerateChange,
            account,
            selectedIndex,
            hideRightHeaderComponent
        } = route.params ?? {};

        if (hideRightHeaderComponent) {
            this.setState({ hideRightHeaderComponent });
        }

        if (account) {
            this.setState({ account });
        }

        if (selectedIndex) {
            this.setState({ selectedIndex });
        }

        const { expirySeconds, routeHints, ampInvoice, blindedPaths } =
            this.state;

        const addressType = route.params?.addressType || this.state.addressType;

        // POS
        const memo = route.params?.memo ?? this.state.memo;
        const { orderId, orderTotal, orderTip, exchangeRate, rate } =
            route.params ?? {};

        if (orderId) {
            this.setState({
                orderId,
                orderTotal,
                orderTip,
                exchangeRate,
                rate
            });
        }

        if (lnurl) {
            this.props.UnitsStore.resetUnits();
            let needInbound = false;
            if (
                this.state.lspIsActive &&
                new BigNumber(getSatAmount(lnurl.maxWithdrawable / 1000)).gt(
                    this.props.ChannelsStore.totalInbound
                )
            ) {
                needInbound = true;
            }
            this.setState({
                memo: lnurl.defaultDescription,
                value: (lnurl.maxWithdrawable / 1000).toString(),
                satAmount: getSatAmount(lnurl.maxWithdrawable / 1000),
                needInbound
            });
        }

        if (amount && amount != '0') {
            let needInbound = false;
            if (
                this.state.lspIsActive &&
                getSatAmount(amount) != '0' &&
                new BigNumber(getSatAmount(amount)).gt(
                    this.props.ChannelsStore.totalInbound
                )
            ) {
                needInbound = true;
            }
            this.setState({
                value: amount,
                satAmount: getSatAmount(amount),
                needInbound
            });
        }

        if (lnOnly) {
            this.setState({
                selectedIndex: 1
            });
        }

        if (autoGenerate) {
            this.autoGenerateInvoice(
                getSatAmount(amount).toString(),
                memo,
                expirySeconds,
                routeHints,
                ampInvoice,
                blindedPaths,
                addressType
            );
        }

        if (autoGenerateChange) {
            this.autoGenerateChange(account, addressType);
        } else if (autoGenerateOnChain) {
            this.autoGenerateOnChainAddress(account, addressType);
        }
    }

    async UNSAFE_componentWillReceiveProps(nextProps: any) {
        const { route, InvoicesStore } = nextProps;
        const { reset } = InvoicesStore;

        reset();
        const { amount, lnurlParams: lnurl } = route.params ?? {};

        if (amount && amount != '0') {
            let needInbound = false;
            if (
                this.state.lspIsActive &&
                getSatAmount(amount) != '0' &&
                new BigNumber(getSatAmount(amount)).gt(
                    this.props.ChannelsStore.totalInbound
                )
            ) {
                needInbound = true;
            }
            this.setState({
                value: amount,
                satAmount: getSatAmount(amount),
                needInbound
            });
        }

        if (lnurl) {
            let needInbound = false;
            if (
                this.state.lspIsActive &&
                new BigNumber(getSatAmount(lnurl.maxWithdrawable / 1000)).gt(
                    this.props.ChannelsStore.totalInbound
                )
            ) {
                needInbound = true;
            }
            this.setState({
                memo: lnurl.defaultDescription,
                value: (lnurl.maxWithdrawable / 1000).toString(),
                satAmount: getSatAmount(lnurl.maxWithdrawable / 1000),
                needInbound
            });
        }
    }

    async componentDidMount() {
        const nfcSupported = await NfcManager.isSupported();
        this.setState({ nfcSupported });
    }

    clearListeners = () => {
        if (this.listener && this.listener.stop) this.listener.stop();
        if (this.listenerSecondary && this.listenerSecondary.stop)
            this.listenerSecondary.stop();
    };

    clearIntervals = () => {
        if (this.lnInterval) clearInterval(this.lnInterval);
        if (this.onChainInterval) clearInterval(this.onChainInterval);
    };

    onBack = () => {
        const { InvoicesStore } = this.props;
        const { reset } = InvoicesStore;
        // kill all listeners and pollers before navigating back
        this.clearListeners();
        this.clearIntervals();

        // clear invoice
        reset();
    };

    autoGenerateInvoice = (
        amount?: string,
        memo?: string,
        expirySeconds?: string,
        routeHints?: boolean,
        ampInvoice?: boolean,
        blindedPaths?: boolean,
        addressType?: string
    ) => {
        const { InvoicesStore } = this.props;
        const { lspIsActive } = this.state;
        const { createUnifiedInvoice } = InvoicesStore;

        createUnifiedInvoice({
            memo: lspIsActive ? '' : memo || '',
            value: amount || '0',
            expiry: expirySeconds || '3600',
            ampInvoice: lspIsActive ? false : ampInvoice || false,
            blindedPaths: lspIsActive ? false : blindedPaths || false,
            routeHints: lspIsActive ? false : routeHints || false,
            addressType: BackendUtils.supportsAddressTypeSelection()
                ? addressType || '1'
                : undefined,
            noLsp: !lspIsActive
        }).then(
            ({
                rHash,
                onChainAddress
            }: {
                rHash: string;
                onChainAddress?: string;
            }) => {
                this.subscribeInvoice(rHash, onChainAddress);
            }
        );
    };

    autoGenerateOnChainAddress = (account?: string, address_type?: string) => {
        const { InvoicesStore } = this.props;
        const { getNewAddress } = InvoicesStore;

        let request: any = {
            type: address_type || this.state.addressType
        };

        if (account) {
            request.account = account;
        }

        getNewAddress(request).then((onChainAddress: string) => {
            this.subscribeInvoice(undefined, onChainAddress);
        });
    };

    autoGenerateChange = (account?: string, address_type?: string) => {
        const { InvoicesStore } = this.props;
        const { getNewChangeAddress } = InvoicesStore;

        let request: any = {
            type: address_type || this.state.addressType
        };

        if (account) {
            request.account = account;
        }

        getNewChangeAddress(request).then((onChainAddress: string) => {
            this.subscribeInvoice(undefined, onChainAddress);
        });
    };

    disableNfc = () => {
        NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
        NfcManager.setEventListener(NfcEvents.SessionClosed, null);
    };

    enableNfc = async () => {
        const { ModalStore } = this.props;
        this.disableNfc();
        await NfcManager.start().catch((e) => console.warn(e.message));

        return new Promise((resolve: any) => {
            let tagFound: TagEvent | null = null;

            // enable NFC
            if (Platform.OS === 'android')
                ModalStore.toggleAndroidNfcModal(true);

            NfcManager.setEventListener(
                NfcEvents.DiscoverTag,
                (tag: TagEvent) => {
                    tagFound = tag;
                    const bytes = new Uint8Array(
                        tagFound.ndefMessage[0].payload
                    );

                    let str;
                    const decoded = Ndef.text.decodePayload(bytes);
                    if (decoded.match(/^(https?|lnurl)/)) {
                        str = decoded;
                    } else {
                        str = NFCUtils.nfcUtf8ArrayToStr(bytes) || '';
                    }

                    // close NFC
                    if (Platform.OS === 'android')
                        ModalStore.toggleAndroidNfcModal(false);

                    resolve(this.validateAddress(str));
                    NfcManager.unregisterTagEvent().catch(() => 0);
                }
            );

            NfcManager.setEventListener(NfcEvents.SessionClosed, () => {
                // close NFC
                if (Platform.OS === 'android')
                    ModalStore.toggleAndroidNfcModal(false);

                if (!tagFound) {
                    resolve();
                }
            });

            NfcManager.registerTagEvent();
        });
    };

    validateAddress = (text: string) => {
        const { navigation, InvoicesStore, route } = this.props;
        const { lspIsActive } = this.state;
        const { createUnifiedInvoice } = InvoicesStore;
        const amount = getSatAmount(route.params?.amount);

        handleAnything(text, amount.toString())
            .then((response) => {
                try {
                    const [route, props] = response;
                    const { lnurlParams } = props;
                    const { memo } = lnurlParams.defaultDescription;

                    // if an amount was entered on the keypad screen before scanning
                    // we will automatically create an invoice and attempt to withdraw
                    // otherwise we present the user with the create invoice screen
                    if (Number(amount) > 0) {
                        createUnifiedInvoice({
                            memo: lspIsActive ? '' : memo,
                            value: amount.toString(),
                            expiry: '3600',
                            lnurl: lnurlParams,
                            noLsp: !lspIsActive
                        })
                            .then(
                                ({
                                    rHash,
                                    onChainAddress
                                }: {
                                    rHash: string;
                                    onChainAddress?: string;
                                }) => {
                                    this.subscribeInvoice(
                                        rHash,
                                        onChainAddress
                                    );
                                }
                            )
                            .catch(() => {
                                navigation.navigate(route, {
                                    amount,
                                    ...props
                                });
                            });
                    } else {
                        navigation.navigate(route, props);
                    }
                } catch (e) {}
            })
            .catch();
    };

    subscribeInvoice = async (rHash?: string, onChainAddress?: string) => {
        const { InvoicesStore, PosStore, SettingsStore, NodeInfoStore } =
            this.props;
        const { orderId, orderTotal, orderTip, exchangeRate, rate, value } =
            this.state;
        const { implementation, settings } = SettingsStore;
        const { nodeInfo } = NodeInfoStore;
        const { setWatchedInvoicePaid } = InvoicesStore;

        const numConfPreference =
            settings.pos && settings.pos.confirmationPreference === '1conf'
                ? 1
                : 0;

        if (implementation === 'embedded-lnd') {
            if (rHash) {
                this.listener = LndMobileEventEmitter.addListener(
                    'SubscribeInvoices',
                    (e: any) => {
                        try {
                            const error = checkLndStreamErrorResponse(
                                'SubscribeInvoices',
                                e
                            );
                            if (error === 'EOF') {
                                this.listener?.remove();
                                return;
                            } else if (error) {
                                console.error(
                                    'Got error from SubscribeInvoices',
                                    [error]
                                );
                                this.listener?.remove();
                                return;
                            }

                            const invoice =
                                lndMobile.wallet.decodeInvoiceResult(e.data);

                            if (
                                invoice.settled &&
                                // @ts-ignore:next-line
                                Base64Utils.bytesToHex(invoice.r_hash) === rHash
                            ) {
                                setWatchedInvoicePaid(
                                    Number(invoice.amt_paid_sat)
                                );

                                PosStore.recordPayment({
                                    orderId,
                                    orderTotal,
                                    orderTip,
                                    exchangeRate,
                                    rate,
                                    type: 'ln',
                                    tx: invoice.payment_request,
                                    preimage: Base64Utils.bytesToHex(
                                        // @ts-ignore:next-line
                                        invoice.r_preimage
                                    )
                                });
                                this.listener?.remove();
                            }
                        } catch (error) {
                            console.error(error);
                            this.listener?.remove();
                        }
                    }
                );
            }

            if (onChainAddress) {
                this.listenerSecondary = LndMobileEventEmitter.addListener(
                    'SubscribeTransactions',
                    (e: any) => {
                        try {
                            const error = checkLndStreamErrorResponse(
                                'SubscribeTransactions',
                                e
                            );
                            if (error === 'EOF') {
                                this.listenerSecondary?.remove();
                                return;
                            } else if (error) {
                                console.error(
                                    'Got error from SubscribeTransactions',
                                    [error]
                                );
                                this.listenerSecondary?.remove();
                                return;
                            }

                            const transaction =
                                decodeSubscribeTransactionsResult(e.data);
                            if (
                                onChainAddress &&
                                transaction.dest_addresses.includes(
                                    onChainAddress
                                ) &&
                                transaction.num_confirmations >
                                    numConfPreference &&
                                Number(transaction.amount) >= Number(value)
                            ) {
                                setWatchedInvoicePaid(
                                    Number(transaction.amount)
                                );
                                if (orderId)
                                    PosStore.recordPayment({
                                        orderId,
                                        orderTotal,
                                        orderTip,
                                        exchangeRate,
                                        rate,
                                        type: 'onchain',
                                        tx: transaction.tx_hash
                                    });
                                this.listenerSecondary?.remove();
                            }
                        } catch (error) {
                            console.error(error);
                            this.listenerSecondary?.remove();
                        }
                    }
                );
            }

            await lndMobile.wallet.subscribeInvoices();
            await lndMobile.onchain.subscribeTransactions();
        }

        if (implementation === 'lightning-node-connect') {
            const { LncModule } = NativeModules;
            if (rHash) {
                const eventName = BackendUtils.subscribeInvoice(rHash);
                const eventEmitter = new NativeEventEmitter(LncModule);
                this.listener = eventEmitter.addListener(
                    eventName,
                    (event: any) => {
                        if (event.result) {
                            if (
                                typeof event.result === 'string' &&
                                event.result.includes(
                                    'rpc error: code = Canceled'
                                )
                            ) {
                                this.listener?.remove();
                                return;
                            }
                            try {
                                const result = JSON.parse(event.result);
                                if (result === 'EOF') {
                                    this.listener?.remove();
                                    return;
                                }
                                if (result.settled) {
                                    setWatchedInvoicePaid(result.amt_paid_sat);
                                    if (orderId)
                                        PosStore.recordPayment({
                                            orderId,
                                            orderTotal,
                                            orderTip,
                                            exchangeRate,
                                            rate,
                                            type: 'ln',
                                            tx: result.payment_request,
                                            preimage: result.r_preimage
                                        });
                                    this.listener?.remove();
                                }
                            } catch (error) {
                                console.error(error);
                                this.listener?.remove();
                            }
                        }
                    }
                );
            }

            if (onChainAddress) {
                const eventName2 = BackendUtils.subscribeTransactions();
                const eventEmitter2 = new NativeEventEmitter(LncModule);
                this.listenerSecondary = eventEmitter2.addListener(
                    eventName2,
                    (event: any) => {
                        if (event.result) {
                            if (
                                typeof event.result === 'string' &&
                                event.result.includes(
                                    'rpc error: code = Canceled'
                                )
                            ) {
                                this.listenerSecondary?.remove();
                                return;
                            }
                            try {
                                const result = JSON.parse(event.result);
                                if (result === 'EOF') {
                                    this.listenerSecondary?.remove();
                                    return;
                                }
                                if (
                                    result.dest_addresses.includes(
                                        onChainAddress
                                    ) &&
                                    result.num_confirmations >=
                                        numConfPreference &&
                                    Number(result.amount) >= Number(value)
                                ) {
                                    setWatchedInvoicePaid(result.amount);
                                    if (orderId)
                                        PosStore.recordPayment({
                                            orderId,
                                            orderTotal,
                                            orderTip,
                                            exchangeRate,
                                            rate,
                                            type: 'onchain',
                                            tx: result.tx_hash
                                        });
                                    this.listenerSecondary?.remove();
                                }
                            } catch (error) {
                                console.error(error);
                                this.listenerSecondary?.remove();
                            }
                        }
                    }
                );
            }
        }

        if (implementation === 'lnd') {
            if (rHash) {
                this.lnInterval = setInterval(() => {
                    // only fetch the last 10 invoices
                    BackendUtils.getInvoices({ limit: 10 }).then(
                        (response: any) => {
                            const invoices = response.invoices;
                            for (let i = 0; i < invoices.length; i++) {
                                const result = invoices[i];
                                if (
                                    result.r_hash
                                        .replace(/\+/g, '-')
                                        .replace(/\//g, '_') === rHash &&
                                    Number(result.amt_paid_sat) >=
                                        Number(value) &&
                                    Number(result.amt_paid_sat) !== 0
                                ) {
                                    setWatchedInvoicePaid(result.amt_paid_sat);
                                    if (orderId)
                                        PosStore.recordPayment({
                                            orderId,
                                            orderTotal,
                                            orderTip,
                                            exchangeRate,
                                            rate,
                                            type: 'ln',
                                            tx: result.payment_request
                                        });
                                    this.clearIntervals();
                                    break;
                                }
                            }
                        }
                    );
                }, 5000);
            }

            // this is workaround that manually calls your transactions every 30 secs
            if (onChainAddress) {
                this.onChainInterval = setInterval(() => {
                    // only look for transactions in the last 3 blocks
                    BackendUtils.getTransactions(
                        nodeInfo && nodeInfo.block_height
                            ? {
                                  start_height: nodeInfo.block_height - 3
                              }
                            : null
                    ).then((response: any) => {
                        const txs = response.transactions;
                        for (let i = 0; i < txs.length; i++) {
                            const result = txs[i];
                            if (
                                result.dest_addresses.includes(
                                    onChainAddress
                                ) &&
                                result.num_confirmations >= numConfPreference
                            ) {
                                // loop through outputs since amount is negative if unconfirmed
                                const output_details = result.output_details;
                                for (
                                    let j = 0;
                                    j < output_details.length;
                                    j++
                                ) {
                                    const output = output_details[j];
                                    if (
                                        Number(output.amount) >=
                                            Number(value) &&
                                        output.address === onChainAddress
                                    ) {
                                        setWatchedInvoicePaid(output.amount);
                                        if (orderId)
                                            PosStore.recordPayment({
                                                orderId,
                                                orderTotal,
                                                orderTip,
                                                exchangeRate,
                                                rate,
                                                type: 'onchain',
                                                tx: result.tx_hash
                                            });
                                        this.clearIntervals();
                                        // break parent loop
                                        i = txs.length;
                                        break;
                                    }
                                }
                            }
                        }
                    });
                }, 7000);
            }
        }

        if (implementation === 'cln-rest') {
            if (rHash) {
                this.lnInterval = setInterval(() => {
                    // only fetch the last 10 invoices
                    BackendUtils.getInvoices({ limit: 10 }).then(
                        (response: any) => {
                            const invoices = response.invoices;
                            for (let i = 0; i < invoices.length; i++) {
                                const result = invoices[i];
                                if (
                                    result.payment_hash
                                        .replace(/\+/g, '-')
                                        .replace(/\//g, '_') === rHash &&
                                    Number(
                                        result.amount_received_msat / 1000
                                    ) >= Number(value) &&
                                    Number(result.amount_received_msat) !== 0
                                ) {
                                    setWatchedInvoicePaid(
                                        result.amount_received_msat / 1000
                                    );
                                    if (orderId)
                                        PosStore.recordPayment({
                                            orderId,
                                            orderTotal,
                                            orderTip,
                                            exchangeRate,
                                            rate,
                                            type: 'ln',
                                            tx: result.bolt11
                                        });
                                    this.clearIntervals();
                                    break;
                                }
                            }
                        }
                    );
                }, 5000);
            }
        }

        if (implementation === 'lndhub') {
            if (rHash) {
                this.lnInterval = setInterval(() => {
                    // only fetch the last 10 invoices
                    BackendUtils.getInvoices({ limit: 10 }).then(
                        (response: any) => {
                            const invoices = response.invoices;
                            for (let i = 0; i < invoices.length; i++) {
                                const result = new Invoice(invoices[i]);
                                if (
                                    result.getFormattedRhash === rHash &&
                                    result.ispaid &&
                                    Number(result.amt) >= Number(value) &&
                                    Number(result.amt) !== 0
                                ) {
                                    setWatchedInvoicePaid(result.amt);
                                    if (orderId)
                                        PosStore.recordPayment({
                                            orderId,
                                            orderTotal,
                                            orderTip,
                                            exchangeRate,
                                            rate,
                                            type: 'ln',
                                            tx: result.payment_request,
                                            preimage: result.r_preimage
                                        });
                                    this.clearIntervals();
                                    break;
                                }
                            }
                        }
                    );
                }, 5000);
            }
        }
    };

    getNewAddress = (params: any) => {
        const { InvoicesStore } = this.props;
        InvoicesStore.getNewAddress(params);
    };

    updateExpirationIndex = (expirationIndex: number) => {
        if (expirationIndex === 0) {
            this.setState({
                expirySeconds: '600',
                expiry: '10',
                timePeriod: 'Minutes',
                expirationIndex: 0
            });
        } else if (expirationIndex === 1) {
            this.setState({
                expirySeconds: '3600',
                expiry: '1',
                timePeriod: 'Hours',
                expirationIndex: 1
            });
        } else if (expirationIndex === 2) {
            this.setState({
                expirySeconds: '86400',
                expiry: '1',
                timePeriod: 'Days',
                expirationIndex: 2
            });
        } else if (expirationIndex === 3) {
            this.setState({
                expirySeconds: '604800',
                expiry: '1',
                timePeriod: 'Weeks',
                expirationIndex: 3
            });
        }
    };

    updateIndex = (selectedIndex: number) => {
        this.setState({
            selectedIndex
        });
    };

    private modalBoxRef = React.createRef<ModalBox>();

    render() {
        const {
            InvoicesStore,
            SettingsStore,
            UnitsStore,
            LightningAddressStore,
            LSPStore,
            NodeInfoStore,
            navigation,
            route
        } = this.props;
        const {
            selectedIndex,
            expirationIndex,
            addressType,
            memo,
            value,
            satAmount,
            expiry,
            timePeriod,
            expirySeconds,
            customPreimage,
            ampInvoice,
            routeHints,
            account,
            needInbound,
            enableLSP,
            lspIsActive,
            flowLspNotConfigured,
            routeHintMode,
            selectedRouteHintChannels,
            blindedPaths,
            hideRightHeaderComponent,
            nfcSupported
        } = this.state;

        const { fontScale } = Dimensions.get('window');

        const { zeroConfFee, showLspSettings } = LSPStore;
        const { getAmountFromSats } = UnitsStore;

        const {
            createUnifiedInvoice,
            onChainAddress,
            payment_request,
            payment_request_amt,
            creatingInvoice,
            creatingInvoiceError,
            watchedInvoicePaid,
            watchedInvoicePaidAmt,
            clearUnified
        } = InvoicesStore;
        const { implementation, posStatus, settings, updateSettings } =
            SettingsStore;
        const loading = SettingsStore.loading || InvoicesStore.loading;
        const address = onChainAddress;
        const { lightningAddress } = LightningAddressStore;
        const lightningAddressLoading = LightningAddressStore.loading;

        const error_msg = LSPStore.error_msg || InvoicesStore.error_msg;

        const showCustomPreimageField =
            settings?.invoices?.showCustomPreimageField;

        const lnOnly =
            settings &&
            posStatus &&
            posStatus === 'active' &&
            settings.pos &&
            settings.pos.confirmationPreference &&
            settings.pos.confirmationPreference === 'lnOnly';

        const lnurl = route.params?.lnurlParams;

        const ClearButton = () => (
            <Icon
                name="cancel"
                onPress={() => {
                    this.setState({
                        account: 'default'
                    });
                    InvoicesStore.clearUnified();
                }}
                color={themeColor('text')}
                underlayColor="transparent"
                size={30}
            />
        );

        const SettingsButton = () => (
            <TouchableOpacity onPress={() => this.modalBoxRef.current?.open()}>
                <Gear
                    style={{ alignSelf: 'center' }}
                    fill={themeColor('text')}
                />
            </TouchableOpacity>
        );

        const ADDRESS_TYPES = BackendUtils.supportsTaproot()
            ? [
                  {
                      key: localeString('views.Receive.np2wkhKey'),
                      value: '1',
                      description: localeString(
                          'views.Receive.np2wkhDescription'
                      )
                  },
                  {
                      key: localeString('views.Receive.p2wkhKey'),
                      value: '0',
                      description: localeString(
                          'views.Receive.p2wkhDescription'
                      )
                  },
                  {
                      key: localeString('views.Receive.p2trKey'),
                      value: '4',
                      description: localeString('views.Receive.p2trDescription')
                  }
              ]
            : [
                  {
                      key: localeString('views.Receive.np2wkhKey'),
                      value: '1',
                      description: localeString(
                          'views.Receive.np2wkhDescriptionAlt'
                      )
                  },
                  {
                      key: localeString('views.Receive.p2wkhKey'),
                      value: '0',
                      description: localeString(
                          'views.Receive.p2wkhDescription'
                      )
                  }
              ];

        const unifiedButton = () => (
            <React.Fragment>
                <UnifiedSvg
                    circle={false}
                    selected={selectedIndex === 0 ? true : false}
                />
                <Text
                    style={{
                        color:
                            selectedIndex === 0
                                ? themeColor('background')
                                : themeColor('text'),
                        fontFamily: 'PPNeueMontreal-Book'
                    }}
                >
                    {localeString('general.unified')}
                </Text>
            </React.Fragment>
        );

        const lightningButton = () => (
            <React.Fragment>
                <LightningSvg
                    width={50}
                    height={50}
                    circle={false}
                    selected={selectedIndex === 1 ? true : false}
                />
                <Text
                    style={{
                        color:
                            selectedIndex === 1
                                ? themeColor('background')
                                : themeColor('text'),
                        fontFamily: 'PPNeueMontreal-Book'
                    }}
                >
                    {localeString('general.lightning')}
                </Text>
            </React.Fragment>
        );

        const onChainButton = () => (
            <React.Fragment>
                <OnChainSvg
                    width={50}
                    height={50}
                    circle={false}
                    selected={selectedIndex === 2 ? true : false}
                />
                <Text
                    style={{
                        color:
                            selectedIndex === 2
                                ? themeColor('background')
                                : themeColor('text'),
                        fontFamily: 'PPNeueMontreal-Book'
                    }}
                >
                    {localeString('general.onchain')}
                </Text>
            </React.Fragment>
        );

        const lightningAddressButton = () => (
            <React.Fragment>
                <AddressSvg
                    circle={false}
                    selected={selectedIndex === 3 ? true : false}
                />
                <Text
                    style={{
                        color:
                            selectedIndex === 3
                                ? themeColor('background')
                                : themeColor('text'),
                        fontFamily: 'PPNeueMontreal-Book'
                    }}
                >
                    {localeString('general.lightningAddressCondensed')}
                </Text>
            </React.Fragment>
        );

        const buttons: any =
            BackendUtils.supportsCustomPreimages() && !NodeInfoStore.testnet
                ? [
                      { element: unifiedButton },
                      { element: lightningButton },
                      { element: onChainButton },
                      { element: lightningAddressButton }
                  ]
                : [
                      { element: unifiedButton },
                      { element: lightningButton },
                      { element: onChainButton }
                  ];

        const haveUnifiedInvoice = !!payment_request && !!address;
        const haveInvoice = !!payment_request || !!address;

        let unifiedInvoice,
            lnInvoice,
            lnInvoiceCopyValue,
            btcAddress,
            btcAddressCopyValue;
        // if format is case insensitive, format as all caps to save QR space, otherwise present in original format
        const onChainFormatted =
            address && address === address.toLowerCase()
                ? address.toUpperCase()
                : address;
        if (haveUnifiedInvoice) {
            unifiedInvoice = `bitcoin:${onChainFormatted}?${`lightning=${payment_request.toUpperCase()}`}${
                Number(satAmount) > 0
                    ? `&amount=${new BigNumber(satAmount)
                          .dividedBy(SATS_PER_BTC)
                          .toFormat()}`
                    : ''
            }${memo ? `&message=${memo.replace(/ /g, '%20')}` : ''}`;
        }

        if (payment_request) {
            lnInvoice = `lightning:${payment_request.toUpperCase()}`;
            lnInvoiceCopyValue = payment_request;
        }

        if (address) {
            btcAddress = `bitcoin:${onChainFormatted}${
                (Number(satAmount) > 0 || memo) && '?'
            }${
                Number(satAmount) > 0
                    ? `amount=${new BigNumber(satAmount)
                          .dividedBy(SATS_PER_BTC)
                          .toFormat()}`
                    : ''
            }${
                memo
                    ? Number(satAmount) > 0
                        ? `&message=${memo.replace(/ /g, '%20')}`
                        : `message=${memo.replace(/ /g, '%20')}`
                    : ''
            }`;

            if (Number(satAmount) > 0 || memo) {
                btcAddressCopyValue = btcAddress;
            } else {
                btcAddressCopyValue = address;
            }
        }

        const belowDustLimit: boolean =
            Number(satAmount) !== 0 && Number(satAmount) < 546;

        const windowSize = Dimensions.get('window');

        const tenMButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        expirationIndex === 0
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('time.10min')}
            </Text>
        );
        const oneHButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        expirationIndex === 1
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('time.1H')}
            </Text>
        );
        const oneDButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        expirationIndex === 2
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('time.1D')}
            </Text>
        );
        const oneWButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        expirationIndex === 3
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('time.1W')}
            </Text>
        );

        const expirationButtons: any = [
            { element: tenMButton },
            { element: oneHButton },
            { element: oneDButton },
            { element: oneWButton }
        ];

        const routeHintModeButtons: any = [
            {
                element: () => (
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            color:
                                routeHintMode === RouteHintMode.Automatic
                                    ? themeColor('background')
                                    : themeColor('text')
                        }}
                    >
                        {localeString('general.automatic')}
                    </Text>
                )
            },
            {
                element: () => (
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            color:
                                routeHintMode === RouteHintMode.Custom
                                    ? themeColor('background')
                                    : themeColor('text')
                        }}
                    >
                        {localeString('general.custom')}
                    </Text>
                )
            }
        ];

        const setRouteHintMode = (mode: RouteHintMode) => {
            if (this.state.routeHintMode === mode) {
                return;
            }
            this.setState({
                routeHintMode: mode
            });
            if (
                mode === RouteHintMode.Custom &&
                (!selectedRouteHintChannels ||
                    selectedRouteHintChannels.length === 0)
            ) {
                this.hopPickerRef?.openPicker();
            }
        };

        const enablePrinter: boolean = settings?.pos?.enablePrinter || false;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    onBack={this.onBack}
                    centerComponent={{
                        text:
                            posStatus === 'active'
                                ? localeString('general.pay')
                                : localeString('views.Receive.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        loading ||
                        watchedInvoicePaid ||
                        posStatus === 'active' ||
                        hideRightHeaderComponent ? undefined : route.params
                              ?.selectedIndex === 2 ? (
                            BackendUtils.supportsAddressTypeSelection() &&
                            account === 'default' ? (
                                <SettingsButton />
                            ) : undefined
                        ) : haveInvoice ? (
                            selectedIndex === 2 ? (
                                BackendUtils.supportsAddressTypeSelection() &&
                                account === 'default' ? (
                                    <SettingsButton />
                                ) : (
                                    <ClearButton />
                                )
                            ) : (
                                <ClearButton />
                            )
                        ) : !creatingInvoice &&
                          BackendUtils.supportsAddressTypeSelection() &&
                          account === 'default' &&
                          (selectedIndex === 2 || selectedIndex === 1) ? (
                            <SettingsButton />
                        ) : undefined
                    }
                    navigation={navigation}
                />

                <View style={{ flex: 1 }}>
                    {watchedInvoicePaid ? (
                        <View
                            style={{
                                alignItems: 'center',
                                justifyContent: 'space-evenly',
                                height: '100%'
                            }}
                        >
                            <PaidIndicator />
                            <Wordmark
                                height={windowSize.width * 0.25}
                                width={windowSize.width}
                                fill={themeColor('highlight')}
                            />
                            <SuccessAnimation />
                            <View style={{ alignItems: 'center' }}>
                                <>
                                    <Text
                                        style={{
                                            ...styles.text,
                                            fontSize:
                                                windowSize.width *
                                                windowSize.scale *
                                                0.017,
                                            alignSelf: 'center',
                                            color: themeColor('text'),
                                            textAlign: 'center'
                                        }}
                                    >
                                        {posStatus === 'active'
                                            ? localeString(
                                                  'views.Wallet.Invoices.paid'
                                              )
                                            : `${localeString(
                                                  'views.Receive.youReceived'
                                              )} ${getAmountFromSats(
                                                  watchedInvoicePaidAmt ||
                                                      payment_request_amt ||
                                                      ''
                                              )}`}
                                    </Text>
                                </>
                            </View>
                            {posStatus === 'active' &&
                                Platform.OS === 'android' &&
                                enablePrinter && (
                                    <Button
                                        title={localeString(
                                            'pos.views.Order.printReceipt'
                                        )}
                                        secondary
                                        icon={{ name: 'print', size: 25 }}
                                        onPress={() =>
                                            navigation.navigate('Order', {
                                                orderId: this.state.orderId,
                                                print: true
                                            })
                                        }
                                    />
                                )}
                            <Button
                                title={
                                    posStatus === 'active'
                                        ? localeString('general.goBack')
                                        : localeString(
                                              'views.SendingLightning.goToWallet'
                                          )
                                }
                                icon={{
                                    name: 'list',
                                    size: 25
                                }}
                                onPress={() => navigation.popTo('Wallet')}
                                containerStyle={{ width: '100%' }}
                            />
                        </View>
                    ) : (
                        <ScrollView
                            style={styles.content}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                        >
                            {creatingInvoiceError && (
                                <ErrorMessage
                                    message={localeString(
                                        'views.Receive.errorCreate'
                                    )}
                                />
                            )}
                            {error_msg && <ErrorMessage message={error_msg} />}

                            {showLspSettings && (
                                <View style={{ margin: 10 }}>
                                    <Button
                                        title={localeString(
                                            'views.Receive.goToLspSettings'
                                        )}
                                        onPress={() =>
                                            navigation.navigate('LSPSettings')
                                        }
                                    />
                                </View>
                            )}

                            <View>
                                {!!payment_request && (
                                    <>
                                        {implementation === 'lndhub' &&
                                            !!address &&
                                            !belowDustLimit && (
                                                <WarningMessage
                                                    message={localeString(
                                                        'views.Receive.warningLndHub'
                                                    )}
                                                />
                                            )}
                                        {!!lnurl && (
                                            <SuccessMessage
                                                message={
                                                    !!lnurl &&
                                                    `${localeString(
                                                        'views.Receive.successCreate'
                                                    )} ${localeString(
                                                        'views.Receive.andSentTo'
                                                    )} ${lnurl.domain}`
                                                }
                                            />
                                        )}
                                    </>
                                )}
                                {(creatingInvoice || loading) && (
                                    <View style={{ marginTop: 40 }}>
                                        <LoadingIndicator />
                                    </View>
                                )}
                                {haveInvoice && account !== 'default' && (
                                    <WarningMessage
                                        message={`${localeString(
                                            'general.externalAccount'
                                        )}: ${account}`}
                                    />
                                )}
                                {haveInvoice &&
                                    lspIsActive &&
                                    satAmount === '0' &&
                                    (selectedIndex === 0 ||
                                        selectedIndex === 1) && (
                                        <View
                                            style={{
                                                backgroundColor:
                                                    themeColor('secondary'),
                                                borderRadius: 10,
                                                top: 10,
                                                margin: 10,
                                                padding: 15,
                                                borderWidth: 0.5
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontFamily:
                                                        'PPNeueMontreal-Medium',
                                                    color: themeColor('text'),
                                                    fontSize: 15
                                                }}
                                            >
                                                {localeString(
                                                    'views.Receive.lspZeroAmt'
                                                )}
                                            </Text>
                                        </View>
                                    )}
                                {haveInvoice &&
                                    zeroConfFee &&
                                    zeroConfFee > 0 &&
                                    (selectedIndex == 0 ||
                                        selectedIndex == 1) && (
                                        <TouchableOpacity
                                            onPress={() =>
                                                navigation.navigate(
                                                    new BigNumber(
                                                        zeroConfFee
                                                    ).gt(1000)
                                                        ? 'LspExplanationFees'
                                                        : 'LspExplanationRouting'
                                                )
                                            }
                                        >
                                            <View
                                                style={{
                                                    backgroundColor:
                                                        themeColor('secondary'),
                                                    borderRadius: 10,
                                                    top: 10,
                                                    margin: 10,
                                                    padding: 15,
                                                    borderWidth: 0.5
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        fontFamily:
                                                            'PPNeueMontreal-Medium',
                                                        color: themeColor(
                                                            'text'
                                                        ),
                                                        marginBottom: 5
                                                    }}
                                                >
                                                    {localeString(
                                                        new BigNumber(
                                                            zeroConfFee
                                                        ).gt(1000)
                                                            ? selectedIndex ===
                                                              0
                                                                ? 'views.Receive.lspExplainerUnified'
                                                                : 'views.Receive.lspExplainer'
                                                            : selectedIndex ===
                                                              0
                                                            ? 'views.Receive.lspExplainerRoutingUnified'
                                                            : 'views.Receive.lspExplainerRouting'
                                                    )}
                                                </Text>
                                                <Amount
                                                    sats={zeroConfFee}
                                                    fixedUnits="sats"
                                                />
                                                <Text
                                                    style={{
                                                        fontFamily:
                                                            'PPNeueMontreal-Medium',
                                                        color: themeColor(
                                                            'secondaryText'
                                                        ),
                                                        fontSize: 15,
                                                        top: 5,
                                                        textAlign: 'right'
                                                    }}
                                                >
                                                    {localeString(
                                                        'general.tapToLearnMore'
                                                    )}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                {haveInvoice &&
                                    zeroConfFee === 0 &&
                                    (selectedIndex == 0 ||
                                        selectedIndex == 1) && (
                                        <TouchableOpacity
                                            onPress={() =>
                                                navigation.navigate(
                                                    'LspExplanationWrappedInvoices'
                                                )
                                            }
                                        >
                                            <View
                                                style={{
                                                    backgroundColor:
                                                        themeColor('secondary'),
                                                    borderRadius: 10,
                                                    top: 10,
                                                    margin: 10,
                                                    padding: 15,
                                                    borderWidth: 0.5
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        fontFamily:
                                                            'PPNeueMontreal-Medium',
                                                        color: themeColor(
                                                            'text'
                                                        ),
                                                        marginBottom: 5
                                                    }}
                                                >
                                                    {localeString(
                                                        'views.Receive.lspExplainerZeroFeeWrapper'
                                                    )}
                                                </Text>
                                                <Text
                                                    style={{
                                                        fontFamily:
                                                            'PPNeueMontreal-Medium',
                                                        color: themeColor(
                                                            'secondaryText'
                                                        ),
                                                        fontSize: 15,
                                                        top: 5,
                                                        textAlign: 'right'
                                                    }}
                                                >
                                                    {localeString(
                                                        'general.tapToLearnMore'
                                                    )}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                {haveInvoice && !creatingInvoiceError && (
                                    <View>
                                        {selectedIndex == 0 &&
                                            !belowDustLimit &&
                                            haveUnifiedInvoice && (
                                                <CollapsedQR
                                                    value={unifiedInvoice || ''}
                                                    copyText={localeString(
                                                        'views.Receive.copyInvoice'
                                                    )}
                                                    expanded
                                                    textBottom
                                                    truncateLongValue
                                                    logo={
                                                        themeColor(
                                                            'invertQrIcons'
                                                        )
                                                            ? ZIconWhite
                                                            : ZIcon
                                                    }
                                                    nfcSupported={nfcSupported}
                                                    satAmount={satAmount}
                                                    displayAmount={
                                                        settings?.invoices
                                                            ?.displayAmountOnInvoice ||
                                                        false
                                                    }
                                                />
                                            )}
                                        {selectedIndex == 1 &&
                                            !belowDustLimit &&
                                            haveUnifiedInvoice && (
                                                <CollapsedQR
                                                    value={lnInvoice || ''}
                                                    copyValue={
                                                        lnInvoiceCopyValue
                                                    }
                                                    copyText={localeString(
                                                        'views.Receive.copyInvoice'
                                                    )}
                                                    expanded
                                                    textBottom
                                                    truncateLongValue
                                                    logo={
                                                        themeColor(
                                                            'invertQrIcons'
                                                        )
                                                            ? LightningIconWhite
                                                            : LightningIcon
                                                    }
                                                    nfcSupported={nfcSupported}
                                                    satAmount={satAmount}
                                                    displayAmount={
                                                        settings?.invoices
                                                            ?.displayAmountOnInvoice ||
                                                        false
                                                    }
                                                />
                                            )}
                                        {selectedIndex == 2 &&
                                            !belowDustLimit &&
                                            btcAddress && (
                                                <CollapsedQR
                                                    value={btcAddress}
                                                    copyValue={
                                                        btcAddressCopyValue
                                                    }
                                                    copyText={localeString(
                                                        'views.Receive.copyAddress'
                                                    )}
                                                    expanded
                                                    textBottom
                                                    truncateLongValue
                                                    logo={
                                                        themeColor(
                                                            'invertQrIcons'
                                                        )
                                                            ? OnChainIconWhite
                                                            : OnChainIcon
                                                    }
                                                    nfcSupported={nfcSupported}
                                                    satAmount={
                                                        satAmount === '0'
                                                            ? undefined
                                                            : satAmount
                                                    }
                                                    displayAmount={
                                                        settings?.invoices
                                                            ?.displayAmountOnInvoice ||
                                                        false
                                                    }
                                                />
                                            )}

                                        {selectedIndex == 3 &&
                                            !lightningAddressLoading &&
                                            !lightningAddress && (
                                                <View
                                                    style={{
                                                        marginTop: 20,
                                                        marginBottom: 20
                                                    }}
                                                >
                                                    <Button
                                                        title={localeString(
                                                            'views.Receive.createLightningAddress'
                                                        )}
                                                        onPress={() =>
                                                            navigation.navigate(
                                                                'LightningAddress'
                                                            )
                                                        }
                                                    />
                                                </View>
                                            )}

                                        {selectedIndex == 3 &&
                                            !lightningAddressLoading && (
                                                <Row
                                                    style={{
                                                        alignSelf: 'center',
                                                        marginBottom: 15
                                                    }}
                                                >
                                                    <Text
                                                        style={{
                                                            fontFamily:
                                                                'PPNeueMontreal-Book',
                                                            fontSize:
                                                                26 / fontScale,
                                                            color: themeColor(
                                                                'text'
                                                            ),
                                                            textAlign: 'center'
                                                        }}
                                                    >
                                                        {lightningAddress}
                                                    </Text>
                                                </Row>
                                            )}

                                        {selectedIndex == 3 &&
                                            !lightningAddressLoading &&
                                            lightningAddress && (
                                                <CollapsedQR
                                                    value={`lightning:${lightningAddress}`}
                                                    copyText={localeString(
                                                        'views.Receive.copyAddress'
                                                    )}
                                                    expanded
                                                    textBottom
                                                    hideText
                                                    logo={
                                                        themeColor(
                                                            'invertQrIcons'
                                                        )
                                                            ? ZPayIconWhite
                                                            : ZPayIcon
                                                    }
                                                    nfcSupported={nfcSupported}
                                                />
                                            )}

                                        {selectedIndex == 3 &&
                                            lightningAddressLoading && (
                                                <View style={{ margin: 40 }}>
                                                    <LoadingIndicator />
                                                </View>
                                            )}

                                        {(selectedIndex === 0 ||
                                            selectedIndex === 1) &&
                                            (belowDustLimit ||
                                                !haveUnifiedInvoice) && (
                                                <CollapsedQR
                                                    value={lnInvoice || ''}
                                                    copyValue={
                                                        lnInvoiceCopyValue
                                                    }
                                                    copyText={localeString(
                                                        'views.Receive.copyInvoice'
                                                    )}
                                                    expanded
                                                    textBottom
                                                    truncateLongValue
                                                    nfcSupported={nfcSupported}
                                                    satAmount={satAmount}
                                                    displayAmount={
                                                        settings?.invoices
                                                            ?.displayAmountOnInvoice ||
                                                        false
                                                    }
                                                />
                                            )}
                                        {!(
                                            selectedIndex === 3 &&
                                            (!lightningAddress ||
                                                lightningAddressLoading)
                                        ) &&
                                            nfcSupported && (
                                                <View
                                                    style={[
                                                        styles.button,
                                                        { paddingTop: 0 }
                                                    ]}
                                                >
                                                    <Button
                                                        title={
                                                            posStatus ===
                                                            'active'
                                                                ? localeString(
                                                                      'general.payNfc'
                                                                  )
                                                                : localeString(
                                                                      'general.receiveNfc'
                                                                  )
                                                        }
                                                        icon={{
                                                            name: 'nfc',
                                                            size: 25
                                                        }}
                                                        onPress={() =>
                                                            this.enableNfc()
                                                        }
                                                        secondary
                                                    />
                                                </View>
                                            )}
                                    </View>
                                )}
                                {!loading &&
                                    !haveInvoice &&
                                    !creatingInvoice &&
                                    route.params?.selectedIndex !== 2 && (
                                        <>
                                            {BackendUtils.supportsFlowLSP() &&
                                                !flowLspNotConfigured && (
                                                    <View
                                                        style={{
                                                            flexDirection:
                                                                'row',
                                                            marginBottom: 15
                                                        }}
                                                    >
                                                        <View
                                                            style={{ flex: 1 }}
                                                        >
                                                            <Text
                                                                style={{
                                                                    ...styles.secondaryText,
                                                                    color: themeColor(
                                                                        'secondaryText'
                                                                    )
                                                                }}
                                                                infoModalText={[
                                                                    localeString(
                                                                        'views.Receive.lspSwitchExplainer1'
                                                                    ),
                                                                    localeString(
                                                                        'views.Receive.lspSwitchExplainer2'
                                                                    )
                                                                ]}
                                                                infoModalAdditionalButtons={[
                                                                    {
                                                                        title: localeString(
                                                                            'general.learnMore'
                                                                        ),
                                                                        callback:
                                                                            () =>
                                                                                navigation.navigate(
                                                                                    'LspExplanationOverview'
                                                                                )
                                                                    }
                                                                ]}
                                                            >
                                                                {localeString(
                                                                    'views.Settings.LSP.enableLSP'
                                                                )}
                                                            </Text>
                                                        </View>
                                                        <View
                                                            style={{
                                                                alignSelf:
                                                                    'center',
                                                                marginLeft: 5
                                                            }}
                                                        >
                                                            <Switch
                                                                value={
                                                                    enableLSP
                                                                }
                                                                onValueChange={async () => {
                                                                    this.setState(
                                                                        {
                                                                            enableLSP:
                                                                                !enableLSP,
                                                                            lspIsActive:
                                                                                !enableLSP &&
                                                                                BackendUtils.supportsFlowLSP() &&
                                                                                !flowLspNotConfigured
                                                                        }
                                                                    );
                                                                    await updateSettings(
                                                                        {
                                                                            enableLSP:
                                                                                !enableLSP
                                                                        }
                                                                    );
                                                                }}
                                                            />
                                                        </View>
                                                    </View>
                                                )}

                                            {(!enableLSP ||
                                                flowLspNotConfigured) && (
                                                <>
                                                    <Text
                                                        style={{
                                                            ...styles.secondaryText,
                                                            color: themeColor(
                                                                'secondaryText'
                                                            )
                                                        }}
                                                    >
                                                        {localeString(
                                                            'views.Receive.memo'
                                                        )}
                                                    </Text>
                                                    <TextInput
                                                        placeholder={localeString(
                                                            'views.Receive.memoPlaceholder'
                                                        )}
                                                        value={memo}
                                                        onChangeText={(
                                                            text: string
                                                        ) => {
                                                            this.setState({
                                                                memo: text
                                                            });
                                                            clearUnified();
                                                        }}
                                                    />
                                                </>
                                            )}

                                            <AmountInput
                                                amount={value}
                                                title={`${localeString(
                                                    'views.Receive.amount'
                                                )} ${
                                                    lnurl &&
                                                    lnurl.minWithdrawable !==
                                                        lnurl.maxWithdrawable
                                                        ? ` (${Math.ceil(
                                                              lnurl.minWithdrawable /
                                                                  1000
                                                          )} - ${Math.floor(
                                                              lnurl.maxWithdrawable /
                                                                  1000
                                                          )})`
                                                        : ''
                                                }`}
                                                locked={
                                                    lnurl &&
                                                    lnurl.minWithdrawable ===
                                                        lnurl.maxWithdrawable
                                                        ? true
                                                        : false
                                                }
                                                onAmountChange={(
                                                    amount: string,
                                                    satAmount: string | number
                                                ) => {
                                                    let needInbound = false;
                                                    if (
                                                        lspIsActive &&
                                                        satAmount != '0' &&
                                                        new BigNumber(
                                                            satAmount
                                                        ).gt(
                                                            this.props
                                                                .ChannelsStore
                                                                .totalInbound
                                                        )
                                                    ) {
                                                        needInbound = true;
                                                    }
                                                    this.setState({
                                                        value: amount,
                                                        satAmount,
                                                        needInbound
                                                    });
                                                }}
                                            />

                                            {needInbound && (
                                                <TouchableOpacity
                                                    onPress={() =>
                                                        navigation.navigate(
                                                            'LspExplanationFees'
                                                        )
                                                    }
                                                >
                                                    <View
                                                        style={{
                                                            backgroundColor:
                                                                themeColor(
                                                                    'secondary'
                                                                ),
                                                            borderRadius: 10,
                                                            borderColor:
                                                                themeColor(
                                                                    'highlight'
                                                                ),
                                                            padding: 15,
                                                            borderWidth: 0.5,
                                                            top: 5,
                                                            marginBottom: 20
                                                        }}
                                                    >
                                                        <Text
                                                            style={{
                                                                fontFamily:
                                                                    'PPNeueMontreal-Medium',
                                                                color: themeColor(
                                                                    'text'
                                                                ),
                                                                fontSize: 15
                                                            }}
                                                        >
                                                            {this.props
                                                                .ChannelsStore
                                                                .channels
                                                                .length === 0
                                                                ? localeString(
                                                                      'views.Wallet.KeypadPane.lspExplainerFirstChannel'
                                                                  )
                                                                : localeString(
                                                                      'views.Wallet.KeypadPane.lspExplainer'
                                                                  )}
                                                        </Text>
                                                        <Text
                                                            style={{
                                                                fontFamily:
                                                                    'PPNeueMontreal-Medium',
                                                                color: themeColor(
                                                                    'secondaryText'
                                                                ),
                                                                fontSize: 15,
                                                                top: 5,
                                                                textAlign:
                                                                    'right'
                                                            }}
                                                        >
                                                            {localeString(
                                                                'general.tapToLearnMore'
                                                            )}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            )}

                                            {implementation !== 'lndhub' && (
                                                <>
                                                    <Text
                                                        style={{
                                                            ...styles.secondaryText,
                                                            color: themeColor(
                                                                'secondaryText'
                                                            )
                                                        }}
                                                    >
                                                        {localeString(
                                                            'views.Receive.expiration'
                                                        )}
                                                    </Text>
                                                    <Row
                                                        style={{
                                                            width: '100%'
                                                        }}
                                                    >
                                                        <TextInput
                                                            keyboardType="numeric"
                                                            value={expiry}
                                                            style={{
                                                                width: '58%'
                                                            }}
                                                            onChangeText={(
                                                                text: string
                                                            ) => {
                                                                let expirySeconds =
                                                                    '3600';
                                                                if (
                                                                    timePeriod ===
                                                                    'Seconds'
                                                                ) {
                                                                    expirySeconds =
                                                                        text;
                                                                } else if (
                                                                    timePeriod ===
                                                                    'Minutes'
                                                                ) {
                                                                    expirySeconds =
                                                                        new BigNumber(
                                                                            text
                                                                        )
                                                                            .multipliedBy(
                                                                                60
                                                                            )
                                                                            .toString();
                                                                } else if (
                                                                    timePeriod ===
                                                                    'Hours'
                                                                ) {
                                                                    expirySeconds =
                                                                        new BigNumber(
                                                                            text
                                                                        )
                                                                            .multipliedBy(
                                                                                60 *
                                                                                    60
                                                                            )
                                                                            .toString();
                                                                } else if (
                                                                    timePeriod ===
                                                                    'Days'
                                                                ) {
                                                                    expirySeconds =
                                                                        new BigNumber(
                                                                            text
                                                                        )
                                                                            .multipliedBy(
                                                                                60 *
                                                                                    60 *
                                                                                    24
                                                                            )
                                                                            .toString();
                                                                } else if (
                                                                    timePeriod ===
                                                                    'Weeks'
                                                                ) {
                                                                    expirySeconds =
                                                                        new BigNumber(
                                                                            text
                                                                        )
                                                                            .multipliedBy(
                                                                                60 *
                                                                                    60 *
                                                                                    24 *
                                                                                    7
                                                                            )
                                                                            .toString();
                                                                }

                                                                if (
                                                                    expirySeconds ==
                                                                    '600'
                                                                ) {
                                                                    this.setState(
                                                                        {
                                                                            expiry: text,
                                                                            expirySeconds,
                                                                            expirationIndex: 0
                                                                        }
                                                                    );
                                                                } else if (
                                                                    expirySeconds ==
                                                                    '3600'
                                                                ) {
                                                                    this.setState(
                                                                        {
                                                                            expiry: text,
                                                                            expirySeconds,
                                                                            expirationIndex: 1
                                                                        }
                                                                    );
                                                                } else if (
                                                                    expirySeconds ==
                                                                    '86400'
                                                                ) {
                                                                    this.setState(
                                                                        {
                                                                            expiry: text,
                                                                            expirySeconds,
                                                                            expirationIndex: 2
                                                                        }
                                                                    );
                                                                } else if (
                                                                    expirySeconds ==
                                                                    '604800'
                                                                ) {
                                                                    this.setState(
                                                                        {
                                                                            expiry: text,
                                                                            expirySeconds,
                                                                            expirationIndex: 3
                                                                        }
                                                                    );
                                                                } else {
                                                                    this.setState(
                                                                        {
                                                                            expiry: text,
                                                                            expirySeconds,
                                                                            expirationIndex: 5
                                                                        }
                                                                    );
                                                                }
                                                            }}
                                                        />
                                                        <View
                                                            style={{
                                                                flex: 1,
                                                                // TODO
                                                                top: -5
                                                            }}
                                                        >
                                                            <DropdownSetting
                                                                selectedValue={
                                                                    timePeriod
                                                                }
                                                                values={
                                                                    TIME_PERIOD_KEYS
                                                                }
                                                                onValueChange={async (
                                                                    value: string
                                                                ) => {
                                                                    let expirySeconds =
                                                                        '3600';
                                                                    if (
                                                                        value ===
                                                                        'Seconds'
                                                                    ) {
                                                                        expirySeconds =
                                                                            expiry;
                                                                    } else if (
                                                                        value ===
                                                                        'Minutes'
                                                                    ) {
                                                                        expirySeconds =
                                                                            new BigNumber(
                                                                                expiry
                                                                            )
                                                                                .multipliedBy(
                                                                                    60
                                                                                )
                                                                                .toString();
                                                                    } else if (
                                                                        value ===
                                                                        'Hours'
                                                                    ) {
                                                                        expirySeconds =
                                                                            new BigNumber(
                                                                                expiry
                                                                            )
                                                                                .multipliedBy(
                                                                                    60 *
                                                                                        60
                                                                                )
                                                                                .toString();
                                                                    } else if (
                                                                        value ===
                                                                        'Days'
                                                                    ) {
                                                                        expirySeconds =
                                                                            new BigNumber(
                                                                                expiry
                                                                            )
                                                                                .multipliedBy(
                                                                                    60 *
                                                                                        60 *
                                                                                        24
                                                                                )
                                                                                .toString();
                                                                    } else if (
                                                                        value ===
                                                                        'Weeks'
                                                                    ) {
                                                                        expirySeconds =
                                                                            new BigNumber(
                                                                                expiry
                                                                            )
                                                                                .multipliedBy(
                                                                                    60 *
                                                                                        60 *
                                                                                        24 *
                                                                                        7
                                                                                )
                                                                                .toString();
                                                                    }

                                                                    let expirationIndex;
                                                                    if (
                                                                        expirySeconds ===
                                                                        '600'
                                                                    ) {
                                                                        expirationIndex = 0;
                                                                    } else if (
                                                                        expirySeconds ===
                                                                        '3600'
                                                                    ) {
                                                                        expirationIndex = 1;
                                                                    } else if (
                                                                        expirySeconds ===
                                                                        '86400'
                                                                    ) {
                                                                        expirationIndex = 2;
                                                                    } else if (
                                                                        expirySeconds ===
                                                                        '604800'
                                                                    ) {
                                                                        expirationIndex = 3;
                                                                    } else {
                                                                        expirationIndex = 4;
                                                                    }

                                                                    this.setState(
                                                                        {
                                                                            timePeriod:
                                                                                value,
                                                                            expirySeconds,
                                                                            expirationIndex
                                                                        }
                                                                    );
                                                                }}
                                                            />
                                                        </View>
                                                    </Row>

                                                    <ButtonGroup
                                                        onPress={
                                                            this
                                                                .updateExpirationIndex
                                                        }
                                                        selectedIndex={
                                                            expirationIndex
                                                        }
                                                        buttons={
                                                            expirationButtons
                                                        }
                                                        selectedButtonStyle={{
                                                            backgroundColor:
                                                                themeColor(
                                                                    'highlight'
                                                                ),
                                                            borderRadius: 12
                                                        }}
                                                        containerStyle={{
                                                            backgroundColor:
                                                                themeColor(
                                                                    'secondary'
                                                                ),
                                                            borderRadius: 12,
                                                            borderWidth: 0,
                                                            height: 30
                                                        }}
                                                        innerBorderStyle={{
                                                            color: themeColor(
                                                                'secondary'
                                                            )
                                                        }}
                                                    />
                                                </>
                                            )}

                                            {BackendUtils.supportsCustomPreimages() &&
                                                showCustomPreimageField && (
                                                    <>
                                                        <Text
                                                            style={{
                                                                ...styles.secondaryText,
                                                                color: themeColor(
                                                                    'secondaryText'
                                                                )
                                                            }}
                                                        >
                                                            {localeString(
                                                                'views.Receive.customPreimage'
                                                            )}
                                                        </Text>
                                                        <TextInput
                                                            value={
                                                                customPreimage
                                                            }
                                                            onChangeText={(
                                                                text: string
                                                            ) =>
                                                                this.setState({
                                                                    customPreimage:
                                                                        text
                                                                })
                                                            }
                                                        />
                                                    </>
                                                )}

                                            {BackendUtils.isLNDBased() &&
                                                !lspIsActive && (
                                                    <View
                                                        style={{
                                                            flexDirection:
                                                                'row',
                                                            marginTop: 20
                                                        }}
                                                    >
                                                        <View
                                                            style={{ flex: 1 }}
                                                        >
                                                            <Text
                                                                style={{
                                                                    ...styles.secondaryText,
                                                                    color: themeColor(
                                                                        'secondaryText'
                                                                    )
                                                                }}
                                                                infoModalText={[
                                                                    localeString(
                                                                        'views.Receive.routeHintSwitchExplainer1'
                                                                    ),
                                                                    localeString(
                                                                        'views.Receive.routeHintSwitchExplainer2'
                                                                    ),
                                                                    localeString(
                                                                        'views.Receive.routeHintSwitchExplainer3'
                                                                    )
                                                                ]}
                                                            >
                                                                {localeString(
                                                                    'views.Receive.routeHints'
                                                                )}
                                                            </Text>
                                                        </View>
                                                        <View
                                                            style={{
                                                                alignSelf:
                                                                    'center',
                                                                marginLeft: 5
                                                            }}
                                                        >
                                                            <Switch
                                                                value={
                                                                    routeHints
                                                                }
                                                                onValueChange={() =>
                                                                    this.setState(
                                                                        {
                                                                            routeHints:
                                                                                !routeHints
                                                                        }
                                                                    )
                                                                }
                                                                disabled={
                                                                    blindedPaths
                                                                }
                                                            />
                                                        </View>
                                                    </View>
                                                )}

                                            {BackendUtils.isLNDBased() &&
                                                !lspIsActive &&
                                                routeHints && (
                                                    <Row>
                                                        <Text
                                                            style={{
                                                                ...styles.secondaryText,
                                                                color: themeColor(
                                                                    'secondaryText'
                                                                )
                                                            }}
                                                        >
                                                            {localeString(
                                                                'general.mode'
                                                            )}
                                                        </Text>
                                                        <ButtonGroup
                                                            onPress={
                                                                setRouteHintMode
                                                            }
                                                            selectedIndex={
                                                                routeHintMode
                                                            }
                                                            buttons={
                                                                routeHintModeButtons
                                                            }
                                                            selectedButtonStyle={{
                                                                backgroundColor:
                                                                    themeColor(
                                                                        'highlight'
                                                                    ),
                                                                borderRadius: 12
                                                            }}
                                                            containerStyle={{
                                                                backgroundColor:
                                                                    themeColor(
                                                                        'secondary'
                                                                    ),
                                                                borderRadius: 12,
                                                                borderWidth: 0,
                                                                height: 30,
                                                                flex: 1
                                                            }}
                                                            innerBorderStyle={{
                                                                color: themeColor(
                                                                    'secondary'
                                                                )
                                                            }}
                                                        />
                                                    </Row>
                                                )}

                                            {BackendUtils.isLNDBased() &&
                                                routeHints && (
                                                    <HopPicker
                                                        ref={(ref) =>
                                                            (this.hopPickerRef =
                                                                ref)
                                                        }
                                                        onValueChange={(
                                                            channels
                                                        ) => {
                                                            this.setState({
                                                                selectedRouteHintChannels:
                                                                    channels
                                                            });
                                                        }}
                                                        onCancel={() => {
                                                            if (
                                                                !selectedRouteHintChannels?.length
                                                            ) {
                                                                setRouteHintMode(
                                                                    RouteHintMode.Automatic
                                                                );
                                                            }
                                                        }}
                                                        title={localeString(
                                                            'views.Receive.customRouteHints'
                                                        )}
                                                        ChannelsStore={
                                                            this.props
                                                                .ChannelsStore
                                                        }
                                                        UnitsStore={UnitsStore}
                                                        containerStyle={{
                                                            display:
                                                                routeHintMode ===
                                                                RouteHintMode.Automatic
                                                                    ? 'none'
                                                                    : 'flex'
                                                        }}
                                                        clearOnTap={false}
                                                        selectionMode={
                                                            'multiple'
                                                        }
                                                        selectedChannels={
                                                            selectedRouteHintChannels
                                                        }
                                                    />
                                                )}

                                            {BackendUtils.supportsAMP() &&
                                                !lspIsActive && (
                                                    <View
                                                        style={{
                                                            flexDirection:
                                                                'row',
                                                            marginTop: 20
                                                        }}
                                                    >
                                                        <View
                                                            style={{ flex: 1 }}
                                                        >
                                                            <Text
                                                                style={{
                                                                    ...styles.secondaryText,
                                                                    color: themeColor(
                                                                        'secondaryText'
                                                                    )
                                                                }}
                                                                infoModalText={[
                                                                    localeString(
                                                                        'views.Receive.ampSwitchExplainer1'
                                                                    ),
                                                                    localeString(
                                                                        'views.Receive.ampSwitchExplainer2'
                                                                    )
                                                                ]}
                                                                infoModalLink="https://docs.lightning.engineering/lightning-network-tools/lnd/amp"
                                                            >
                                                                {localeString(
                                                                    'views.Receive.ampInvoice'
                                                                )}
                                                            </Text>
                                                        </View>
                                                        <View
                                                            style={{
                                                                alignSelf:
                                                                    'center',
                                                                marginLeft: 5
                                                            }}
                                                        >
                                                            <Switch
                                                                value={
                                                                    ampInvoice
                                                                }
                                                                onValueChange={() =>
                                                                    this.setState(
                                                                        {
                                                                            ampInvoice:
                                                                                !ampInvoice
                                                                        }
                                                                    )
                                                                }
                                                                disabled={
                                                                    blindedPaths
                                                                }
                                                            />
                                                        </View>
                                                    </View>
                                                )}

                                            {BackendUtils.supportsBolt11BlindedRoutes() &&
                                                !lspIsActive && (
                                                    <View
                                                        style={{
                                                            flexDirection:
                                                                'row',
                                                            marginTop: 20
                                                        }}
                                                    >
                                                        <View
                                                            style={{ flex: 1 }}
                                                        >
                                                            <Text
                                                                style={{
                                                                    ...styles.secondaryText,
                                                                    color: themeColor(
                                                                        'secondaryText'
                                                                    )
                                                                }}
                                                                infoModalText={[
                                                                    localeString(
                                                                        'views.Receive.blindedPathsExplainer1'
                                                                    ),
                                                                    localeString(
                                                                        'views.Receive.blindedPathsExplainer2'
                                                                    )
                                                                ]}
                                                                infoModalLink="https://lightningprivacy.com/en/blinded-trampoline"
                                                            >
                                                                {localeString(
                                                                    'views.Receive.blindedPaths'
                                                                )}
                                                            </Text>
                                                        </View>
                                                        <View
                                                            style={{
                                                                alignSelf:
                                                                    'center',
                                                                marginLeft: 5
                                                            }}
                                                        >
                                                            <Switch
                                                                value={
                                                                    blindedPaths
                                                                }
                                                                onValueChange={() =>
                                                                    this.setState(
                                                                        {
                                                                            blindedPaths:
                                                                                !blindedPaths,
                                                                            ampInvoice:
                                                                                false,
                                                                            routeHints:
                                                                                false
                                                                        }
                                                                    )
                                                                }
                                                            />
                                                        </View>
                                                    </View>
                                                )}

                                            <View style={styles.button}>
                                                <Button
                                                    title={
                                                        localeString(
                                                            'views.Receive.createInvoice'
                                                        ) +
                                                        (lnurl
                                                            ? ` ${localeString(
                                                                  'views.Receive.andSubmitTo'
                                                              )} ${
                                                                  lnurl.domain
                                                              }`
                                                            : '')
                                                    }
                                                    onPress={() => {
                                                        // If clearButton was used in on-chain tab
                                                        // and a new invoice below dust limit is created
                                                        // reset selectedIndex to 1 (lightning)
                                                        if (
                                                            selectedIndex ===
                                                                2 &&
                                                            belowDustLimit
                                                        ) {
                                                            this.setState({
                                                                selectedIndex: 1
                                                            });
                                                        }
                                                        createUnifiedInvoice({
                                                            memo: lspIsActive
                                                                ? ''
                                                                : memo,
                                                            value:
                                                                satAmount.toString() ||
                                                                '0',
                                                            expiry: expirySeconds,
                                                            lnurl,
                                                            ampInvoice:
                                                                lspIsActive
                                                                    ? false
                                                                    : ampInvoice ||
                                                                      false,
                                                            blindedPaths:
                                                                lspIsActive
                                                                    ? false
                                                                    : blindedPaths ||
                                                                      false,
                                                            routeHints,
                                                            routeHintChannels:
                                                                routeHintMode ===
                                                                RouteHintMode.Custom
                                                                    ? selectedRouteHintChannels
                                                                    : undefined,
                                                            addressType:
                                                                BackendUtils.supportsAddressTypeSelection()
                                                                    ? addressType
                                                                    : undefined,
                                                            customPreimage:
                                                                BackendUtils.supportsCustomPreimages() &&
                                                                showCustomPreimageField
                                                                    ? customPreimage
                                                                    : undefined,
                                                            noLsp: !lspIsActive
                                                        }).then(
                                                            ({
                                                                rHash,
                                                                onChainAddress
                                                            }: {
                                                                rHash: string;
                                                                onChainAddress?: string;
                                                            }) => {
                                                                this.subscribeInvoice(
                                                                    rHash,
                                                                    onChainAddress
                                                                );
                                                            }
                                                        );
                                                    }}
                                                />
                                            </View>
                                        </>
                                    )}
                            </View>
                        </ScrollView>
                    )}
                </View>
                <View style={{ bottom: 0 }}>
                    {!belowDustLimit &&
                        haveUnifiedInvoice &&
                        !lnOnly &&
                        !watchedInvoicePaid && (
                            <ButtonGroup
                                onPress={this.updateIndex}
                                selectedIndex={selectedIndex}
                                buttons={buttons}
                                selectedButtonStyle={{
                                    backgroundColor: themeColor('highlight'),
                                    borderRadius: 12
                                }}
                                containerStyle={{
                                    backgroundColor: themeColor('secondary'),
                                    borderRadius: 12,
                                    borderWidth: 0,
                                    height: 80
                                }}
                                innerBorderStyle={{
                                    color: themeColor('secondary')
                                }}
                            />
                        )}
                </View>
                <ModalBox
                    style={{
                        backgroundColor: themeColor('background'),
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        height: BackendUtils.supportsTaproot() ? 450 : 350,
                        paddingLeft: 24,
                        paddingRight: 24
                    }}
                    swipeToClose={true}
                    backButtonClose={true}
                    position="bottom"
                    ref={this.modalBoxRef}
                >
                    <ScrollView>
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontSize: 24,
                                fontWeight: 'bold',
                                paddingTop: 24,
                                paddingBottom: 24
                            }}
                        >
                            {localeString('views.Receive.addressType')}
                        </Text>
                        {_map(ADDRESS_TYPES, (d, index) => (
                            <TouchableOpacity
                                key={index}
                                onPress={() => {
                                    // If same address type is selected, close modal
                                    if (d.value === addressType) {
                                        this.modalBoxRef.current?.close();
                                        return;
                                    }
                                    InvoicesStore.clearAddress();
                                    this.setState({ addressType: d.value });

                                    // Only auto-generate if we're in on-chain mode
                                    if (selectedIndex === 2) {
                                        this.autoGenerateOnChainAddress(
                                            account,
                                            d.value
                                        );
                                    }
                                    this.modalBoxRef.current?.close();
                                }}
                                style={{
                                    backgroundColor: themeColor('secondary'),
                                    borderColor:
                                        d.value === addressType
                                            ? themeColor('highlight')
                                            : themeColor('secondaryText'),
                                    borderRadius: 4,
                                    borderWidth:
                                        d.value === addressType ? 2 : 1,
                                    padding: 16,
                                    marginBottom: 24
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontSize: 16,
                                        fontWeight: 'bold',
                                        marginBottom: 4
                                    }}
                                >
                                    {d.key}
                                </Text>
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontSize: 16,
                                        fontWeight: 'normal'
                                    }}
                                >
                                    {d.description}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </ModalBox>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    button: {
        paddingTop: 25,
        paddingBottom: 15
    },
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    secondaryText: {
        fontFamily: 'PPNeueMontreal-Book'
    }
});
