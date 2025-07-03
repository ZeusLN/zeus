import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { ButtonGroup } from 'react-native-elements';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { CryptoPSBT } from '@keystonehq/bc-ur-registry';

const bitcoin = require('bitcoinjs-lib');

import Button from '../components/Button';
import CollapsedQR from '../components/CollapsedQR';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import { WarningMessage } from '../components/SuccessErrorMessage';

import Base64Utils from '../utils/Base64Utils';
import { splitQRs } from '../utils/BbqrUtils';
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
    selectedIndex: number;
    fundedPsbt: string;
    frameIndex: number;
    bbqrParts: Array<string>;
    bcurEncoder: any;
    bcurPart: string;
    psbtDecoded?: PSBTDecoded;
}

@inject('ChannelsStore', 'TransactionsStore')
@observer
export default class PSBT extends React.Component<PSBTProps, PSBTState> {
    state: PSBTState = {
        infoIndex: 0,
        selectedIndex: 0,
        fundedPsbt: '',
        frameIndex: 0,
        bbqrParts: [],
        bcurEncoder: undefined,
        bcurPart: '',
        psbtDecoded: undefined
    };

    UNSAFE_componentWillMount(): void {
        const { route } = this.props;
        const psbt = route.params?.psbt;
        this.setState(
            {
                fundedPsbt: psbt
            },
            () => {
                this.generateInfo();
            }
        );
    }

    UNSAFE_componentWillReceiveProps(nextProps: any): void {
        const { route } = nextProps;
        const psbt = route.params?.psbt;
        this.setState(
            {
                fundedPsbt: psbt
            },
            () => {
                this.generateInfo();
            }
        );
    }

    generateInfo = () => {
        const { fundedPsbt } = this.state;

        // PSBT data
        const psbtDecoded = bitcoin.Psbt.fromBase64(fundedPsbt);

        // BBQr

        const input = Base64Utils.base64ToBytes(fundedPsbt);

        const fileType = 'P'; // 'P' is for PSBT

        const splitResult = splitQRs(input, fileType, {
            // these are optional - default values are shown
            encoding: 'Z', // Zlib compressed base32 encoding
            minSplit: 4, // minimum number of parts to return
            maxSplit: 1295, // maximum number of parts to return
            minVersion: 5, // minimum QR code version
            maxVersion: 40 // maximum QR code version
        });

        // bc-ur

        const messageBuffer = Buffer.from(fundedPsbt, 'base64');

        // Then, create the UREncoder object

        // The maximum amount of fragments to be generated in total
        // For NGRAVE ZERO support please keep to a maximum fragment size of 200
        const maxFragmentLength = 200;

        // The index of the fragment that will be the first to be generated
        // If it's more than the "maxFragmentLength", then all the subsequent fragments will only be
        // fountain parts
        const firstSeqNum = 0;

        // Create the encoder object
        const cryptoPSBT = new CryptoPSBT(messageBuffer);
        const encoder = cryptoPSBT.toUREncoder(maxFragmentLength, firstSeqNum);
        //

        this.setState({
            bcurEncoder: encoder,
            bbqrParts: splitResult.parts,
            psbtDecoded
        });

        const length = splitResult.parts.length;

        setInterval(() => {
            this.setState({
                frameIndex:
                    this.state.frameIndex === length - 1
                        ? 0
                        : this.state.frameIndex + 1,
                bcurPart:
                    this.state.bcurEncoder?.nextPart().toUpperCase() ||
                    undefined
            });
        }, 1000);
    };

    render() {
        const { ChannelsStore, TransactionsStore, navigation } = this.props;
        const { pending_chan_ids } = ChannelsStore;
        const { loading } = TransactionsStore;
        const {
            infoIndex,
            selectedIndex,
            frameIndex,
            bbqrParts,
            fundedPsbt,
            bcurPart,
            psbtDecoded
        } = this.state;

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

        const singleButton = () => (
            <Text
                style={{
                    ...styles.text,
                    color:
                        selectedIndex === 0
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('views.PSBT.singleFrame')}
            </Text>
        );
        const bcurButton = () => (
            <Text
                style={{
                    ...styles.text,
                    color:
                        selectedIndex === 1
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                BC-ur
            </Text>
        );
        const bbqrButton = () => (
            <Text
                style={{
                    ...styles.text,
                    color:
                        selectedIndex === 2
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                BBQr
            </Text>
        );

        const qrButtons: any = [
            { element: singleButton },
            { element: bcurButton },
            { element: bbqrButton }
        ];

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
                                selectedButtonStyle={{
                                    backgroundColor: themeColor('highlight'),
                                    borderRadius: 12
                                }}
                                containerStyle={{
                                    backgroundColor: themeColor('secondary'),
                                    borderRadius: 12,
                                    borderColor: themeColor('secondary'),
                                    marginBottom: 10
                                }}
                                innerBorderStyle={{
                                    color: themeColor('secondary')
                                }}
                            />
                            {infoIndex === 0 && (
                                <>
                                    <ButtonGroup
                                        onPress={(selectedIndex: number) => {
                                            this.setState({ selectedIndex });
                                        }}
                                        selectedIndex={selectedIndex}
                                        buttons={qrButtons}
                                        selectedButtonStyle={{
                                            backgroundColor:
                                                themeColor('highlight'),
                                            borderRadius: 12
                                        }}
                                        containerStyle={{
                                            backgroundColor:
                                                themeColor('secondary'),
                                            borderRadius: 12,
                                            borderColor:
                                                themeColor('secondary'),
                                            marginBottom: 10
                                        }}
                                        innerBorderStyle={{
                                            color: themeColor('secondary')
                                        }}
                                    />
                                    <View
                                        style={{
                                            margin: 10
                                        }}
                                    >
                                        <CollapsedQR
                                            value={
                                                selectedIndex === 0
                                                    ? fundedPsbt
                                                    : selectedIndex === 2
                                                    ? bbqrParts[frameIndex]
                                                    : bcurPart
                                            }
                                            copyValue={fundedPsbt}
                                            truncateLongValue
                                            expanded
                                        />
                                    </View>
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
