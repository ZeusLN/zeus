import * as React from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ButtonGroup } from 'react-native-elements';
import { UR, UREncoder } from '@ngraveio/bc-ur';

import CashuStore from '../../stores/CashuStore';
import ChannelsStore from '../../stores/ChannelsStore';
import { activityStore, settingsStore } from '../../stores/Stores';

import Amount from '../../components/Amount';
import Button from '../../components/Button';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import {
    SuccessMessage,
    ErrorMessage
} from '../../components/SuccessErrorMessage';
import Text from '../../components/Text';
import CollapsedQR from '../../components/CollapsedQR';

import CashuToken from '../../models/CashuToken';

import BackendUtils from '../../utils/BackendUtils';
import DateTimeUtils from '../../utils/DateTimeUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import Base64Utils from '../../utils/Base64Utils';
import { splitQRs } from '../../utils/BbqrUtils';

interface CashuTokenProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    ChannelsStore: ChannelsStore;
    route: Route<'CashuToken', { token?: string; decoded: CashuToken }>;
}

interface CashuTokenState {
    updatedToken?: CashuToken;
    success: boolean;
    errorMessage: string;
    infoIndex: number;
    selectedIndex: number;
    cashuBBQrParts: Array<string>;
    cashuBcurEncoder: any;
    cashuFrameIndex: number;
    cashuBcurPart: string;
    isTokenTooLarge: boolean;
}

@inject('CashuStore', 'ChannelsStore')
@observer
export default class CashuTokenView extends React.Component<
    CashuTokenProps,
    CashuTokenState
