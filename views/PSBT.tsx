import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { ButtonGroup } from '@rneui/themed';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

const bitcoin = require('bitcoinjs-lib');

import AnimatedQRDisplay from '../components/AnimatedQRDisplay';
import Button from '../components/Button';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import { WarningMessage } from '../components/SuccessErrorMessage';

import Base64Utils from '../utils/Base64Utils';
import { getButtonGroupStyles } from '../utils/buttonGroupStyles';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import ChannelsStore from '../stores/ChannelsStore';
import TransactionsStore from '../stores/TransactionsStore';

interface PSBTProps {
    navigation: StackNavigationProp<any, any>;
    ChannelsStore: ChannelsStore;
    TransactionsStore: TransactionsStore;
    route: Route<'PSBT', { psbt: string }>;
}

interface PSBTDecoded {
    inputCount?: number;
    outputCount?: number;
    data?: {
        inputs?: Array<{ [key: string]: any }>;
        outputs?: Array<{ [key: string]: any }>;
    };
}
interface PSBTState {
    infoIndex: number;
    fundedPsbt: string;
    psbtDecoded?: PSBTDecoded;
}

@inject('ChannelsStore', 'TransactionsStore')
@observer
export default class PSBT extends React.Component<PSBTProps, PSBTState> {
    state: PSBTState = {
        infoIndex: 0,
        fundedPsbt: this.props.route.params?.psbt || '',
        psbtDecoded: undefined
    };

    componentDidMount(): void {
        this.decodePsbt();
    }

    componentDidUpdate(prevProps: any): void {
        const oldPsbt = prevProps.route.params?.psbt;
        const newPsbt = this.props.route.params?.psbt;

        if (newPsbt !== oldPsbt) {
            this.setState({ fundedPsbt: newPsbt }, () => {
                this.decodePsbt();
            });
        }
    }

    decodePsbt = () => {
        const { fundedPsbt } = this.state;
        try {
            const psbtDecoded = bitcoin.Psbt.fromBase64(fundedPsbt);
            this.setState({ psbtDecoded });
        } catch (e) {
            this.setState({ psbtDecoded: undefined });
        }
    };

