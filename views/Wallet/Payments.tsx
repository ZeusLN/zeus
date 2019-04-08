import * as React from 'react';
import { StyleSheet, View, FlatList } from 'react-native';
import { Avatar, Button, ListItem } from 'react-native-elements';
import Payment from './../../models/Payment';
import DateTimeUtils from './../../utils/DateTimeUtils';
import { inject, observer } from 'mobx-react';

import PaymentsStore from './../../stores/PaymentsStore';
import UnitsStore from './../../stores/UnitsStore';
import SettingsStore from './../../stores/SettingsStore';

const RemoveBalance = require('./../../images/lightning-red.png');
const RemoveBalanceDark = require('./../../images/lightning-red-black.png');

interface PaymentsProps {
    navigation: any;
    payments: Array<Payment>;
    refresh: any;
    PaymentsStore: PaymentsStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

@inject('UnitsStore', 'SettingsStore')
@observer
export default class PaymentsView extends React.Component<PaymentsProps, {}> {
    renderSeparator = () => {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const { theme } = settings;

        return (
            <View style={theme === 'dark' ? styles.darkSeparator : styles.lightSeparator} />
        )
    }

    render() {
        const { payments, navigation, refresh, PaymentsStore, UnitsStore, SettingsStore } = this.props;
        const { getAmount, units } = UnitsStore;
        const { loading } = PaymentsStore;
        const { settings } = SettingsStore;
        const { theme } = settings;

        const Balance = (balanceImage: any) => (
            <Avatar
                source={balanceImage}
            />
        );

        return (
            <View style={theme === 'dark' ? styles.darkThemeStyle : styles.lightThemeStyle}>
                {(!!payments && payments.length > 0) || loading  ? <FlatList
                    data={payments}
                    renderItem={({ item }: any) => (
                        <ListItem
                            key={item.payment_hash}
                            title={units && getAmount(item.value)}
                            subtitle={DateTimeUtils.listFormattedDate(item.creation_date)}
                            containerStyle={{
                                borderBottomWidth: 0,
                                backgroundColor: theme === 'dark' ? 'black' : 'white'
                            }}
                            leftElement={theme === 'dark' ? Balance(RemoveBalanceDark) : Balance(RemoveBalance)}
                            onPress={() => navigation.navigate('Payment', { payment: item })}
                            titleStyle={{ color: theme === 'dark' ? 'white' : 'black' }}
                            subtitleStyle={{ color: theme === 'dark' ? 'gray' : '#8a8999' }}
                        />
                    )}
                    keyExtractor={item => item.payment_hash}
                    ItemSeparatorComponent={this.renderSeparator}
                    onEndReachedThreshold={50}
                    refreshing={loading}
                    onRefresh={() => refresh()}
                /> : <Button
                    title="No Payments"
                    icon={{
                        name: "error-outline",
                        size: 25,
                        color: theme === 'dark' ? 'white' : 'black'
                    }}
                    onPress={() => refresh()}
                    buttonStyle={{
                        backgroundColor: "transparent",
                        borderRadius: 30
                    }}
                    titleStyle={{
                        color: theme === 'dark' ? 'white' : 'black'
                    }}
                />}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        flex: 1
    },
    darkThemeStyle: {
        flex: 1,
        backgroundColor: 'black',
        color: 'white'
    },
    lightSeparator: {
        height: 1,
        width: "86%",
        backgroundColor: "#CED0CE",
        marginLeft: "14%"
    },
    darkSeparator: {
        height: 1,
        width: "86%",
        backgroundColor: "darkgray",
        marginLeft: "14%"
    }
});