import * as React from 'react';
import {
    Dimensions,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { LNURLWithdrawParams } from 'js-lnurl';
import { ButtonGroup, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import NfcManager, {
    NfcEvents,
    TagEvent,
    Ndef
} from 'react-native-nfc-manager';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Clipboard from '@react-native-clipboard/clipboard';

import handleAnything from '../../utils/handleAnything';

import Wordmark from '../../assets/images/SVG/wordmark-black.svg';

const ZPayIcon = require('../../assets/images/pay-z-black.png');

const ZPayIconWhite = require('../../assets/images/pay-z-white.png');

import AmountInput, { getSatAmount } from '../../components/AmountInput';
import Button from '../../components/Button';
import CollapsedQR from '../../components/CollapsedQR';
import EcashMintPicker from '../../components/EcashMintPicker';
import Header from '../../components/Header';
import HopPicker from '../../components/HopPicker';
import LoadingIndicator from '../../components/LoadingIndicator';
import PaidIndicator from '../../components/PaidIndicator';
import { Row } from '../../components/layout/Row';
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

import { localeString } from '../../utils/LocaleUtils';
import NFCUtils from '../../utils/NFCUtils';
import { themeColor } from '../../utils/ThemeUtils';

import LightningSvg from '../../assets/images/SVG/DynamicSVG/LightningSvg';
import AddressSvg from '../../assets/images/SVG/DynamicSVG/AddressSvg';
import ScanSvg from '../../assets/images/SVG/Scan.svg';

interface ReceiveEcashProps {
    exitSetup: any;
    navigation: StackNavigationProp<any, any>;
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
            // POS
            orderId: '',
            orderTip: '',
            orderTotal: '',
            exchangeRate: '',
            rate: 0
        };
    }

    listener: any;
    listenerSecondary: any;
    lnInterval: any;
    onChainInterval: any;
    hopPickerRef: HopPicker | null;

    async UNSAFE_componentWillMount() {
        const { CashuStore, SettingsStore, LightningAddressStore, route } =
            this.props;
        const { clearInvoice } = CashuStore;
        const { getSettings } = SettingsStore;
        const { status, lightningAddressHandle } = LightningAddressStore;

        const settings = await getSettings();

        if (settings?.lightningAddress?.enabled && !lightningAddressHandle) {
            status();
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
        const { CashuStore } = this.props;
        const { clearInvoice } = CashuStore;
        // kill all listeners and pollers before navigating back
        this.clearListeners();
        this.clearIntervals();

        // clear invoice
        clearInvoice();
    };

    autoGenerateInvoice = (amount?: string, memo?: string) => {
        const { CashuStore } = this.props;
        const { createInvoice } = CashuStore;

        createInvoice({
            memo: memo || '',
            value: amount || '0'
        }).then(() => {
            this.subscribeInvoice();
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
        const { navigation, CashuStore, route } = this.props;
        const { createInvoice } = CashuStore;
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
                        createInvoice({
                            memo,
                            value: amount.toString(),
                            lnurl: lnurlParams
                        })
                            .then(() => {
                                this.subscribeInvoice();
                            })
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

    subscribeInvoice = async () => {
        const { CashuStore, PosStore } = this.props;
        const { orderId, orderTotal, orderTip, exchangeRate, rate } =
            this.state;
        const { setWatchedInvoicePaid, checkInvoicePaid, quoteId } = CashuStore;

        if (!quoteId) return;

        this.lnInterval = setInterval(() => {
            checkInvoicePaid().then(
                (response?: {
                    isPaid: boolean;
                    amtSat: number;
                    paymentRequest: string;
                    updatedInvoice: CashuInvoice;
                }) => {
                    if (response?.isPaid) {
                        setWatchedInvoicePaid(response.amtSat);
                        if (orderId)
                            PosStore.recordPayment({
                                orderId,
                                orderTotal,
                                orderTip,
                                exchangeRate,
                                rate,
                                type: 'ln',
                                tx: response.paymentRequest,
                                preimage: 'N/A'
                            });
                        this.clearIntervals();
                    }
                }
            );
        }, 3000);
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
            UnitsStore,
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

        const { getAmountFromSats } = UnitsStore;

        const {
            createInvoice,
            invoice,
            creatingInvoice,
            creatingInvoiceError,
            watchedInvoicePaid,
            watchedInvoicePaidAmt,
            loadingMsg
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
                onPress={() => {
                    CashuStore.clearInvoice();
                }}
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
                                                                    'CashuLightningAddress'
                                                                )
                                                            }
                                                        />
                                                    </View>
                                                )}

                                            {selectedIndex == 1 &&
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
                                                                    26 /
                                                                    fontScale,
                                                                color: themeColor(
                                                                    'text'
                                                                ),
                                                                textAlign:
                                                                    'center'
                                                            }}
                                                        >
                                                            {lightningAddress}
                                                        </Text>
                                                    </Row>
                                                )}

                                            {selectedIndex == 1 &&
                                                !lightningAddressLoading &&
                                                lightningAddress && (
                                                    <CollapsedQR
                                                        value={`lightning:${lightningAddress}`}
                                                        iconOnly={true}
                                                        iconContainerStyle={{
                                                            marginRight: 40
                                                        }}
                                                        showShare={true}
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
                                                        iconOnly={true}
                                                        iconContainerStyle={{
                                                            marginRight: 40
                                                        }}
                                                        showShare={true}
                                                        expanded
                                                        textBottom
                                                        truncateLongValue
                                                        nfcSupported={
                                                            nfcSupported
                                                        }
                                                        satAmount={satAmount}
                                                        displayAmount={
                                                            settings?.invoices
                                                                ?.displayAmountOnInvoice ||
                                                            false
                                                        }
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
                                                    createInvoice({
                                                        memo,
                                                        value:
                                                            satAmount.toString() ||
                                                            '0',
                                                        lnurl
                                                    }).then(() => {
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