> {
    state = {
        updatedToken: undefined,
        success: false,
        errorMessage: '',
        infoIndex: 0,
        selectedIndex: 0,
        cashuBBQrParts: [],
        cashuBcurEncoder: undefined,
        cashuFrameIndex: 0,
        cashuBcurPart: '',
        isTokenTooLarge: false
    };

    async componentDidMount() {
        const { route, CashuStore } = this.props;
        const {
            checkTokenSpent,
            markTokenSpent,
            clearToken,
            initializeWallet,
            cashuWallets
        } = CashuStore!!;

        clearToken();
        const decoded = route.params?.decoded;
        const token = route.params?.token || decoded?.encodedToken;
        const { spent, mint } = decoded;

        console.log('Decoded token:', decoded);
        if (token) this.generateCashuInfo(token);

        if (!spent) {
            console.log('token not spent last time checked, checking...', {
                decoded
            });

            if (!cashuWallets[mint].wallet) {
                await initializeWallet(mint, true);
            }

            // Set up a periodic check every 5 seconds
            const checkInterval = setInterval(async () => {
                const isSpent = await checkTokenSpent(decoded);

                if (isSpent) {
                    console.log('Token spent, stopping check...');
                    const updatedToken = await markTokenSpent(decoded);
                    this.setState({
                        updatedToken
                    });
                    clearInterval(checkInterval); // Stop checking once spent
                    activityStore.getActivityAndFilter(
                        settingsStore.settings.locale
                    );
                } else {
                    console.log('Token not spent, checking again...');
                }
            }, 5000);
        }
    }

    generateCashuInfo = (token: string) => {
        const MAX_TOKEN_LENGTH = 1000;
        const input = Base64Utils.base64ToBytes(token);
        const fileType = 'U';

        const splitResult = splitQRs(input, fileType, {
            encoding: 'Z',
            minSplit: 4,
            maxSplit: 1295,
            minVersion: 5,
            maxVersion: 40
        });

        const messageBuffer = Buffer.from(token, 'utf-8');
        const ur = UR.fromBuffer(messageBuffer);
        const encoder = new UREncoder(ur, 200, 0);

        const length = splitResult.parts.length;

        this.setState({
            cashuBcurEncoder: encoder,
            cashuBBQrParts: splitResult.parts,
            cashuFrameIndex: 0,
            cashuBcurPart: encoder.nextPart(),
            isTokenTooLarge: token.length > MAX_TOKEN_LENGTH
        });

        setInterval(() => {
            this.setState((prevState: any) => ({
                cashuFrameIndex:
                    prevState.cashuFrameIndex === length - 1
                        ? 0
                        : prevState.cashuFrameIndex + 1,
                cashuBcurPart: encoder.nextPart()
            }));
        }, 1000);
    };

    render() {
        const { navigation, route, CashuStore, ChannelsStore } = this.props;
        const {
            success,
            errorMessage,
            updatedToken,
            infoIndex,
            selectedIndex,
            cashuBBQrParts,
            cashuFrameIndex,
            cashuBcurPart
        } = this.state;
        const { mintUrls, addMint, claimToken, loading, errorAddingMint } =
            CashuStore!!;
        const decoded = updatedToken || route.params?.decoded;
        const {
            memo,
            mint,
            unit,
            proofs,
            getAmount,
            isSupported,
            received,
            sent,
            spent,
            encodedToken,
            getDisplayTime
        } = decoded;
        const token: string = route.params?.token || encodedToken || '';

        const haveMint = mintUrls.includes(mint);
        const hasOpenChannels = ChannelsStore?.channels?.length > 0;

        const qrButton = () => (
            <Text
                style={{
                    ...styles.text,
                    color:
                        infoIndex === 1
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
                        infoIndex === 0
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('views.Cashu.CashuToken.info')}
            </Text>
        );

        const infoButtons: any = [
            { element: infoButton },
            { element: qrButton }
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
        const bcurButton = () => {
            const bcurIndex = this.state.isTokenTooLarge ? 0 : 1;
            return (
                <Text
                    style={{
                        ...styles.text,
                        color:
                            selectedIndex === bcurIndex
                                ? themeColor('background')
                                : themeColor('text')
                    }}
                >
                    BC-ur
                </Text>
            );
        };

        const bbqrButton = () => {
            const bbqrIndex = this.state.isTokenTooLarge ? 1 : 2;
            return (
                <Text
                    style={{
                        ...styles.text,
                        color:
                            selectedIndex === bbqrIndex
                                ? themeColor('background')
                                : themeColor('text')
                    }}
                >
                    BBQr
                </Text>
            );
        };

        const qrButtons: any = [
            !this.state.isTokenTooLarge && { element: singleButton },
            { element: bcurButton },
            { element: bbqrButton }
        ].filter(Boolean);

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: received
                            ? localeString('cashu.receivedToken')
                            : sent && !spent
                            ? localeString('cashu.unspentToken')
                            : sent && spent
                            ? localeString('cashu.sentToken')
                            : localeString('cashu.token'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        loading ? (
                            <View style={{ marginRight: 10 }}>
                                <LoadingIndicator size={30} />
                            </View>
                        ) : (
                            <></>
                        )
                    }
                    navigation={navigation}
                />
                <ScrollView keyboardShouldPersistTaps="handled">
                    {success && (
                        <SuccessMessage
                            message={localeString(
                                'views.Cashu.CashuToken.success'
                            )}
                        />
                    )}

                    {errorMessage && <ErrorMessage message={errorMessage} />}

                    {errorAddingMint && (
                        <ErrorMessage
                            message={localeString('cashu.errorAddingMint')}
                        />
                    )}

                    {!isSupported && (
                        <ErrorMessage
                            message={`${localeString(
                                'views.Cashu.CashuToken.notSupported'
                            )}: ${unit}`}
                        />
                    )}

                    {isSupported && (
                        <View style={styles.center}>
                            <Amount
                                sats={getAmount}
                                sensitive
                                jumboText
                                toggleable
                                credit={received}
                                debit={sent && spent}
                                pending={sent && !spent}
                            />
                        </View>
                    )}

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
                        <View style={styles.content}>
                            {mint && (
                                <KeyValue
                                    keyValue={localeString('cashu.mintUrl')}
                                    value={mint}
                                    sensitive
                                />
                            )}

                            {memo && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Invoice.memo'
                                    )}
                                    value={memo}
                                    sensitive
                                />
                            )}

                            {proofs?.length && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Cashu.CashuToken.proofCount'
                                    )}
                                    value={proofs.length}
                                    sensitive
                                />
                            )}

                            {getDisplayTime && (
                                <KeyValue
                                    keyValue={localeString(
                                        sent
                                            ? 'views.Invoice.creationDate'
                                            : 'views.Invoice.settleDate'
                                    )}
                                    value={getDisplayTime}
                                    sensitive
                                />
                            )}

                            {decoded?.getLockPubkey && (
                                <KeyValue
                                    keyValue={localeString('cashu.lockTo')}
                                    value={
                                        decoded.getContactName ||
                                        decoded.getLockPubkey
                                    }
                                    sensitive
                                />
                            )}

                            {decoded?.getLockPubkey && (
                                <KeyValue
                                    keyValue={localeString('cashu.locktime')}
                                    value={
                                        decoded.getLocktime
                                            ? DateTimeUtils.listFormattedDate(
                                                  decoded.getLocktime
                                              )
                                            : localeString(
                                                  'cashu.duration.forever'
                                              )
                                    }
                                    sensitive
                                />
                            )}
                        </View>
                    )}

                    {infoIndex === 1 && (
                        <>
                            <ButtonGroup
                                onPress={(selectedIndex: number) => {
                                    this.setState({ selectedIndex });
                                }}
                                selectedIndex={selectedIndex}
                                buttons={qrButtons}
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
                            <View
                                style={{
                                    margin: 10
                                }}
                            >
                                <CollapsedQR
                                    value={
                                        !this.state.isTokenTooLarge
                                            ? selectedIndex === 0
                                                ? `cashu:${token}`
                                                : selectedIndex === 1
                                                ? cashuBcurPart
                                                : cashuBBQrParts[
                                                      cashuFrameIndex
                                                  ]
                                            : selectedIndex === 0
                                            ? cashuBcurPart
                                            : cashuBBQrParts[cashuFrameIndex]
                                    }
                                    truncateLongValue
                                    expanded
                                />
                            </View>
                        </>
                    )}
                </ScrollView>
                {infoIndex === 0 && !received && (!sent || (sent && !spent)) && (
                    <View style={{ bottom: 15 }}>
                        {BackendUtils.supportsCashuWallet() && (
                            <>
                                <Button
                                    title={localeString(
                                        'views.OpenChannel.import'
                                    )}
                                    onPress={async () => {
                                        this.setState({
                                            errorMessage: ''
                                        });

                                        const { success, errorMessage } =
                                            await claimToken(token!!, decoded);
                                        if (errorMessage) {
                                            this.setState({
                                                errorMessage
                                            });
                                        } else if (success) {
                                            this.setState({
                                                success
                                            });
                                        }
                                    }}
                                    containerStyle={{ marginTop: 15 }}
                                    disabled={
                                        !haveMint ||
                                        errorAddingMint ||
                                        !isSupported ||
                                        loading ||
                                        success
                                    }
                                />
                                {!haveMint && (
                                    <Button
                                        title={localeString(
                                            'views.Cashu.AddMint.title'
                                        )}
                                        onPress={() => addMint(mint)}
                                        containerStyle={{ marginTop: 15 }}
                                        disabled={!isSupported || loading}
                                        tertiary
                                    />
                                )}
                            </>
                        )}
                        <Button
                            title={localeString(
                                'views.Cashu.CashuToken.meltTokenSelfCustody'
                            )}
                            onPress={async () => {
                                this.setState({
                                    errorMessage: ''
                                });

                                const { success, errorMessage } =
                                    await claimToken(token!!, decoded, true);
                                if (errorMessage) {
                                    this.setState({
                                        errorMessage
                                    });
                                } else if (success) {
                                    this.setState({
                                        success
                                    });
                                }
                            }}
                            containerStyle={{ marginTop: 15 }}
                            disabled={
                                !hasOpenChannels ||
                                !isSupported ||
                                loading ||
                                success
                            }
                            secondary
                        />
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    }
});
