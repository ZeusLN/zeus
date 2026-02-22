import * as React from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import EcashMintPicker from '../../components/EcashMintPicker';
import EcashToggle from '../../components/EcashToggle';
import KeypadAmountDisplay from '../../components/KeypadAmountDisplay';
import ModalBox from '../../components/ModalBox';
import PinPad from '../../components/PinPad';
import UnitToggle from '../../components/UnitToggle';
import CurrencySelectorModal from '../../components/CurrencySelectorModal';
import WalletHeader from '../../components/WalletHeader';
import { getSatAmount } from '../../components/AmountInput';
import { Row } from '../../components/layout/Row';
import { Spacer } from '../../components/layout/Spacer';

import CashuStore from '../../stores/CashuStore';
import ChannelsStore from '../../stores/ChannelsStore';
import FiatStore from '../../stores/FiatStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore from '../../stores/SettingsStore';
import SyncStore from '../../stores/SyncStore';
import UnitsStore from '../../stores/UnitsStore';

import BackendUtils from '../../utils/BackendUtils';
import {
    validateKeypadInput,
    startShakeAnimation,
    getAmountFontSize,
    deleteLastCharacter
} from '../../utils/KeypadUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { getDecimalPlaceholder } from '../../utils/UnitsUtils';

import Bitcoin from './../../assets/images/SVG/Bitcoin.svg';
import MintToken from './../../assets/images/SVG/MintToken.svg';

interface KeypadPaneProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore?: CashuStore;
    ChannelsStore?: ChannelsStore;
    FiatStore?: FiatStore;
    NodeInfoStore?: NodeInfoStore;
    SettingsStore?: SettingsStore;
    SyncStore?: SyncStore;
    UnitsStore?: UnitsStore;
    loading: boolean;
}

interface KeypadPaneState {
    amount: string;
    needInbound: boolean;
    belowMinAmount: boolean;
    overrideBelowMinAmount: boolean;
    flowLspNotConfigured: boolean;
    ecashMode: boolean;
}

@inject(
    'CashuStore',
    'ChannelsStore',
    'FiatStore',
    'NodeInfoStore',
    'SettingsStore',
    'SyncStore',
    'UnitsStore'
)
@observer
export default class KeypadPane extends React.PureComponent<
    KeypadPaneProps,
    KeypadPaneState
