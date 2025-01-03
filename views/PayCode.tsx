import * as React from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../components/Button';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import { ErrorMessage } from '../components/SuccessErrorMessage';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import OffersStore from '../stores/OffersStore';

import QR from '../assets/images/SVG/QR.svg';

interface PayCodeProps {
    navigation: StackNavigationProp<any, any>;
    OffersStore: OffersStore;
    route: Route<'PayCode', { payCode: any }>;
}

interface PayCodeState {
    payCode: any;
    confirmDisableOffer: boolean;
}

@inject('OffersStore')
@observer
export default class PayCodeView extends React.Component<
    PayCodeProps,
    PayCodeState
> {
    constructor(props: PayCodeProps) {
        super(props);
        const { route } = props;
        const { payCode } = route.params ?? {};

        this.state = {
            payCode,
            confirmDisableOffer: false
        };
    }

    render() {
        const { navigation, OffersStore } = this.props;
        const { payCode, confirmDisableOffer } = this.state;
        const { active, label, single_use, offer_id, bolt12, used } = payCode;
        const { loading, error_msg } = OffersStore;

        const QRButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('QR', {
                        value: `lightning:${this.state.payCode.bolt12}`
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
                        text: localeString('general.paycode'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={<QRButton />}
                    navigation={navigation}
                />

                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {error_msg && <ErrorMessage message={error_msg} />}
                    <KeyValue
                        keyValue={localeString('general.active')}
                        value={
                            active
                                ? localeString('general.true')
                                : localeString('general.false')
                        }
                        color={
                            active ? themeColor('success') : themeColor('error')
                        }
                    />

                    <KeyValue
                        keyValue={localeString('general.used')}
                        value={
                            used
                                ? localeString('general.true')
                                : localeString('general.false')
                        }
                        color={
                            used ? themeColor('success') : themeColor('error')
                        }
                    />

                    <KeyValue
                        keyValue={localeString('general.type')}
                        value={
                            single_use
                                ? localeString('views.PayCode.singleUse')
                                : localeString('views.PayCode.multiUse')
                        }
                    />

                    <KeyValue
                        keyValue={localeString('general.label')}
                        value={label || localeString('general.noLabel')}
                    />

                    <KeyValue
                        keyValue={localeString('views.PayCode.offerId')}
                        value={offer_id}
                    />

                    <KeyValue
                        keyValue={localeString('views.PayCode.bolt12')}
                        value={bolt12}
                    />
                </ScrollView>
                <View style={{ bottom: 15 }}>
                    {loading && <LoadingIndicator />}
                    {!loading && active && (
                        <Button
                            title={
                                confirmDisableOffer
                                    ? localeString(
                                          'views.PayCode.confirmDisableOffer'
                                      )
                                    : localeString('views.PayCode.disableOffer')
                            }
                            warning
                            onPress={() => {
                                if (!confirmDisableOffer) {
                                    this.setState({
                                        confirmDisableOffer: true
                                    });
                                } else {
                                    OffersStore.disableOffer(offer_id).then(
                                        (data: any) => {
                                            this.setState({
                                                payCode: data
                                            });
                                        }
                                    );
                                }
                            }}
                        />
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        paddingLeft: 20,
        paddingRight: 20
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    }
});
