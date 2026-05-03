import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

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

import CashuStore from '../../stores/CashuStore';
import ModalStore from '../../stores/ModalStore';

import { writeTokenToTag } from '../../utils/NFCUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import { findCompatibleMint, CREQParams } from '../../utils/CREQUtils';

interface CREQPaymentProps {
    navigation: NativeStackNavigationProp<any, any>;
    CashuStore: CashuStore;
    ModalStore: ModalStore;
    route: Route<
        'CREQPayment',
        {
            creqParams: CREQParams;
            creqString: string;
        }
    >;
}

interface CREQPaymentState {
    loading: boolean;
    success: boolean;
    error: string;
    tokenCreated: string;
    writingNfc: boolean;
}

@inject('CashuStore', 'ModalStore')
@observer
export default class CREQPayment extends React.Component<
    CREQPaymentProps,
    CREQPaymentState
> {
    state: CREQPaymentState = {
        loading: false,
        success: false,
        error: '',
        tokenCreated: '',
        writingNfc: false
    };

    payFromCREQ = async () => {
        const { CashuStore } = this.props;
        const { creqParams } = this.props.route.params;

        const amount = creqParams.amount;
        if (!amount) {
            this.setState({ error: 'CREQ has no amount specified' });
            return;
        }

        // Find a compatible mint
        const mintUrl = this.getCompatibleMint();
        if (!mintUrl) {
            this.setState({
                error: 'No compatible mint with sufficient balance'
            });
            return;
        }

        this.setState({ loading: true, error: '' });

        try {
            const token = await CashuStore.sendTokenCDK(
                mintUrl,
                amount,
                creqParams.description
            );

            this.setState({
                loading: false,
                tokenCreated: token.encoded
            });
        } catch (e: any) {
            this.setState({
                loading: false,
                error: e.message || 'Failed to create token'
            });
        }
    };

    writeViaNfc = async () => {
        const { ModalStore } = this.props;
        const { tokenCreated } = this.state;

        this.setState({ writingNfc: true });
        const success = await writeTokenToTag(ModalStore!, tokenCreated);
        this.setState({
            writingNfc: false,
            success,
            error: success ? '' : 'Failed to write token via NFC'
        });
    };

    getCompatibleMint(): string | undefined {
        const { CashuStore } = this.props;
        const { creqParams } = this.props.route.params;
        return findCompatibleMint(
            creqParams,
            CashuStore.mintUrls,
            CashuStore.mintBalances,
            CashuStore.selectedMintUrl
        );
    }

    render() {
        const { navigation } = this.props;
        const { creqParams } = this.props.route.params;
        const { loading, success, error, tokenCreated, writingNfc } =
            this.state;

        const compatibleMint = this.getCompatibleMint();

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Payment.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />

                {(loading || writingNfc) && (
                    <View style={{ marginTop: 40 }}>
                        <LoadingIndicator />
                    </View>
                )}

                {!!error && (
                    <View style={styles.content}>
                        <ErrorMessage message={error} />
                    </View>
                )}

                {success && (
                    <View style={styles.content}>
                        <SuccessMessage
                            message={localeString('general.success')}
                        />
                    </View>
                )}

                {!loading && !success && (
                    <View style={styles.content}>
                        {creqParams.amount != null && (
                            <View style={styles.center}>
                                <Amount
                                    sats={creqParams.amount}
                                    jumboText
                                    toggleable
                                />
                            </View>
                        )}

                        {!!creqParams.description && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.PaymentRequest.description'
                                )}
                                value={creqParams.description}
                            />
                        )}

                        {creqParams.mints && creqParams.mints.length > 0 && (
                            <KeyValue
                                keyValue={localeString('cashu.mint')}
                                value={creqParams.mints.join(', ')}
                            />
                        )}

                        {!!compatibleMint && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Cashu.CashuPaymentRequest.sendingFrom'
                                )}
                                value={compatibleMint}
                            />
                        )}

                        {!tokenCreated && (
                            <View style={styles.button}>
                                <Button
                                    title={localeString(
                                        'views.PaymentRequest.payInvoice'
                                    )}
                                    icon={{ name: 'send', size: 25 }}
                                    onPress={this.payFromCREQ}
                                    disabled={!compatibleMint}
                                />
                            </View>
                        )}

                        {!!tokenCreated && !success && (
                            <View style={styles.button}>
                                <Button
                                    title={localeString(
                                        'views.Cashu.CREQPayment.tapToDeliver'
                                    )}
                                    onPress={this.writeViaNfc}
                                />
                            </View>
                        )}
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: 20,
        paddingTop: 10
    },
    center: {
        alignItems: 'center',
        marginTop: 25,
        marginBottom: 25
    },
    button: {
        paddingTop: 30,
        paddingBottom: 15
    }
});
