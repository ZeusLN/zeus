import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import BalanceStore from '../../stores/BalanceStore';
import InvoicesStore from '../../stores/InvoicesStore';
import ModalStore from '../../stores/ModalStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore from '../../stores/SettingsStore';
import TransactionsStore from '../../stores/TransactionsStore';
import SweepStore from '../../stores/SweepStore';

import Button from '../../components/Button';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import TextInput from '../../components/TextInput';
import LoadingIndicator from '../../components/LoadingIndicator';
import OnchainFeeInput from '../../components/OnchainFeeInput';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { TouchableOpacity } from 'react-native-gesture-handler';
import Scan from '../../assets/images/SVG/Scan.svg';
import ShowHideToggle from '../../components/ShowHideToggle';
import wifUtils from '../../utils/WIFUtils';
import AddressUtils from '../../utils/AddressUtils';

interface SweepProps {
    exitSetup: any;
    navigation: StackNavigationProp<any, any>;
    BalanceStore: BalanceStore;
    InvoicesStore: InvoicesStore;
    ModalStore: ModalStore;
    NodeInfoStore: NodeInfoStore;
    TransactionsStore: TransactionsStore;
    SettingsStore: SettingsStore;
    SweepStore: SweepStore;
    route: Route<'Sweep', { wif: string }>;
}

interface SweepState {
    privateKey: string;
    hidden: boolean;
    isValid: boolean;
    error: string;
    loading: boolean;
    onChainAddressloading: boolean;
    feeRate: string;
}

@inject('NodeInfoStore', 'SettingsStore', 'SweepStore', 'InvoicesStore')
@observer
export default class WIFSweeper extends React.Component<
    SweepProps,
    SweepState
