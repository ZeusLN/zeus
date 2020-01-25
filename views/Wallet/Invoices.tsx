import * as React from 'react';
import { StyleSheet, View, FlatList } from 'react-native';
import { Avatar, Button, ListItem } from 'react-native-elements';
import Invoice from './../../models/Invoice';
import { inject, observer } from 'mobx-react';
import PrivacyUtils from './../../utils/PrivacyUtils';

import InvoicesStore from './../../stores/InvoicesStore';
import UnitsStore from './../../stores/UnitsStore';
import SettingsStore from './../../stores/SettingsStore';

const AddBalance = require('./../../images/lightning-green.png');
const AddBalancePending = require('./../../images/lightning-green-pending.png');

const AddBalanceDark = require('./../../images/lightning-green-dark.png');
const AddBalancePendingDark = require('./../../images/lightning-green-pending-dark.png');

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
            invoices,
            navigation,
            refresh,
            InvoicesStore,
            UnitsStore,
            SettingsStore
        } = this.props;
        const { getAmount, units } = UnitsStore;
        const { loading } = InvoicesStore;
        const { settings } = SettingsStore;
        const { theme, lurkerMode } = settings;

        const InvoiceImage = (settled: boolean) => {
            let avatar;
            if (settled) {
                avatar = theme === 'dark' ? AddBalanceDark : AddBalance;
            } else {
                avatar =
                    theme === 'dark'
                        ? AddBalancePendingDark
                        : AddBalancePending;
            }

            return avatar;
        };

        const InvoiceIcon = (settled: boolean) => (
            <Avatar source={InvoiceImage(settled)} />
        );

        return (
            <View
                style={
                    theme === 'dark'
                        ? styles.darkThemeStyle
                        : styles.lightThemeStyle
                }
            >
                {(!!invoices && invoices.length > 0) || loading ? (
                    <FlatList
                        data={invoices}
                        renderItem={({ item }) => {
                            const { isPaid } = item;

                            const memo = lurkerMode
                                ? PrivacyUtils.hideValue(item.getMemo, 10)
                                : item.getMemo;

                            const invoiceAmount = lurkerMode
                                ? PrivacyUtils.hideValue(
                                      getAmount(item.getAmount),
                                      null,
                                      true
                                  )
                                : getAmount(item.getAmount);

                            const date = lurkerMode
                                ? PrivacyUtils.hideValue(item.listDate, 14)
                                : item.listDate;

                            return (
                                <ListItem
                                    title={memo}
                                    subtitle={`${
                                        isPaid ? 'Paid' : 'Unpaid'
                                    }: ${units && invoiceAmount} | ${date}`}
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor:
                                            theme === 'dark' ? 'black' : 'white'
                                    }}
                                    leftElement={InvoiceIcon(item.isPaid)}
                                    onPress={() =>
                                        navigation.navigate('Invoice', {
                                            invoice: item
                                        })
                                    }
                                    titleStyle={{
                                        color:
                                            theme === 'dark' ? 'white' : 'black'
                                    }}
                                    subtitleStyle={{
                                        color:
                                            theme === 'dark'
                                                ? 'gray'
                                                : '#8a8999'
                                    }}
                                />
                            );
                        }}
                        keyExtractor={(item, index) => `${item.key}-${index}`}
                        ItemSeparatorComponent={this.renderSeparator}
                        onEndReachedThreshold={50}
                        refreshing={loading}
                        onRefresh={() => refresh()}
                    />
                ) : (
                    <Button
                        title="No Invoices"
                        icon={{
                            name: 'error-outline',
                            size: 25,
                            color: theme === 'dark' ? 'white' : 'black'
                        }}
                        onPress={() => refresh()}
                        buttonStyle={{
                            backgroundColor: 'transparent',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: theme === 'dark' ? 'white' : 'black'
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
        backgroundColor: 'black',
        color: 'white'
    },
    lightSeparator: {
        height: 1,
        width: '86%',
        backgroundColor: '#CED0CE',
        marginLeft: '14%'
    },
    darkSeparator: {
        height: 1,
        width: '86%',
        backgroundColor: 'darkgray',
        marginLeft: '14%'
    }
});
