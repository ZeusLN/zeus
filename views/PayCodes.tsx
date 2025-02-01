import * as React from 'react';
import {
    FlatList,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import cloneDeep from 'lodash/cloneDeep';

import Header from '../components/Header';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import OffersStore from '../stores/OffersStore';

import Add from '../assets/images/SVG/Add.svg';

interface PayCodesProps {
    navigation: StackNavigationProp<any, any>;
    OffersStore: OffersStore;
}

@inject('OffersStore')
@observer
export default class PayCodes extends React.Component<PayCodesProps, {}> {
    UNSAFE_componentWillMount() {
        const { OffersStore } = this.props;
        OffersStore.listOffers();
    }

    componentDidMount() {
        // triggers when loaded from navigation or back action
        this.props.navigation.addListener('focus', () => {
            this.props.OffersStore.listOffers();
        });
    }

    renderSeparator = () => (
        <View
            style={{
                height: 0.4,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            onPress={() =>
                this.props.navigation.navigate('PayCode', {
                    payCode: cloneDeep(item)
                })
            }
            style={{
                padding: 15
            }}
        >
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 5
                }}
            >
                <Text style={{ color: themeColor('text'), fontSize: 16 }}>
                    {item.label || localeString('general.noLabel')}
                </Text>
                <Text
                    style={{
                        color: item.active
                            ? themeColor('success')
                            : themeColor('error'),
                        fontSize: 16
                    }}
                >
                    {item.active
                        ? localeString('general.active')
                        : localeString('views.Channel.inactive')}
                </Text>
            </View>
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between'
                }}
            >
                <Text
                    style={{ color: themeColor('secondaryText'), fontSize: 16 }}
                >
                    {item.single_use
                        ? localeString('views.PayCode.singleUse')
                        : localeString('views.PayCode.multiUse')}
                </Text>
                <Text
                    style={{
                        color: themeColor('secondaryText'),
                        fontSize: 16
                    }}
                >
                    {item.used
                        ? localeString('general.used')
                        : localeString('general.unused')}
                </Text>
            </View>
        </TouchableOpacity>
    );

    render() {
        const { navigation, OffersStore } = this.props;
        const { offers, loading } = OffersStore;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('general.paycodes'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <TouchableOpacity
                            onPress={() => navigation.navigate('CreatePayCode')}
                            accessibilityLabel={localeString(
                                'views.PayCode.createOffer'
                            )}
                        >
                            <Add
                                fill={themeColor('text')}
                                width="30"
                                height="30"
                                style={{ alignSelf: 'center' }}
                            />
                        </TouchableOpacity>
                    }
                    navigation={navigation}
                />

                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    refreshControl={
                        <RefreshControl
                            refreshing={OffersStore.loading}
                            onRefresh={() => OffersStore.listOffers()}
                        />
                    }
                >
                    {loading ? (
                        <View style={{ padding: 50 }}>
                            <LoadingIndicator />
                        </View>
                    ) : !!offers && offers.length > 0 ? (
                        <FlatList
                            data={offers}
                            renderItem={this.renderItem}
                            keyExtractor={(item) => item?.offer_id?.toString()}
                            ItemSeparatorComponent={this.renderSeparator}
                            scrollEnabled={false}
                        />
                    ) : (
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Book',
                                color: themeColor('secondaryText'),
                                textAlign: 'center'
                            }}
                        >
                            {localeString('views.PayCodes.noPayCodes')}
                        </Text>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}
