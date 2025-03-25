import * as React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import CashuStore from '../../stores/CashuStore';
import stores from '../../stores/Stores';

import Amount from '../../components/Amount';
import Button from '../../components/Button';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import { Row } from '../../components/layout/Row';
import {
    SuccessMessage,
    ErrorMessage
} from '../../components/SuccessErrorMessage';

import CashuToken from '../../models/CashuToken';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import QR from '../../assets/images/SVG/QR.svg';

interface CashuTokenProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore?: CashuStore;
    route: Route<'CashuToken', { token?: string; decoded: CashuToken }>;
}

interface CashuTokenState {
    updatedToken?: CashuToken;
    success: boolean;
    errorMessage: string;
}

@inject('CashuStore')
@observer
export default class CashuTokenView extends React.Component<
    CashuTokenProps,
    CashuTokenState
> {
    state = {
        updatedToken: undefined,
        success: false,
        errorMessage: ''
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
        const { spent, mint } = decoded;

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
                    stores.activityStore.getActivityAndFilter(
                        stores.settingsStore.settings.locale
                    );
                } else {
                    console.log('Token not spent, checking again...');
                }
            }, 5000);
        }
    }

    render() {
        const { navigation, route, CashuStore } = this.props;
        const { success, errorMessage, updatedToken } = this.state;
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
        const token = route.params?.token || encodedToken;

        const haveMint = mintUrls.includes(mint);

        const QRButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('QR', {
                        value: `cashu:${token}`
                    })
                }
            >
                <QR fill={themeColor('text')} style={{ alignSelf: 'center' }} />
            </TouchableOpacity>
        );

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
                        <Row>
                            {loading && (
                                <View style={{ marginRight: 10 }}>
                                    <LoadingIndicator size={30} />
                                </View>
                            )}
                            <QRButton />
                        </Row>
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
                                keyValue={localeString('views.Invoice.memo')}
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
                    </View>
                </ScrollView>
                {!received && !sent && (
                    <View style={{ bottom: 15 }}>
                        {!haveMint && (
                            <Button
                                title={localeString(
                                    'views.Cashu.AddMint.title'
                                )}
                                onPress={() => addMint(mint)}
                                containerStyle={{ marginTop: 15 }}
                                noUppercase
                                disabled={!isSupported || loading}
                                tertiary
                            />
                        )}
                        <Button
                            title={localeString('views.OpenChannel.import')}
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
                            noUppercase
                            disabled={
                                !haveMint ||
                                errorAddingMint ||
                                !isSupported ||
                                loading ||
                                success
                            }
                        />
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
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
