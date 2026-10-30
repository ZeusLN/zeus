import * as React from 'react';
import {
    Alert,
    Dimensions,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { LNURLWithdrawParams } from 'js-lnurl';
import { ButtonGroup, Icon } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import NfcManager from 'react-native-nfc-manager';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Clipboard from '@react-native-clipboard/clipboard';
import cloneDeep from 'lodash/cloneDeep';

import handleAnything from '../../utils/handleAnything';
import { isUnsafeLnurlError } from '../../utils/LnurlResolveUtils';

import Wordmark from '../../assets/images/SVG/wordmark-black.svg';

const ZPayIcon = require('../../assets/images/pay_z_black.png');

const ZPayIconWhite = require('../../assets/images/pay_z_white.png');

import AmountInput, { getSatAmount } from '../../components/AmountInput';
import Button from '../../components/Button';
import CollapsedQR from '../../components/CollapsedQR';
import EcashMintPicker from '../../components/EcashMintPicker';
import Header from '../../components/Header';
import HopPicker from '../../components/HopPicker';
import LoadingIndicator from '../../components/LoadingIndicator';
import PaidIndicator from '../../components/PaidIndicator';
import Screen from '../../components/Screen';
import SuccessAnimation from '../../components/SuccessAnimation';
import {
    SuccessMessage,
    ErrorMessage
} from '../../components/SuccessErrorMessage';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';

import CashuStore from '../../stores/CashuStore';
import ModalStore from '../../stores/ModalStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import PosStore from '../../stores/PosStore';
import SettingsStore from '../../stores/SettingsStore';
import LightningAddressStore from '../../stores/LightningAddressStore';
import UnitsStore from '../../stores/UnitsStore';

import CashuInvoice from '../../models/CashuInvoice';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { isNfcWithdraw, scanNfcTag } from '../../utils/NFCUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { getAmountFromSats } from '../../utils/AmountUtils';

import LightningSvg from '../../components/SVG/LightningSvg';
import AddressSvg from '../../components/SVG/AddressSvg';
import ScanSvg from '../../assets/images/SVG/Scan.svg';
import NfcIcon from '../../assets/images/SVG/NFC-alt.svg';

interface ReceiveEcashProps {
    exitSetup: any;
    navigation: NativeStackNavigationProp<any, any>;
    CashuStore: CashuStore;
    PosStore: PosStore;
    ModalStore: ModalStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
    LightningAddressStore: LightningAddressStore;
    route: Route<
        'ReceiveEcash',
        {
            lnurlParams: LNURLWithdrawParams | undefined;
            amount: string;
            autoGenerate: boolean;
            selectedIndex: number;
            memo: string;
            order: any; // Full order, required for receipt printing
            orderId: string;
            orderTotal: string;
            orderTip: string;
            exchangeRate: string;
            rate: number;
            hideRightHeaderComponent: boolean;
        }
    >;
}

interface ReceiveEcashState {
    loading: boolean;
    selectedIndex: number;
    memo: string;
    value: string;
    satAmount: string | number;
    nfcSupported: boolean;
    // the last NFC read was not an LNURL-withdraw card
    nfcError: boolean;
    // POS
    orderId: string;
    orderTotal: string;
    orderTip: string;
    exchangeRate: string;
    rate: number;
    hideRightHeaderComponent?: boolean;
}

@inject(
    'CashuStore',
    'SettingsStore',
    'UnitsStore',
    'PosStore',
    'NodeInfoStore',
    'LightningAddressStore'
)
@observer
export default class ReceiveEcash extends React.Component<
    ReceiveEcashProps,
    ReceiveEcashState
> {
    constructor(props: ReceiveEcashProps) {
        super(props);
        this.state = {
            loading: true,
            selectedIndex: props.route.params?.selectedIndex ?? 0,
            memo: '',
            value: '',
            satAmount: '',
            nfcSupported: false,
            nfcError: false,
            // POS
            orderId: '',
            orderTip: '',
            orderTotal: '',
            exchangeRate: '',
            rate: 0
        };
    }

    lnInterval: any;
    // CashuStore is shared with the next ReceiveEcash view, so work that
    // completes after this view is gone must not reach it
    isUnmounted = false;
    // Bumped for each invoice this view asks CashuStore for and by Cancel,
    // so only the latest request's invoice is checked or handed on
    invoiceRequestId = 0;
    // Bumped by each NFC tag lookup, each invoice request and Cancel, so
    // an LNURL server that answers after any of those creates, submits or
    // shows nothing. Kept apart from invoiceRequestId so a tap that is not
    // a withdraw does not stop the checks of the invoice on screen.
    nfcLookupId = 0;
    hopPickerRef: HopPicker | null;

    startInvoiceRequest = () => {
        this.nfcLookupId++;
        const id = ++this.invoiceRequestId;
        return () => !this.isUnmounted && id === this.invoiceRequestId;
    };

    startNfcLookup = () => {
        const id = ++this.nfcLookupId;
        return () => !this.isUnmounted && id === this.nfcLookupId;
    };

    async componentDidMount() {
        const { CashuStore, SettingsStore, LightningAddressStore, route } =
            this.props;
        const { clearInvoice } = CashuStore;
        const { getSettings } = SettingsStore;
        const { status, lightningAddressHandle } = LightningAddressStore;

        const settings = await getSettings();

        if (
            settings?.lightningAddress?.enabled &&
            !lightningAddressHandle &&
            BackendUtils.supportsLightningAddress()
        ) {
            status().catch((e) =>
                console.log('Error fetching Lightning address status', e)
            );
        }

        this.setState({
            memo: settings?.invoices?.memo || ''
        });

        clearInvoice();

        const {
            lnurlParams: lnurl,
            amount,
            autoGenerate,
            selectedIndex,
            hideRightHeaderComponent
        } = route.params ?? {};

        if (hideRightHeaderComponent) {
            this.setState({ hideRightHeaderComponent });
        }

        if (selectedIndex) {
            this.setState({ selectedIndex });
        }

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
            this.setState({
                memo: lnurl.defaultDescription,
                value: (lnurl.maxWithdrawable / 1000).toString(),
                satAmount: getSatAmount(lnurl.maxWithdrawable / 1000)
            });
        }

        if (amount && amount != '0') {
            this.setState({
                value: amount,
                satAmount: getSatAmount(amount)
            });
        }

        if (autoGenerate) {
            this.autoGenerateInvoice(getSatAmount(amount).toString(), memo);
        }

        this.setState({
            loading: false
        });

        if (Platform.OS !== 'android') {
            return;
        }

        try {
            const nfcSupported = await NfcManager.isSupported();
            this.setState({ nfcSupported });
        } catch {
            this.setState({ nfcSupported: false });
        }
    }

    componentWillUnmount() {
        const { CashuStore } = this.props;
        this.isUnmounted = true;
        CashuStore.clearInvoice();
        CashuStore.creatingInvoiceError = false;
        CashuStore.error_msg = undefined;
        this.clearIntervals();
    }

    clearIntervals = () => {
        if (this.lnInterval) clearInterval(this.lnInterval);
        this.lnInterval = undefined;
    };

    // Cancel: stop checking the invoice that is cleared, so a payment to
    // it does not show the next invoice as paid
    cancelInvoice = () => {
        // a pending invoice request or NFC lookup must not start checks,
        // submit an invoice or open a screen afterwards
        this.invoiceRequestId++;
        this.nfcLookupId++;
        this.clearIntervals();
        this.props.CashuStore.clearInvoice();
    };

    onBack = () => {
        const { CashuStore } = this.props;
        const { clearInvoice } = CashuStore;

        // clear invoice
        clearInvoice();
    };

    autoGenerateInvoice = (amount?: string, memo?: string) => {
        const { CashuStore } = this.props;
        const { createInvoice } = CashuStore;
        const isCurrent = this.startInvoiceRequest();

        createInvoice({
            memo: memo || '',
            value: amount || '0'
        }).then(() => {
            if (isCurrent()) this.subscribeInvoice();
        });
    };

    scanNfc = async () => {
        const str = await scanNfcTag(this.props.ModalStore);
        if (!str || this.isUnmounted) return;
        this.setState({ nfcError: false });
        this.validateAddress(str);
    };

    validateAddress = (text: string) => {
        const { navigation, CashuStore } = this.props;
        const { createInvoice } = CashuStore;
        // route.params.amount is in the display unit that was active when it
        // was passed, and the amount under the QR code toggles that unit:
        // use the sats it was converted to back then
        const { satAmount } = this.state;
        // taken before the lookup: a newer tap, invoice or Cancel while the
        // tag's LNURL server is answering supersedes this tap
        const lookupIsCurrent = this.startNfcLookup();

        handleAnything(text, satAmount.toString())
            .then((response) => {
                // the tag's LNURL server decides when this runs
                if (!lookupIsCurrent()) return;
                try {
                    const [route, props] = response;
                    const { lnurlParams } = props;
                    // NFC reads here are for LNURL-withdraw (e.g. a Bolt
                    // Card) only; tell staff about anything else
                    if (!isNfcWithdraw(route, lnurlParams)) {
                        this.setState({ nfcError: true });
                        return;
                    }
                    const { memo } = lnurlParams.defaultDescription;

                    // if an amount was entered on the keypad screen before scanning
                    // we will automatically create an invoice and attempt to withdraw
                    // otherwise we present the user with the create invoice screen
                    if (Number(satAmount) > 0) {
                        const isCurrent = this.startInvoiceRequest();
                        createInvoice({
                            memo,
                            value: satAmount.toString(),
                            lnurl: lnurlParams
                        })
                            .then(() => {
                                if (isCurrent()) this.subscribeInvoice();
                            })
                            .catch(() => {
                                if (!isCurrent()) return;
                                navigation.navigate(route, {
                                    satAmount,
                                    ...props
                                });
                            });
                    } else {
                        navigation.navigate(route, props);
                    }
                } catch (e) {}
            })
            .catch((e) => {
                if (!lookupIsCurrent()) return;
                // a host policy refusal is not a card that cannot pay
                if (isUnsafeLnurlError(e)) {
                    Alert.alert(localeString('general.error'), e.message);
                    return;
                }
                this.setState({ nfcError: true });
            });
    };

    subscribeInvoice = async () => {
        const { CashuStore, PosStore } = this.props;
        const { orderId, orderTotal, orderTip, exchangeRate, rate } =
            this.state;
        const { setWatchedInvoicePaid, checkInvoicePaid } = CashuStore;

        // nothing would stop this interval anymore
        if (this.isUnmounted) return;
        if (!CashuStore.quoteId) return;

        // persist invoice to check,
        // incase user backs out of view
        const quoteId = cloneDeep(CashuStore.quoteId);
        const selectedMintUrl = cloneDeep(
            CashuStore.lastInvoiceMintUrl || CashuStore.selectedMintUrl
        );

        // only ever poll the latest invoice of this view
        this.clearIntervals();
        const interval = setInterval(() => {
            checkInvoicePaid(quoteId, selectedMintUrl).then(
                (response?: {
                    isPaid: boolean;
                    amtSat?: number;
                    paymentRequest?: string;
                    updatedInvoice?: CashuInvoice;
                }) => {
                    if (response?.isPaid) {
                        // a check that was in flight when the interval
                        // was cleared (view left, invoice cancelled or
                        // replaced) must not mark the next invoice as paid
                        if (!this.isUnmounted && this.lnInterval === interval)
                            setWatchedInvoicePaid(response.amtSat);
                        if (orderId)
                            PosStore.recordPayment({
                                orderId,
                                orderTotal,
                                orderTip,
                                exchangeRate,
                                rate,
                                type: 'ln',
                                tx: response.paymentRequest || '',
                                preimage: 'N/A'
                            });
                        // a stale check must not stop the checks of a newer invoice
                        if (this.lnInterval === interval) this.clearIntervals();
                    } else {
                        if (__DEV__) {
                            console.log(
                                'invoice not paid last time checked, checking...',
                                { quoteId }
                            );
                        }
                    }
                }
            );
        }, 3000);
        this.lnInterval = interval;
    };

    updateIndex = (selectedIndex: number) => {
        this.setState({
            selectedIndex
        });
    };

    render() {
        const {
            CashuStore,
            SettingsStore,
            LightningAddressStore,
            NodeInfoStore,
            navigation,
            route
        } = this.props;
        const {
            selectedIndex,
            memo,
            value,
            satAmount,
            hideRightHeaderComponent,
            nfcSupported
        } = this.state;

        const { width, scale, fontScale } = Dimensions.get('window');

        const {
            createInvoice,
            invoice,
            creatingInvoice,
            creatingInvoiceError,
            watchedInvoicePaid,
            watchedInvoicePaidAmt,
            loadingMsg,
            lastInvoiceMintUrl
        } = CashuStore;
        const { posStatus, settings } = SettingsStore;
        const loading =
            SettingsStore.loading || CashuStore.loading || this.state.loading;
        const { lightningAddress } = LightningAddressStore;
        const lightningAddressLoading = LightningAddressStore.loading;

        const error_msg = CashuStore.error_msg;

        const lnurl = route.params?.lnurlParams;

        const ClearButton = () => (
            <Icon
                name="cancel"
                onPress={this.cancelInvoice}
                color={themeColor('text')}
                underlayColor="transparent"
                size={30}
            />
        );

        const lightningButton = () => (
            <React.Fragment>
                <LightningSvg
                    width={50}
                    height={50}
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
                    {localeString('general.lightningInvoice')}
                </Text>
            </React.Fragment>
        );

        const cashuLightningAddressButton = () => (
            <React.Fragment>
                <AddressSvg
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
                    {localeString('general.lightningAddressCondensed')}
                </Text>
            </React.Fragment>
        );

        const buttons: any = [
            { element: lightningButton },
            { element: cashuLightningAddressButton }
        ];

        const haveInvoice = !!invoice;

        let lnInvoice, lnInvoiceCopyValue;

        if (invoice) {
            lnInvoice = `lightning:${invoice.toUpperCase()}`;
            lnInvoiceCopyValue = invoice;
        }

        const enablePrinter: boolean = settings?.pos?.enablePrinter || false;

        const ScanButton = () => (
            <TouchableOpacity
                onPress={() => navigation.navigate('HandleAnythingQRScanner')}
            >
                <ScanSvg fill={themeColor('text')} width={30} height={30} />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    onBack={this.onBack}
                    centerComponent={{
                        text:
                            posStatus === 'active'
                                ? localeString('general.pay')
                                : localeString(
                                      'views.Cashu.ReceiveEcash.title'
                                  ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        loading ||
                        creatingInvoice ||
                        watchedInvoicePaid ||
                        posStatus === 'active' ||
                        hideRightHeaderComponent ? undefined : haveInvoice ? (
                            <ClearButton />
                        ) : (
                            <ScanButton />
                        )
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
                                height={width * 0.25}
                                width={width}
                                fill={themeColor('highlight')}
                            />
                            <SuccessAnimation />
                            <View style={{ alignItems: 'center' }}>
                                <>
                                    <Text
                                        style={{
                                            ...styles.text,
                                            fontSize: width * scale * 0.017,
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
                                                  watchedInvoicePaidAmt || ''
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
                                                order: route?.params?.order,
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
                            {error_msg && <ErrorMessage message={error_msg} />}
                            {this.state.nfcError && (
                                <ErrorMessage
                                    message={localeString(
                                        'views.Receive.nfcNotWithdraw'
                                    )}
                                />
                            )}

                            <View>
                                {!!invoice && (
                                    <>
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
                                        {loadingMsg && (
                                            <Text
                                                style={{
                                                    marginTop: 35,
                                                    fontFamily:
                                                        'PPNeueMontreal-Book',
                                                    fontSize: 16 / fontScale,
                                                    color: themeColor('text'),
                                                    textAlign: 'center'
                                                }}
                                            >
                                                {loadingMsg}
                                            </Text>
                                        )}
                                    </View>
                                )}

                                {haveInvoice &&
                                    !loading &&
                                    !creatingInvoiceError && (
                                        <View>
                                            {posStatus !== 'active' &&
                                                selectedIndex === 0 && (
                                                    <View
                                                        style={{
                                                            alignSelf: 'center',
                                                            width: '85%'
                                                        }}
                                                    >
                                                        <EcashMintPicker
                                                            hideAmount
                                                            overrideMintUrl={
                                                                lastInvoiceMintUrl
                                                            }
                                                            isReceiveView
                                                            navigation={
                                                                navigation
                                                            }
                                                        />
                                                    </View>
                                                )}
                                            {selectedIndex == 1 &&
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
                                                                    'CreateCashuLightningAddress'
                                                                )
                                                            }
                                                        />
                                                    </View>
                                                )}

                                            {selectedIndex == 1 &&
                                                !lightningAddressLoading &&
                                                lightningAddress && (
                                                    <CollapsedQR
                                                        value={`lightning:${lightningAddress}`}
                                                        copyValue={
                                                            lightningAddress
                                                        }
                                                        expanded
                                                        textBottom
                                                        hideText
                                                        labelBottom={
                                                            lightningAddress
                                                        }
                                                        logo={
                                                            themeColor(
                                                                'invertQrIcons'
                                                            )
                                                                ? ZPayIconWhite
                                                                : ZPayIcon
                                                        }
                                                        nfcSupported={
                                                            nfcSupported
                                                        }
                                                    />
                                                )}

                                            {selectedIndex == 1 &&
                                                lightningAddressLoading && (
                                                    <View
                                                        style={{ margin: 40 }}
                                                    >
                                                        <LoadingIndicator />
                                                    </View>
                                                )}

                                            {selectedIndex === 0 && (
                                                <>
                                                    <CollapsedQR
                                                        value={lnInvoice || ''}
                                                        copyValue={
                                                            lnInvoiceCopyValue
                                                        }
                                                        expanded
                                                        textBottom
                                                        truncateLongValue
                                                        nfcSupported={
                                                            nfcSupported
                                                        }
                                                        satAmount={satAmount}
                                                        displayAmount
                                                    />
                                                </>
                                            )}
                                            {!(
                                                selectedIndex === 1 &&
                                                (!lightningAddress ||
                                                    lightningAddressLoading)
                                            ) &&
                                                nfcSupported && (
                                                    <View
                                                        style={[
                                                            styles.button,
                                                            {
                                                                marginTop: 15,
                                                                paddingTop: 0
                                                            }
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
                                                            icon={
                                                                <NfcIcon
                                                                    stroke={themeColor(
                                                                        'highlight'
                                                                    )}
                                                                    width={25}
                                                                    height={25}
                                                                    style={{
                                                                        marginRight: 10
                                                                    }}
                                                                />
                                                            }
                                                            onPress={() =>
                                                                this.scanNfc()
                                                            }
                                                            secondary
                                                        />
                                                    </View>
                                                )}
                                        </View>
                                    )}
                                {!loading && !haveInvoice && !creatingInvoice && (
                                    <>
                                        <>
                                            <Text
                                                style={{
                                                    ...styles.secondaryText,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {localeString('cashu.mint')}
                                            </Text>
                                            <View
                                                style={{
                                                    marginTop: 10,
                                                    marginBottom: 10
                                                }}
                                            >
                                                <EcashMintPicker
                                                    hideAmount
                                                    isReceiveView
                                                    navigation={navigation}
                                                />
                                            </View>
                                        </>
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
                                                }}
                                            />
                                        </>

                                        <AmountInput
                                            amount={value}
                                            title={`${localeString(
                                                'general.amount'
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
                                                this.setState({
                                                    value: amount,
                                                    satAmount
                                                });
                                            }}
                                        />

                                        <View style={styles.button}>
                                            <Button
                                                title={
                                                    localeString(
                                                        'views.Receive.createInvoice'
                                                    ) +
                                                    (lnurl
                                                        ? ` ${localeString(
                                                              'views.Receive.andSubmitTo'
                                                          )} ${lnurl.domain}`
                                                        : '')
                                                }
                                                onPress={() => {
                                                    const isCurrent =
                                                        this.startInvoiceRequest();
                                                    createInvoice({
                                                        memo,
                                                        value:
                                                            satAmount.toString() ||
                                                            '0',
                                                        lnurl
                                                    }).then(() => {
                                                        if (isCurrent())
                                                            this.subscribeInvoice();
                                                    });
                                                }}
                                                disabled={satAmount == 0}
                                            />
                                        </View>

                                        <View style={styles.button}>
                                            <Button
                                                title={localeString(
                                                    'views.Cashu.ReceiveEcash.readTokenFromClipboard'
                                                )}
                                                onPress={async () => {
                                                    const clipboard =
                                                        await Clipboard.getString();
                                                    const response =
                                                        await handleAnything(
                                                            clipboard
                                                        );
                                                    const [route, props] =
                                                        response;
                                                    navigation.navigate(
                                                        route,
                                                        props
                                                    );
                                                }}
                                                secondary
                                            />
                                        </View>
                                    </>
                                )}
                            </View>
                        </ScrollView>
                    )}
                </View>
                <View style={{ bottom: 0 }}>
                    {!NodeInfoStore.testnet &&
                        !watchedInvoicePaid &&
                        haveInvoice && (
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
        paddingTop: 20
    },
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    secondaryText: {
        fontFamily: 'PPNeueMontreal-Book'
    }
});
