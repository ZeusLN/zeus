import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { ButtonGroup } from 'react-native-elements';
import { UR, UREncoder } from '@ngraveio/bc-ur';

import Button from '../components/Button';
import CollapsedQR from '../components/CollapsedQR';
import Header from '../components/Header';
import Screen from '../components/Screen';

import Base64Utils from '../utils/Base64Utils';
import { splitQRs } from '../utils/BbqrUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import TransactionsStore from '../stores/TransactionsStore';

interface PSBTProps {
    navigation: any;
    TransactionsStore: TransactionsStore;
}

interface PSBTState {
    selectedIndex: number;
    fundedPsbt: string;
    qrIndex: number;
    bbqrParts: Array<string>;
    bcurEncoder: any;
    bcurPart: string;
}

@inject('TransactionsStore')
@observer
export default class PSBT extends React.Component<PSBTProps, PSBTState> {
    state = {
        selectedIndex: 0,
        fundedPsbt: '',
        qrIndex: 0,
        bbqrParts: [],
        bcurEncoder: undefined,
        bcurPart: ''
    };

    UNSAFE_componentWillMount(): void {
        const { navigation } = this.props;
        const psbt: string = navigation.getParam('psbt');
        this.setState(
            {
                fundedPsbt: psbt
            },
            () => {
                this.generateBBQR();
            }
        );
    }

    generateBBQR = () => {
        const { fundedPsbt } = this.state;

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

        const messageBuffer = Buffer.from(fundedPsbt);

        // First step is to create a UR object from a Buffer
        const ur = UR.fromBuffer(messageBuffer);

        // Then, create the UREncoder object

        // The maximum amount of fragments to be generated in total
        // For NGRAVE ZERO support please keep to a maximum fragment size of 200
        const maxFragmentLength = 200;

        // The index of the fragment that will be the first to be generated
        // If it's more than the "maxFragmentLength", then all the subsequent fragments will only be
        // fountain parts
        const firstSeqNum = 0;

        // Create the encoder object
        const encoder = new UREncoder(ur, maxFragmentLength, firstSeqNum);
        //

        this.setState({
            bbqrParts: splitResult.parts
        });

        const length = splitResult.parts.length;

        this.setState({
            bcurEncoder: encoder
        });

        setInterval(() => {
            this.setState({
                qrIndex:
                    this.state.qrIndex === length - 1
                        ? 0
                        : this.state.qrIndex + 1,
                bcurPart: this.state.bcurEncoder?.nextPart() || undefined
            });
        }, 1000);
    };

    render() {
        const { TransactionsStore, navigation } = this.props;
        const { loading } = TransactionsStore;
        const { selectedIndex, qrIndex, bbqrParts, fundedPsbt, bcurPart } =
            this.state;

        const singleButton = () => (
            <Text
                style={{
                    ...styles.text,
                    color:
                        selectedIndex === 3
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
                        selectedIndex === 4
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
                        selectedIndex === 5
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                BBQr
            </Text>
        );

        const buttons = [
            { element: singleButton },
            { element: bcurButton },
            { element: bbqrButton }
        ];

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    onBack={() => {
                        navigation.navigate('Wallet');
                    }}
                    centerComponent={{
                        text: 'PSBT',
                        style: { color: themeColor('text') }
                    }}
                    navigation={navigation}
                />
                {!loading && fundedPsbt && (
                    <>
                        <ButtonGroup
                            onPress={(selectedIndex: number) => {
                                this.setState({ selectedIndex });
                            }}
                            selectedIndex={selectedIndex}
                            buttons={buttons}
                            selectedButtonStyle={{
                                backgroundColor: themeColor('highlight'),
                                borderRadius: 12
                            }}
                            containerStyle={{
                                backgroundColor: themeColor('secondary'),
                                borderRadius: 12,
                                borderColor: themeColor('secondary'),
                                marginBottom: 20
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
                                        ? bbqrParts[qrIndex]
                                        : bcurPart
                                }
                                truncateLongValue
                                expanded
                            />
                        </View>
                        <View style={styles.button}>
                            <Button
                                title={localeString(
                                    'views.PSBT.scanSignedPsbt'
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
                                    TransactionsStore.finalizePsbtAndBroadcast(
                                        fundedPsbt
                                    ).then(() => {
                                        navigation.navigate('SendingOnChain');
                                    });
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
