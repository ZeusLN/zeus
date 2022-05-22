import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Button, Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import LoadingIndicator from '../../components/LoadingIndicator';
import { Tag } from './Tag';

import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import InvoicesStore from './../../stores/InvoicesStore';

interface OffersProps {
    navigation: any;
    InvoicesStore: InvoicesStore;
}

@inject('InvoicesStore')
@observer
export default class Offers extends React.Component<OffersProps, {}> {
    async UNSAFE_componentWillMount() {
        const { InvoicesStore } = this.props;
        const { getOffers } = InvoicesStore;
        getOffers();
    }

    UNSAFE_componentWillReceiveProps = (newProps: any) => {
        const { InvoicesStore } = newProps;
        const { getOffers } = InvoicesStore;
        getOffers();
    };

    renderSeparator = () => (
        <View
            style={{
                height: 0.4,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    render() {
        const { navigation, InvoicesStore } = this.props;
        const { loading, offers, getOffers } = InvoicesStore;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        const AddButton = () => (
            <Button
                title=""
                icon={{
                    name: 'add',
                    size: 25,
                    color: themeColor('text')
                }}
                buttonStyle={{
                    backgroundColor: 'transparent',
                    marginRight: -10
                }}
                onPress={() =>
                    navigation.navigate('Receive', { invoiceType: 'bolt12' })
                }
            />
        );

        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background'),
                    color: themeColor('text')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Offers.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    rightComponent={<AddButton />}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                {loading ? (
                    <View style={{ padding: 50 }}>
                        <LoadingIndicator />
                    </View>
                ) : !!offers && offers.length > 0 ? (
                    <FlatList
                        data={offers}
                        renderItem={({ item }: { item: any }) => {
                            const displayName = item.label || item.offer_id;
                            const subTitle = item.used
                                ? localeString('views.Offers.paymentReceived')
                                : localeString('views.Offers.awaitingPayment');

                            return (
                                <React.Fragment>
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor:
                                                themeColor('background')
                                        }}
                                        onPress={() => {
                                            navigation.navigate('Offer', {
                                                offer: item
                                            });
                                        }}
                                    >
                                        <ListItem.Content>
                                            <ListItem.Title
                                                right
                                                style={{
                                                    fontWeight: '600',
                                                    color: themeColor('text'),
                                                    fontFamily: 'Lato-Regular'
                                                }}
                                            >
                                                {displayName}
                                            </ListItem.Title>
                                            <ListItem.Subtitle
                                                right
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    fontFamily: 'Lato-Regular'
                                                }}
                                            >
                                                {subTitle}
                                            </ListItem.Subtitle>
                                        </ListItem.Content>
                                        <ListItem.Content right>
                                            <Tag active={item.active} />
                                            <ListItem.Subtitle
                                                right
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    fontFamily: 'Lato-Regular'
                                                }}
                                            >
                                                {item.single_use
                                                    ? localeString(
                                                          'views.Offers.singleUse'
                                                      )
                                                    : localeString(
                                                          'views.Offers.recurring'
                                                      )}
                                            </ListItem.Subtitle>
                                        </ListItem.Content>
                                    </ListItem>
                                </React.Fragment>
                            );
                        }}
                        keyExtractor={(item, index) => `${item.model}-${index}`}
                        ItemSeparatorComponent={this.renderSeparator}
                        onEndReachedThreshold={50}
                        refreshing={loading}
                        onRefresh={() => getOffers()}
                    />
                ) : (
                    <Button
                        title={localeString('views.Offers.noOffers')}
                        icon={{
                            name: 'error-outline',
                            size: 25,
                            color: themeColor('text')
                        }}
                        onPress={() => getOffers()}
                        buttonStyle={{
                            backgroundColor: 'transparent',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }}
                    />
                )}
            </View>
        );
    }
}