    render() {
        const { ChannelsStore, TransactionsStore, navigation } = this.props;
        const { pending_chan_ids } = ChannelsStore;
        const { loading } = TransactionsStore;
        const { infoIndex, fundedPsbt, psbtDecoded } = this.state;

        const qrButton = () => (
            <Text
                style={{
                    ...styles.text,
                    color:
                        infoIndex === 0
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('views.PSBT.qrs')}
            </Text>
        );
        const infoButton = () => (
            <Text
                style={{
                    ...styles.text,
                    color:
                        infoIndex === 1
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('views.PSBT.psbtInfo')}
            </Text>
        );

        const infoButtons: any = [
            { element: qrButton },
            { element: infoButton }
        ];

        const groupStyles = getButtonGroupStyles();

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    onBack={() => navigation.popTo('Wallet')}
                    navigateBackOnBackPress={false}
                    centerComponent={{
                        text: 'PSBT',
                        style: { color: themeColor('text') }
                    }}
                    navigation={navigation}
                />
                <ScrollView>
                    {pending_chan_ids.length > 0 && (
                        <>
                            <Text
                                style={{
                                    ...styles.text,
                                    fontWeight: 'bold',
                                    color: themeColor('text'),
                                    alignSelf: 'center'
                                }}
                            >
                                {pending_chan_ids.length > 1
                                    ? localeString('views.Channel.channelIds')
                                    : localeString('views.Channel.channelId')}
                            </Text>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('text'),
                                    padding: 15,
                                    paddingBottom: 0
                                }}
                            >
                                {pending_chan_ids.map(
                                    (pending_chan_id, index) =>
                                        `${Base64Utils.base64ToHex(
                                            pending_chan_id
                                        )}${
                                            index !==
                                            pending_chan_ids.length - 1
                                                ? ', '
                                                : ''
                                        }`
                                )}
                            </Text>
                        </>
                    )}
                    {!loading && pending_chan_ids.length > 0 && (
                        <WarningMessage
                            message={
                                pending_chan_ids.length > 1
                                    ? localeString('views.PSBT.channelsWarning')
                                    : localeString('views.PSBT.channelWarning')
                            }
                            fontSize={13}
                        />
                    )}
                    {loading && (
                        <View style={{ margin: 15 }}>
                            <LoadingIndicator />
                        </View>
                    )}
                    {!loading && fundedPsbt && (
                        <>
                            <ButtonGroup
                                onPress={(infoIndex: number) => {
                                    this.setState({ infoIndex });
                                }}
                                selectedIndex={infoIndex}
                                buttons={infoButtons}
                                selectedButtonStyle={
                                    groupStyles.selectedButtonStyle
                                }
                                containerStyle={groupStyles.containerStyle}
                                innerBorderStyle={groupStyles.innerBorderStyle}
                            />
                            {infoIndex === 0 && (
                                <>
                                    <AnimatedQRDisplay
                                        data={fundedPsbt}
                                        encoderType="psbt"
                                        fileType="P"
                                        copyValue={fundedPsbt}
                                    />
                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                'views.PSBT.scan'
                                            )}
                                            onPress={() =>
                                                navigation.navigate(
                                                    'HandleAnythingQRScanner'
                                                )
                                            }
                                            containerStyle={{ width: '100%' }}
                                            buttonStyle={{ height: 40 }}
                                            icon={{
                                                name: 'qrcode',
                                                type: 'font-awesome',
                                                size: 25
                                            }}
                                        />
                                    </View>
                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                'views.PSBT.finalizePsbtAndBroadcast'
                                            )}
                                            onPress={() => {
                                                if (
                                                    pending_chan_ids.length > 0
                                                ) {
                                                    TransactionsStore.finalizePsbtAndBroadcastChannel(
                                                        fundedPsbt,
                                                        pending_chan_ids
                                                    ).then(() => {
                                                        navigation.navigate(
                                                            'SendingOnChain'
                                                        );
                                                    });
                                                } else {
                                                    TransactionsStore.finalizePsbtAndBroadcast(
                                                        fundedPsbt
                                                    ).then(() => {
                                                        navigation.navigate(
                                                            'SendingOnChain'
                                                        );
                                                    });
                                                }
                                            }}
                                            containerStyle={{ width: '100%' }}
                                            buttonStyle={{ height: 40 }}
                                            icon={{
                                                name: 'pencil',
                                                type: 'font-awesome',
                                                size: 25
                                            }}
                                            tertiary
                                        />
                                    </View>
                                </>
                            )}
                            {infoIndex === 1 && (
                                <View style={{ margin: 15 }}>
                                    {!psbtDecoded && (
                                        <>
                                            <Text
                                                style={{
                                                    ...styles.text,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    alignSelf: 'center'
                                                }}
                                            >
                                                {localeString(
                                                    'views.PSBT.couldNotDecode'
                                                )}
                                            </Text>
                                        </>
                                    )}
                                    {psbtDecoded && (
                                        <>
                                            {psbtDecoded.inputCount && (
                                                <KeyValue
                                                    keyValue={localeString(
                                                        'views.PSBT.inputCount'
                                                    )}
                                                    value={
                                                        psbtDecoded?.inputCount
                                                    }
                                                />
                                            )}
                                            {psbtDecoded?.outputCount && (
                                                <KeyValue
                                                    keyValue={localeString(
                                                        'views.PSBT.outputCount'
                                                    )}
                                                    value={
                                                        psbtDecoded?.outputCount
                                                    }
                                                />
                                            )}
                                            {psbtDecoded?.data?.inputs?.map(
                                                (input: any, index: number) => (
                                                    <View
                                                        key={`input-${index}`}
                                                    >
                                                        <KeyValue
                                                            keyValue={`${localeString(
                                                                'views.PSBT.input'
                                                            )} ${index + 1}`}
                                                        />
                                                        {input?.bip32Derivation ? (
                                                            input?.bip32Derivation.map(
                                                                (
                                                                    derivation: any,
                                                                    d: number
                                                                ) => (
                                                                    <View
                                                                        key={`d-${index}-${d}`}
                                                                    >
                                                                        <Text
                                                                            style={{
                                                                                ...styles.text,
                                                                                color: themeColor(
                                                                                    'secondaryText'
                                                                                ),
                                                                                alignSelf:
                                                                                    'center',
                                                                                marginBottom: 10
                                                                            }}
                                                                        >{`${localeString(
                                                                            'views.PSBT.input'
                                                                        )} ${
                                                                            index +
                                                                            1
                                                                        } - ${localeString(
                                                                            'views.PSBT.derivation'
                                                                        )} ${
                                                                            d +
                                                                            1
                                                                        }`}</Text>
                                                                        {derivation.masterFingerprint && (
                                                                            <KeyValue
                                                                                keyValue={localeString(
                                                                                    'views.ImportAccount.masterKeyFingerprint'
                                                                                )}
                                                                                value={Base64Utils.bytesToHex(
                                                                                    derivation.masterFingerprint
                                                                                ).toUpperCase()}
                                                                            />
                                                                        )}
                                                                        {derivation.pubkey && (
                                                                            <KeyValue
                                                                                keyValue={localeString(
                                                                                    'views.NodeInfo.pubkey'
                                                                                )}
                                                                                value={Base64Utils.bytesToHex(
                                                                                    derivation.pubkey
                                                                                ).toUpperCase()}
                                                                            />
                                                                        )}
                                                                        {derivation.path && (
                                                                            <KeyValue
                                                                                keyValue={localeString(
                                                                                    'views.ImportAccount.derivationPath'
                                                                                )}
                                                                                value={
                                                                                    derivation.path
                                                                                }
                                                                            />
                                                                        )}
                                                                    </View>
                                                                )
                                                            )
                                                        ) : (
                                                            <Text
                                                                style={{
                                                                    ...styles.text,
                                                                    color: themeColor(
                                                                        'secondaryText'
                                                                    ),
                                                                    alignSelf:
                                                                        'center'
                                                                }}
                                                            >
                                                                {localeString(
                                                                    'views.PSBT.noData'
                                                                )}
                                                            </Text>
                                                        )}
                                                    </View>
                                                )
                                            )}
                                            {psbtDecoded.data?.outputs?.map(
                                                (
                                                    output: any,
                                                    index: number
                                                ) => (
                                                    <View
                                                        key={`output-${index}`}
                                                    >
                                                        <KeyValue
                                                            keyValue={`${localeString(
                                                                'views.PSBT.output'
                                                            )} ${index + 1}`}
                                                        />
                                                        {output?.bip32Derivation ? (
                                                            output?.bip32Derivation.map(
                                                                (
                                                                    derivation: any,
                                                                    d: number
                                                                ) => (
                                                                    <View
                                                                        key={`d-${index}-${d}`}
                                                                    >
                                                                        <Text
                                                                            style={{
                                                                                ...styles.text,
                                                                                color: themeColor(
                                                                                    'secondaryText'
                                                                                ),
                                                                                alignSelf:
                                                                                    'center',
                                                                                marginBottom: 10
                                                                            }}
                                                                        >{`${localeString(
                                                                            'views.PSBT.output'
                                                                        )} ${
                                                                            index +
                                                                            1
                                                                        } - ${localeString(
                                                                            'views.PSBT.derivation'
                                                                        )} ${
                                                                            d +
                                                                            1
                                                                        }`}</Text>
                                                                        {derivation.masterFingerprint && (
                                                                            <KeyValue
                                                                                keyValue={localeString(
                                                                                    'views.ImportAccount.masterKeyFingerprint'
                                                                                )}
                                                                                value={Base64Utils.bytesToHex(
                                                                                    derivation.masterFingerprint
                                                                                ).toUpperCase()}
                                                                            />
                                                                        )}
                                                                        {derivation.pubkey && (
                                                                            <KeyValue
                                                                                keyValue={localeString(
                                                                                    'views.NodeInfo.pubkey'
                                                                                )}
                                                                                value={Base64Utils.bytesToHex(
                                                                                    derivation.pubkey
                                                                                ).toUpperCase()}
                                                                            />
                                                                        )}
                                                                        {derivation.path && (
                                                                            <KeyValue
                                                                                keyValue={localeString(
                                                                                    'views.ImportAccount.derivationPath'
                                                                                )}
                                                                                value={
                                                                                    derivation.path
                                                                                }
                                                                            />
                                                                        )}
                                                                    </View>
                                                                )
                                                            )
                                                        ) : (
                                                            <Text
                                                                style={{
                                                                    ...styles.text,
                                                                    color: themeColor(
                                                                        'secondaryText'
                                                                    ),
                                                                    alignSelf:
                                                                        'center'
                                                                }}
                                                            >
                                                                {localeString(
                                                                    'views.PSBT.noData'
                                                                )}
                                                            </Text>
                                                        )}
                                                    </View>
                                                )
                                            )}
                                        </>
                                    )}
                                </View>
                            )}
                        </>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    button: {
        padding: 10
    }
});
