import * as React from 'react';
import { StyleSheet, View, FlatList } from 'react-native';
import { Avatar, Button, ListItem } from 'react-native-elements';
import DateTimeUtils from './../../utils/DateTimeUtils';
import Invoice from './../../models/Invoice';
import { inject, observer } from 'mobx-react';

import InvoicesStore from './../../stores/InvoicesStore';
import UnitsStore from './../../stores/UnitsStore';
import SettingsStore from './../../stores/SettingsStore';

const AddBalance = require('./../../images/lightning-green.png');
const AddBalancePending = require('./../../images/lightning-green-pending.png');

const AddBalanceDark = require('./../../images/lightning-green-black.png');
const AddBalancePendingDark = require('./../../images/lightning-green-pending-black.png');

interface InvoicesProps {
    invoices: Array<Invoice>;
    navigation: any;
    refresh: any;
    InvoicesStore: InvoicesStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

@inject('UnitsStore', 'SettingsStore')
@observer
export default class InvoicesView extends React.Component<InvoicesProps, {}> {
    renderSeparator = () => {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const { theme } = settings;

        return (
            <View style={theme === 'dark' ? styles.darkSeparator : styles.lightSeparator} />
        )
    }

    render() {
        const { invoices, navigation, refresh, InvoicesStore, UnitsStore, SettingsStore } = this.props;
        const { getAmount, units } = UnitsStore;
        const { loading } = InvoicesStore;
        const { settings } = SettingsStore;
        const { theme } = settings;

        const InvoiceImage = (settled: boolean) => {
            const { SettingsStore } = this.props;
            const { settings } = SettingsStore;
            const { theme } = settings;

            let avatar;
            if (settled) {
                avatar = theme === 'dark' ? AddBalanceDark : AddBalance;
            } else {
                avatar = theme === 'dark' ? AddBalancePendingDark : AddBalancePending;
            }

            return avatar;
        }

        const Invoice = (settled: boolean) => (
            <Avatar
                source={InvoiceImage(settled)}
            />
        );

        return (
            <View style={theme === 'dark' ? styles.darkThemeStyle : styles.lightThemeStyle}>
                {(!!invoices && invoices.length > 0) || loading  ? <FlatList
                    data={invoices}
                    renderItem={({ item }) => {
                        const { settled } = item;
                        return (
                            <ListItem
                                key={item.r_hash}
                                title={item.memo || "No memo"}
                                subtitle={`${settled ? 'Paid' : 'Unpaid'}: ${units && getAmount(item.value)} | ${settled ? DateTimeUtils.listFormattedDate(item.settle_date) : DateTimeUtils.listFormattedDate(item.creation_date)}`}
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: theme === 'dark' ? 'black' : 'white'
                                }}
                                leftElement={Invoice(item.settled)}
                                onPress={() => navigation.navigate('Invoice', { invoice: item })}
                                titleStyle={{ color: theme === 'dark' ? 'white' : 'black' }}
                                subtitleStyle={{ color: theme === 'dark' ? 'gray' : '#8a8999' }}
                            />
                        );
                    }}
                    keyExtractor={item => item.r_hash}
                    ItemSeparatorComponent={this.renderSeparator}
                    onEndReachedThreshold={50}
                    refreshing={loading}
                    onRefresh={() => refresh()}
                /> : <Button
                    title="No Invoices"
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