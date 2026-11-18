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

import { payViaNfcTap } from '../../utils/NFCUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import {
    creqPaymentError,
    findCompatibleMint,
    CREQParams
} from '../../utils/CREQUtils';

interface CREQPaymentProps {
    navigation: NativeStackNavigationProp<any, any>;
    CashuStore: CashuStore;
    ModalStore: ModalStore;
    route: Route<
        'CREQPayment',
        {
            creqParams: CREQParams;
            creqString: string;
            /** the Lightning invoice the request came with, if any */
            invoice?: string;
        }
    >;
}

interface CREQPaymentState {
    loading: boolean;
    success: boolean;
    error: string;
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
        error: ''
    };

    // One NFC session reads the tag, checks it still holds this request,
    // then creates the token and writes it back
    payViaNfc = async () => {
        const { CashuStore, ModalStore } = this.props;
        const { creqParams, invoice } = this.props.route.params;

        this.setState({ loading: true, error: '' });
        const result = await payViaNfcTap(ModalStore, CashuStore, {
            expected: creqParams,
            expectedInvoice: invoice
        });

        if (result.status === 'paid') {
            this.setState({ loading: false, success: true });
        } else if (result.status === 'failed') {
            this.setState({ loading: false, error: result.error });
        } else {
            this.setState({ loading: false });
        }
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
        const { loading, success, error } = this.state;

        const compatibleMint = this.getCompatibleMint();
        const requestError = creqPaymentError(creqParams);
        const errorMessage =
            error || (requestError ? localeString(requestError) : '');

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

                {loading && (
                    <View style={{ marginTop: 40 }}>
                        <LoadingIndicator />
                    </View>
                )}

                {!!errorMessage && (
                    <View style={styles.content}>
                        <ErrorMessage message={errorMessage} />
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

                        <View style={styles.button}>
                            <Button
                                title={localeString(
                                    'views.Cashu.CREQPayment.payViaNfc'
                                )}
                                icon={{ name: 'nfc', size: 25 }}
                                onPress={this.payViaNfc}
                                disabled={!compatibleMint || !!requestError}
                            />
                        </View>
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