> {
    state = {
        privateKey: '',
        hidden: true,
        isValid: false,
        error: '',
        loading: false,
        onChainAddressloading: false,
        feeRate: ''
    };

    componentDidMount() {
        this.props.InvoicesStore.reset();
        this.props.SweepStore.resetSweepError();
        this.initFromProps(this.props);
    }

    initFromProps(props: SweepProps) {
        const { route } = props;
        const scannedKey = route.params?.wif;

        if (scannedKey) {
            this.setState({
                privateKey: scannedKey
            });
        }
    }

    componentDidUpdate(prevProps: SweepProps) {
        if (prevProps.route.params?.wif !== this.props.route.params?.wif) {
            this.initFromProps(this.props);
        }
    }

    render() {
        const { navigation, SweepStore, InvoicesStore } = this.props;
        const {
            privateKey,
            hidden,
            error,
            loading,
            onChainAddressloading,
            feeRate
        } = this.state;
        const { sweepError, sweepErrorMsg } = SweepStore;

        const ScanButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('HandleAnythingQRScanner', {
                        wif: true
                    })
                }
            >
                <Scan fill={themeColor('text')} width={30} height={30} />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('views.Wif.title'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                        rightComponent={<ScanButton />}
                    />

                    {(sweepError || error) && (
                        <View>
                            <ErrorMessage
                                message={
                                    error ||
                                    sweepErrorMsg ||
                                    localeString('views.Wif.invalidWif')
                                }
                            />
                        </View>
                    )}

                    <View style={{ padding: 20, flex: 1 }}>
                        <Text style={{ color: themeColor('secondaryText') }}>
                            {localeString('views.Wif.enterPrivateKey')}
                        </Text>

                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}
                        >
                            <TextInput
                                placeholder={localeString(
                                    'views.Wif.enterPrivateKeyPlaceholder'
                                )}
                                value={privateKey}
                                onChangeText={(text: string) =>
                                    this.setState({ privateKey: text })
                                }
                                secureTextEntry={hidden}
                                style={{ flex: 1, marginRight: 15 }}
                                locked={loading}
                            />
                            <ShowHideToggle
                                onPress={() =>
                                    this.setState({
                                        hidden: !hidden
                                    })
                                }
                            />
                        </View>
                    </View>

                    <View>
                        <View
                            style={{ position: 'relative', marginBottom: 10 }}
                        >
                            <TextInput
                                onChangeText={async (text: string) => {
                                    let isValid;
                                    isValid = text
                                        ? AddressUtils.isValidBitcoinAddress(
                                              text,
                                              true
                                          )
                                        : false;
                                    this.props.SweepStore.destination = text;
                                    this.setState({
                                        isValid,
                                        error: ''
                                    });
                                }}
                                placeholder={
                                    onChainAddressloading
                                        ? ''
                                        : localeString(
                                              'views.Wif.destinationOnChainAddress'
                                          )
                                }
                                style={{
                                    marginHorizontal: 20
                                }}
                                value={SweepStore.destination}
                            />
                            {onChainAddressloading && (
                                <View style={styles.loadingOverlay}>
                                    <LoadingIndicator />
                                </View>
                            )}
                        </View>

                        <View
                            style={{
                                paddingBottom: 30
                            }}
                        >
                            <Button
                                onPress={async () => {
                                    try {
                                        this.props.SweepStore.destination = '';
                                        this.setState({
                                            onChainAddressloading: true
                                        });
                                        const { isValid } =
                                            wifUtils.validateWIF(privateKey);
                                        if (isValid) {
                                            await this.props.SweepStore.prepareSweepInputs(
                                                privateKey
                                            );
                                        } else {
                                            throw new Error(
                                                localeString(
                                                    'views.Wif.invalidWif'
                                                )
                                            );
                                        }
                                        if (!SweepStore.onChainBalance) {
                                            throw new Error(
                                                'The unspent outputs from this private key contain insufficient funds to spend(0 sats).'
                                            );
                                        }
                                        await InvoicesStore.createUnifiedInvoice(
                                            {
                                                memo: '',
                                                value:
                                                    SweepStore.onChainBalance.toString() ??
                                                    '10',
                                                expiry: '3600'
                                            }
                                        );
                                        if (InvoicesStore.onChainAddress) {
                                            this.props.SweepStore.destination =
                                                InvoicesStore.onChainAddress;
                                            this.setState({
                                                error: '',
                                                isValid: true,
                                                onChainAddressloading: false
                                            });
                                        } else {
                                            throw new Error(
                                                localeString(
                                                    'views.Swaps.generateOnchainAddressFailed'
                                                )
                                            );
                                        }
                                    } catch (e: any) {
                                        this.setState({
                                            error: e.message,
                                            onChainAddressloading: false
                                        });
                                    }
                                }}
                                title={localeString(
                                    'views.Swaps.generateOnchainAddress'
                                )}
                                secondary
                                disabled={
                                    !privateKey || !!SweepStore.destination
                                }
                            />
                        </View>
                        <View
                            style={{ marginHorizontal: 20, paddingBottom: 10 }}
                        >
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('views.Send.feeSatsVbyte')}
                            </Text>
                            <OnchainFeeInput
                                fee={feeRate}
                                onChangeFee={(text: string) =>
                                    this.setState({ feeRate: text })
                                }
                                navigation={navigation}
                            />
                        </View>
                        <Button
                            title={localeString('views.Wif.createTransaction')}
                            onPress={async () => {
                                const { isValid, error } = wifUtils.validateWIF(
                                    this.state.privateKey
                                );
                                if (isValid) {
                                    await this.props.SweepStore.finalizeSweepTransaction(
                                        feeRate
                                    );
                                    navigation.navigate('TxHex', {
                                        txHex: SweepStore.txHex
                                    });
                                } else {
                                    this.props.SweepStore.sweepError = true;
                                    this.props.SweepStore.sweepErrorMsg =
                                        error ||
                                        localeString('views.Wif.invalidWif');
                                }
                            }}
                            disabled={
                                !privateKey ||
                                loading ||
                                !SweepStore.destination
                            }
                            containerStyle={{ paddingBottom: 30 }}
                        />
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center'
    },
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    }
});
