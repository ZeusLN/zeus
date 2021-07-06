import * as React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { Avatar, Button, Header, Icon, ListItem } from 'react-native-elements';
import Channel from './../models/Channel';
import { inject, observer } from 'mobx-react';
const hash = require('object-hash');
import DateTimeUtils from './../utils/DateTimeUtils';
import PrivacyUtils from './../utils/PrivacyUtils';
import { localeString } from './../utils/LocaleUtils';

import ActivityStore from './../stores/ActivityStore';
import UnitsStore from './../stores/UnitsStore';
import SettingsStore from './../stores/SettingsStore';

interface ChannelsProps {
    navigation: any;
    refresh: any;
    ActivityStore: ActivityStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

@inject('ActivityStore', 'UnitsStore', 'SettingsStore')
@observer
export default class Channels extends React.Component<ChannelsProps, {}> {
    async UNSAFE_componentWillMount() {
        const { ActivityStore } = this.props;
        const { refresh } = ActivityStore;
        refresh();
    }

    renderSeparator = () => {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const { theme } = settings;

        return (
            <View
                style={
                    theme === 'dark'
                        ? styles.darkSeparator
                        : styles.lightSeparator
                }
            />
        );
    };

    render() {
        const {
            navigation,
            ActivityStore,
            UnitsStore,
            SettingsStore
        } = this.props;
        const { getAmount, units } = UnitsStore;
        const { loading, activity, refresh } = ActivityStore;
        const { settings } = SettingsStore;
        const { theme, lurkerMode } = settings;

        const CloseButton = () => (
            <Icon
                name="close"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        const FilterButton = () => (
            <Icon
                name="filter-alt"
                onPress={() => navigation.navigate('Filter')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View
                style={
                    theme === 'dark'
                        ? styles.darkThemeStyle
                        : styles.lightThemeStyle
                }
            >
                <Header
                    leftComponent={<CloseButton />}
                    centerComponent={{
                        text: localeString('general.activity'),
                        style: { color: '#fff' }
                    }}
                    rightComponent={<FilterButton />}
                    backgroundColor="#1f2328"
                />
                {loading ? (
                    <View style={{ padding: 50 }}>
                        <ActivityIndicator size="large" color="#0000ff" />
                    </View>
                ) : !!activity && activity.length > 0 ? (
                    <FlatList
                        data={activity}
                        renderItem={({ item }) => {
                            let displayName = item.model;
                            let subTitle = item.model;
                            let rightTitle = ' ';
                            if (item.model === 'Invoice') {
                                // TODO: add strings to en
                                displayName = item.isPaid
                                    ? 'You received'
                                    : 'Requested Payment';
                                subTitle = item.isPaid
                                    ? 'Lightning'
                                    : `Lightning Invoice: ${item.expirationDate}`;
                                rightTitle = PrivacyUtils.sensitiveValue(
                                    getAmount(item.getAmount),
                                    null,
                                    true
                                );
                            }

                            if (item.model === 'Payment') {
                                // TODO: add strings to en
                                displayName = 'You sent';
                                subTitle = 'Lightning';
                                rightTitle = PrivacyUtils.sensitiveValue(
                                    getAmount(item.getAmount),
                                    null,
                                    true
                                );
                            }

                            if (item.model === 'Transaction') {
                                // TODO: add strings to en
                                displayName = !item.getAmount.includes('-')
                                    ? 'You received'
                                    : 'You sent';
                                subTitle =
                                    item.num_confirmations == 0
                                        ? 'On-chain: Unconfirmed'
                                        : 'On-chain';
                                rightTitle = PrivacyUtils.sensitiveValue(
                                    getAmount(item.getAmount),
                                    null,
                                    true
                                );
                            }

                            return (
                                <React.Fragment>
                                    <ListItem
                                        title={displayName}
                                        subtitle={subTitle}
                                        rightTitle={rightTitle}
                                        rightSubtitle={DateTimeUtils.listFormattedDateShort(
                                            item.getTimestamp
                                        )}
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor:
                                                theme === 'dark'
                                                    ? '#1f2328'
                                                    : 'white'
                                        }}
                                        onPress={() => {
                                            if (item.model === 'Invoice') {
                                                navigation.navigate('Invoice', {
                                                    invoice: item
                                                });
                                            }

                                            if (item.model === 'Transaction') {
                                                navigation.navigate(
                                                    'Transaction',
                                                    {
                                                        transaction: item
                                                    }
                                                );
                                            }

                                            if (item.model === 'Payment') {
                                                navigation.navigate('Payment', {
                                                    payment: item
                                                });
                                            }
                                        }}
                                        titleStyle={{
                                            color:
                                                theme === 'dark'
                                                    ? 'white'
                                                    : '#1f2328'
                                        }}
                                        subtitleStyle={{
                                            color:
                                                theme === 'dark'
                                                    ? 'gray'
                                                    : '#8a8999'
                                        }}
                                        rightTitleStyle={{
                                            fontWeight: '600',
                                            color:
                                                item.model === 'Transaction' &&
                                                item.getAmount.includes('-')
                                                    ? 'red'
                                                    : item.model ===
                                                          'Transaction' &&
                                                      !item.getAmount.includes(
                                                          '-'
                                                      )
                                                    ? 'green'
                                                    : item.model === 'Payment'
                                                    ? 'red'
                                                    : item.isPaid
                                                    ? 'green'
                                                    : theme === 'dark'
                                                    ? 'gray'
                                                    : '#8a8999'
                                        }}
                                        rightSubtitleStyle={{
                                            color:
                                                theme === 'dark'
                                                    ? 'gray'
                                                    : '#8a8999'
                                        }}
                                    />
                                </React.Fragment>
                            );
                        }}
                        keyExtractor={(item, index) => `${item.model}-${index}`}
                        ItemSeparatorComponent={this.renderSeparator}
                        onEndReachedThreshold={50}
                        refreshing={loading}
                        onRefresh={() => refresh()}
                    />
                ) : (
                    <Button
                        title={localeString('views.Activity.noActivity')}
                        icon={{
                            name: 'error-outline',
                            size: 25,
                            color: theme === 'dark' ? 'white' : '#1f2328'
                        }}
                        onPress={() => refresh()}
                        buttonStyle={{
                            backgroundColor: 'transparent',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: theme === 'dark' ? 'white' : '#1f2328'
                        }}
                    />
                )}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        flex: 1,
        backgroundColor: 'white'
    },
    darkThemeStyle: {
        flex: 1,
        backgroundColor: '#1f2328',
        color: 'white'
    },
    lightSeparator: {
        height: 0.4,
        backgroundColor: '#CED0CE'
    },
    darkSeparator: {
        height: 0.4,
        backgroundColor: 'darkgray'
    },
    button: {
        paddingTop: 15,
        paddingBottom: 10
    }
});
