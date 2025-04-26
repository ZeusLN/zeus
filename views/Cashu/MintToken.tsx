import * as React from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import AmountInput, { getSatAmount } from '../../components/AmountInput';
import Button from '../../components/Button';
import EcashMintPicker from '../../components/EcashMintPicker';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';

import CashuStore from '../../stores/CashuStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import CashuToken from '../../models/CashuToken';

interface MintTokenProps {
    exitSetup: any;
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    route: Route<
        'MintToken',
        {
            amount: string;
        }
    >;
}

interface MintTokenState {
    loading: boolean;
    memo: string;
    value: string;
    satAmount: string | number;
}

@inject('CashuStore', 'UnitsStore')
@observer
export default class MintToken extends React.Component<
    MintTokenProps,
    MintTokenState
> {
    constructor(props: MintTokenProps) {
        super(props);
        this.state = {
            loading: true,
            memo: '',
            value: '',
            satAmount: ''
        };
    }

    async UNSAFE_componentWillMount() {
        const { CashuStore, route } = this.props;
        const { clearToken } = CashuStore;

        clearToken();

        const { amount } = route.params ?? {};

        if (amount && amount != '0') {
            this.setState({
                value: amount,
                satAmount: getSatAmount(amount)
            });
        }

        this.setState({
            loading: false
        });
    }

    render() {
        const { CashuStore, navigation } = this.props;
        const { memo, value, satAmount } = this.state;

        const { fontScale } = Dimensions.get('window');

        const { mintToken, mintingToken, loadingMsg } = CashuStore;
        const loading = CashuStore.loading || this.state.loading;

        const error_msg = CashuStore.error_msg;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('cashu.mintEcashToken'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />

                <View style={{ flex: 1 }}>
                    <ScrollView
                        style={styles.content}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                    >
                        {error_msg && <ErrorMessage message={error_msg} />}

                        <View>
                            {(mintingToken || loading) && (
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

                            {!loading && !mintingToken && (
                                <>
                                    <>
                                        <Text
                                            style={{
                                                ...styles.text,
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
                                                navigation={navigation}
                                            />
                                        </View>
                                    </>
                                    <>
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString('views.Receive.memo')}
                                        </Text>
                                        <TextInput
                                            placeholder={localeString(
                                                'views.Receive.memoPlaceholder'
                                            )}
                                            value={memo}
                                            onChangeText={(text: string) => {
                                                this.setState({
                                                    memo: text
                                                });
                                            }}
                                        />
                                    </>

                                    <AmountInput
                                        amount={value}
                                        title={localeString(
                                            'views.Receive.amount'
                                        )}
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
                                            title={localeString(
                                                'cashu.mintEcashToken'
                                            )}
                                            onPress={() => {
                                                mintToken({
                                                    memo,
                                                    value:
                                                        satAmount.toString() ||
                                                        '0'
                                                }).then(
                                                    (
                                                        result:
                                                            | {
                                                                  token: string;
                                                                  decoded: CashuToken;
                                                              }
                                                            | undefined
                                                    ) => {
                                                        if (
                                                            result?.token &&
                                                            result.decoded
                                                        ) {
                                                            const {
                                                                token,
                                                                decoded
                                                            } = result;
                                                            navigation.navigate(
                                                                'CashuToken',
                                                                {
                                                                    token,
                                                                    decoded
                                                                }
                                                            );
                                                        }
                                                    }
                                                );
                                            }}
                                        />
                                    </View>
                                </>
                            )}
                        </View>
                    </ScrollView>
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
        paddingTop: 25,
        paddingBottom: 15
    },
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    }
});
