import * as React from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Offer from './../../models/Offer';

import Button from './../../components/Button';
import CollapsedQR from './../../components/CollapsedQR';
import KeyValue from './../../components/KeyValue';
import LoadingIndicator from './../../components/LoadingIndicator';
import { ErrorMessage } from './../../components/SuccessErrorMessage';

import InvoicesStore from './../../stores/InvoicesStore';

import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

interface OfferProps {
    navigation: any;
    InvoicesStore: InvoicesStore;
}

interface OfferState {
    confirmDisableOffer: boolean;
}

@inject('InvoicesStore')
@observer
export default class OfferView extends React.Component<OfferProps, OfferState> {
    state = {
        confirmDisableOffer: false
    };

    render() {
        const { navigation, InvoicesStore } = this.props;
        const { confirmDisableOffer } = this.state;
        const offer: Offer = navigation.getParam('offer', null);
        const {
            bolt12,
            bolt12_unsigned,
            offer_id,
            single_use,
            used,
            active,
            label
        } = offer;

        const { loading, error_msg, reset } = InvoicesStore;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => {
                    reset();
                    navigation.navigate('Offers', { refresh: true });
                }}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <ScrollView
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Offer.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />

                {loading && <LoadingIndicator />}

                {!loading && (
                    <View style={styles.content}>
                        {error_msg && <ErrorMessage message={error_msg} />}

                        {!!label && (
                            <KeyValue
                                keyValue={localeString('views.Offer.label')}
                                value={label}
                                sensitive
                            />
                        )}

                        {!!offer_id && (
                            <KeyValue
                                keyValue={localeString('views.Offer.offerId')}
                                value={offer_id}
                                sensitive
                            />
                        )}

                        <KeyValue
                            keyValue={localeString('views.Offer.isActive')}
                            value={active ? 'True' : 'False'}
                            color={active ? 'green' : 'red'}
                        />

                        <KeyValue
                            keyValue={localeString('general.status')}
                            value={
                                used
                                    ? localeString(
                                          'views.Offers.paymentReceived'
                                      )
                                    : localeString(
                                          'views.Offers.awaitingPayment'
                                      )
                            }
                        />

                        <KeyValue
                            keyValue={localeString('general.type')}
                            value={
                                single_use
                                    ? localeString('views.Offers.singleUse')
                                    : localeString('views.Offers.recurring')
                            }
                        />

                        {!!bolt12 && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Offer.bolt12Offer'
                                )}
                                value={bolt12}
                                sensitive
                            />
                        )}

                        {!!bolt12 && (
                            <CollapsedQR
                                value={bolt12}
                                copyText={localeString(
                                    'views.Offer.copyBolt12Offer'
                                )}
                                hideText
                            />
                        )}

                        {!!bolt12_unsigned && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Offer.bolt12OfferUnsigned'
                                )}
                                value={bolt12_unsigned}
                                sensitive
                            />
                        )}

                        {!!bolt12_unsigned && (
                            <CollapsedQR
                                value={bolt12_unsigned}
                                copyText={localeString(
                                    'views.Offer.copyBolt12OfferUnsigned'
                                )}
                                hideText
                            />
                        )}

                        {confirmDisableOffer && (
                            <React.Fragment>
                                <View style={styles.button}>
                                    <Button
                                        title={localeString(
                                            'views.Offer.confirmDisableOffer'
                                        )}
                                        icon={{
                                            name: 'delete-forever'
                                        }}
                                        onPress={() =>
                                            InvoicesStore.disableOffer(
                                                offer_id
                                            ).then((data: any) => {
                                                if (data.success)
                                                    navigation.navigate(
                                                        'Offers',
                                                        { refresh: true }
                                                    );
                                            })
                                        }
                                        buttonStyle={{
                                            backgroundColor: 'darkred'
                                        }}
                                        tertiary
                                    />
                                </View>
                            </React.Fragment>
                        )}

                        {active && (
                            <View style={styles.button}>
                                <Button
                                    title={
                                        confirmDisableOffer
                                            ? localeString('general.cancel')
                                            : localeString(
                                                  'views.Offer.disableOffer'
                                              )
                                    }
                                    icon={{
                                        name: confirmDisableOffer
                                            ? 'cancel'
                                            : 'delete'
                                    }}
                                    onPress={() =>
                                        this.setState({
                                            confirmDisableOffer:
                                                !confirmDisableOffer
                                        })
                                    }
                                    secondary
                                />
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15
    }
});