> {
    shakeAnimation = new Animated.Value(0);
    textAnimation = new Animated.Value(0);
    focusListener: any = null;

    constructor(props: KeypadPaneProps) {
        super(props);

        let initialEcashMode = false;
        if (BackendUtils.supportsCashuWallet()) {
            const { ChannelsStore, SettingsStore } = this.props;
            const { settings } = SettingsStore!;
            initialEcashMode =
                settings?.ecash?.enableCashu &&
                ChannelsStore?.channels.length === 0
                    ? true
                    : false;
        }

        this.state = {
            amount: '0',
            needInbound: false,
            belowMinAmount: false,
            overrideBelowMinAmount: false,
            flowLspNotConfigured: true,
            ecashMode: initialEcashMode
        };
    }

    async componentDidMount() {
        this.handleLsp();

        this.focusListener = this.props.navigation.addListener(
            'focus',
            async () => {
                this.handleLsp();
            }
        );
    }

    componentWillUnmount() {
        if (this.focusListener) {
            this.focusListener();
        }
    }

    async handleLsp() {
        const { flowLspNotConfigured } =
            this.props.NodeInfoStore!.flowLspNotConfigured();

        this.setState({
            flowLspNotConfigured
        });
    }

    appendValue = (value: string): boolean => {
        const { amount } = this.state;
        const { FiatStore, SettingsStore, UnitsStore } = this.props;
        const { units } = UnitsStore!;

        const { valid, newAmount } = validateKeypadInput(
            amount,
            value,
            units,
            FiatStore!,
            SettingsStore!
        );

        if (!valid) {
            this.startShake();
            return false;
        }

        let needInbound = false;
        let belowMinAmount = false;
        if (
            BackendUtils.supportsFlowLSP() &&
            this.props.SettingsStore!.settings?.enableLSP &&
            !this.state.flowLspNotConfigured &&
            newAmount !== '0' &&
            new BigNumber(getSatAmount(newAmount)).gt(
                this.props.ChannelsStore!.totalInbound
            )
        ) {
            needInbound = true;
            if (new BigNumber(getSatAmount(newAmount)).lt(50000)) {
                belowMinAmount = true;
            }
        }

        this.setState({
            amount: newAmount,
            needInbound,
            belowMinAmount
        });

        return true;
    };

    clearValue = () => {
        this.setState({
            amount: '0',
            needInbound: false,
            belowMinAmount: false,
            overrideBelowMinAmount: false
        });
    };

    deleteValue = () => {
        const { amount } = this.state;
        if (amount === '0') {
            this.startShake();
            return;
        }
        const newAmount = deleteLastCharacter(amount);

        let needInbound = false;
        let belowMinAmount = false;
        if (
            BackendUtils.supportsFlowLSP() &&
            this.props.SettingsStore!.settings?.enableLSP &&
            !this.state.flowLspNotConfigured &&
            newAmount !== '0' &&
            new BigNumber(getSatAmount(newAmount)).gt(
                this.props.ChannelsStore!.totalInbound
            )
        ) {
            needInbound = true;
            if (new BigNumber(getSatAmount(newAmount)).lt(50000)) {
                belowMinAmount = true;
            }
        }

        this.setState({
            amount: newAmount,
            needInbound,
            belowMinAmount
        });
    };

    amountSize = () => {
        const { amount, needInbound } = this.state;
        const { units } = this.props.UnitsStore!;
        const { count } = getDecimalPlaceholder(amount, units);
        return getAmountFontSize(amount.length, count, { needInbound });
    };

    startShake = () => {
        startShakeAnimation(this.shakeAnimation, this.textAnimation);
    };

    private modalBoxRef = React.createRef<ModalBox>();
    private currencySelectorModalRef = React.createRef<CurrencySelectorModal>();

    handleOpenCurrencyModal = () => {
        this.currencySelectorModalRef.current?.open();
    };

    handleCurrencyModalClose = () => {
        this.clearValue();
    };

    render() {
        const {
            CashuStore,
            UnitsStore,
            SettingsStore,
            SyncStore,
            navigation,
            loading
        } = this.props;
        const {
            amount,
            needInbound,
            belowMinAmount,
            overrideBelowMinAmount,
            ecashMode
        } = this.state;
        const { settings } = SettingsStore!;
        const { isSyncing } = SyncStore!;

        const noMints = CashuStore?.mintUrls.length === 0;

        return (
            <>
                <View style={{ flex: 1 }}>
                    <WalletHeader navigation={navigation} loading={loading} />

                    {!ecashMode && needInbound && (
                        <TouchableOpacity
                            onPress={() =>
                                navigation.navigate('LspExplanationFees')
                            }
                        >
                            <View
                                style={{
                                    backgroundColor: themeColor('secondary'),
                                    borderRadius: 10,
                                    marginLeft: 10,
                                    marginRight: 10,
                                    padding: 15,
                                    borderWidth: 0.5,
                                    top: 5,
                                    bottom: 5
                                }}
                            >
                                <Text
                                    style={{
                                        fontFamily: 'PPNeueMontreal-Medium',
                                        color: themeColor('text'),
                                        fontSize: 15
                                    }}
                                >
                                    {this.props.ChannelsStore?.channels
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
                                        fontFamily: 'PPNeueMontreal-Medium',
                                        color: themeColor('secondaryText'),
                                        fontSize: 15,
                                        top: 5,
                                        textAlign: 'right'
                                    }}
                                >
                                    {localeString('general.tapToLearnMore')}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    )}

                    <View
                        style={{
                            flex: 1,
                            alignItems: 'center'
                        }}
                    >
                        <KeypadAmountDisplay
                            amount={amount}
                            shakeAnimation={this.shakeAnimation}
                            textAnimation={this.textAnimation}
                            fontSize={this.amountSize()}
                        >
                            <Row
                                style={{
                                    alignSelf: 'center',
                                    padding: 10,
                                    width: '85%'
                                }}
                            >
                                {BackendUtils.supportsCashuWallet() &&
                                    settings?.ecash?.enableCashu && (
                                        <>
                                            <EcashToggle
                                                ecashMode={ecashMode}
                                                onToggle={() => {
                                                    this.setState({
                                                        ecashMode: !ecashMode
                                                    });
                                                }}
                                            />
                                            <Spacer width={10} />
                                            {ecashMode && (
                                                <>
                                                    <EcashMintPicker
                                                        hideAmount
                                                        navigation={navigation}
                                                    />
                                                    <Spacer width={10} />
                                                </>
                                            )}
                                        </>
                                    )}
                                <UnitToggle
                                    onToggle={this.clearValue}
                                    onOpenModal={this.handleOpenCurrencyModal}
                                />
                            </Row>
                        </KeypadAmountDisplay>
                    </View>

                    <View>
                        <View style={{ marginTop: 30, bottom: '10%' }}>
                            <PinPad
                                appendValue={this.appendValue}
                                clearValue={this.clearValue}
                                deleteValue={this.deleteValue}
                                numberHighlight
                                amount
                            />
                        </View>
                        {!ecashMode &&
                        belowMinAmount &&
                        !overrideBelowMinAmount ? (
                            <View style={{ alignItems: 'center' }}>
                                <View
                                    style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        position: 'absolute',
                                        bottom: 10
                                    }}
                                >
                                    <View style={{ width: '25%' }}>
                                        <Button
                                            title={'50k'}
                                            quaternary
                                            noUppercase
                                            onPress={() => {
                                                UnitsStore?.resetUnits();
                                                this.setState({
                                                    amount: '50000',
                                                    belowMinAmount: false
                                                });
                                            }}
                                            buttonStyle={{ height: 40 }}
                                        />
                                    </View>
                                    <View style={{ width: '25%' }}>
                                        <Button
                                            title={'100k'}
                                            quaternary
                                            noUppercase
                                            onPress={() => {
                                                UnitsStore?.resetUnits();
                                                this.setState({
                                                    amount: '100000',
                                                    belowMinAmount: false
                                                });
                                            }}
                                            buttonStyle={{ height: 40 }}
                                        />
                                    </View>
                                    <View style={{ width: '25%' }}>
                                        <Button
                                            title={'1m'}
                                            quaternary
                                            noUppercase
                                            onPress={() => {
                                                UnitsStore?.resetUnits();
                                                this.setState({
                                                    amount: '1000000',
                                                    belowMinAmount: false
                                                });
                                            }}
                                            buttonStyle={{ height: 40 }}
                                        />
                                    </View>
                                    <View style={{ width: '25%' }}>
                                        <Button
                                            title={localeString(
                                                'general.other'
                                            )}
                                            quaternary
                                            noUppercase
                                            onPress={() => {
                                                UnitsStore?.resetUnits();
                                                this.setState({
                                                    belowMinAmount: false,
                                                    overrideBelowMinAmount: true
                                                });
                                            }}
                                            buttonStyle={{ height: 40 }}
                                        />
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View
                                style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    position: 'absolute',
                                    bottom: 10
                                }}
                            >
                                <View style={{ width: '40%' }}>
                                    <Button
                                        title={localeString('general.request')}
                                        quaternary
                                        noUppercase
                                        onPress={() => {
                                            navigation.navigate(
                                                ecashMode
                                                    ? 'ReceiveEcash'
                                                    : 'Receive',
                                                {
                                                    amount,
                                                    autoGenerate:
                                                        ecashMode &&
                                                        amount === '0'
                                                            ? false
                                                            : true
                                                }
                                            );
                                            this.clearValue();
                                        }}
                                        buttonStyle={{ height: 40 }}
                                        disabled={
                                            (ecashMode && noMints) ||
                                            (!ecashMode && isSyncing)
                                        }
                                    />
                                </View>
                                <View style={{ width: '20%' }}>
                                    <Button
                                        icon={{
                                            name: 'pencil',
                                            type: 'font-awesome',
                                            size: 20,
                                            color:
                                                themeColor('buttonText') ||
                                                themeColor('text')
                                        }}
                                        quaternary
                                        noUppercase
                                        onPress={() => {
                                            navigation.navigate(
                                                ecashMode
                                                    ? 'ReceiveEcash'
                                                    : 'Receive',
                                                {
                                                    amount
                                                }
                                            );
                                            this.clearValue();
                                        }}
                                        buttonStyle={{ height: 40 }}
                                        disabled={
                                            (ecashMode && noMints) ||
                                            (!ecashMode && isSyncing)
                                        }
                                    />
                                </View>
                                <View style={{ width: '40%' }}>
                                    <Button
                                        title={localeString('general.send')}
                                        quaternary
                                        noUppercase
                                        onPress={() => {
                                            if (ecashMode) {
                                                this.modalBoxRef.current?.open();
                                            } else {
                                                navigation.navigate('Send', {
                                                    satAmount:
                                                        amount !== '0'
                                                            ? getSatAmount(
                                                                  amount
                                                              )
                                                            : ''
                                                });
                                                this.clearValue();
                                            }
                                        }}
                                        buttonStyle={{ height: 40 }}
                                        disabled={
                                            !BackendUtils.supportsLightningSends() ||
                                            (ecashMode && noMints) ||
                                            (!ecashMode && isSyncing)
                                        }
                                    />
                                </View>
                            </View>
                        )}
                    </View>
                </View>
                <ModalBox
                    style={{
                        ...styles.modal,
                        backgroundColor: themeColor('modalBackground')
                    }}
                    swipeToClose={true}
                    backButtonClose={true}
                    backdropPressToClose={true}
                    backdrop={true}
                    position="bottom"
                    ref={this.modalBoxRef}
                >
                    <View>
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Book',
                                color: themeColor('text'),
                                fontSize: 16,
                                paddingTop: 24,
                                paddingBottom: 24
                            }}
                        >
                            {localeString('general.send')}
                        </Text>
                        <TouchableOpacity
                            key="send-bitcoin-tx"
                            onPress={async () => {
                                navigation.navigate('Send', {
                                    amount: amount !== '0' ? amount : ''
                                });
                                this.modalBoxRef.current?.close();
                                this.clearValue();
                            }}
                            style={{
                                ...styles.sendOption,
                                backgroundColor: themeColor('secondary')
                            }}
                        >
                            <Row>
                                <View style={{ marginRight: 15 }}>
                                    <Bitcoin
                                        fill={
                                            themeColor('action') ||
                                            themeColor('highlight')
                                        }
                                        width={30}
                                        height={30}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.sendOptionLabel,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString('general.bitcoinPayment')}
                                </Text>
                            </Row>
                        </TouchableOpacity>
                        <TouchableOpacity
                            key="send-mint-token"
                            onPress={async () => {
                                navigation.navigate('SendEcash', {
                                    amount: amount !== '0' ? amount : ''
                                });
                                this.modalBoxRef.current?.close();
                                this.clearValue();
                            }}
                            style={{
                                ...styles.sendOption,
                                backgroundColor: themeColor('secondary')
                            }}
                        >
                            <Row>
                                <View style={{ marginRight: 15 }}>
                                    <MintToken
                                        fill={
                                            themeColor('action') ||
                                            themeColor('highlight')
                                        }
                                        width={30}
                                        height={30}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.sendOptionLabel,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString('general.ecash')}
                                </Text>
                            </Row>
                        </TouchableOpacity>
                    </View>
                </ModalBox>
                <CurrencySelectorModal
                    ref={this.currencySelectorModalRef}
                    navigation={navigation}
                    onClose={this.handleCurrencyModalClose}
                />
            </>
        );
    }
}

const styles = StyleSheet.create({
    modal: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: 250,
        paddingLeft: 24,
        paddingRight: 24
    },
    sendOption: {
        borderRadius: 5,
        padding: 16,
        marginBottom: 24
    },
    sendOptionLabel: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 22
    }
});
