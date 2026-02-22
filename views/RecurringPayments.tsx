
import React, { Component } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Alert
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Icon } from '@rneui/themed';
import Screen from '../components/Screen';
import Header from '../components/Header';
import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';
import RecurringPaymentsStore from '../stores/RecurringPaymentsStore';
import RecurringPayment from '../models/RecurringPayment';


interface RecurringPaymentsProps {
    navigation: any;
    RecurringPaymentsStore: RecurringPaymentsStore;
}

@inject('RecurringPaymentsStore')
@observer
export default class RecurringPayments extends Component<RecurringPaymentsProps> {

    componentDidMount() {
        this.props.RecurringPaymentsStore.processDuePayments();
    }

    onAddPress = () => {
        // Placeholder for Add Modal logic
        // Ideally navigating to a 'AddRecurringPayment' screen or showing a modal
        Alert.alert('Coming Soon', 'Add Recurring Payment feature is under construction.');
        // Temporary test
        this.props.RecurringPaymentsStore.addPayment(
            'Test Payment',
            'test@test.com',
            1,
            'SATS',
            'DAILY'
        );
    };

    renderItem = ({ item }: { item: RecurringPayment }) => {
        return (
            <View style={styles.itemContainer}>
                <View style={styles.itemDetails}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemDest}>{item.destination}</Text>
                    <Text style={styles.itemAmount}>{item.amount} {item.currency} / {item.interval}</Text>
                    <Text style={styles.itemNext}>Next: {new Date(item.nextPaymentAt).toLocaleDateString()}</Text>
                </View>
                <TouchableOpacity onPress={() => this.props.RecurringPaymentsStore.togglePayment(item.id)}>
                    <Icon
                        name={item.active ? 'toggle-on' : 'toggle-off'}
                        type="font-awesome"
                        color={item.active ? themeColor('primary') : themeColor('secondaryText')}
                        size={30}
                    />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => this.props.RecurringPaymentsStore.removePayment(item.id)}>
                    <Icon
                        name="trash"
                        type="font-awesome"
                        color={themeColor('error')}
                        size={24}
                        style={{ marginLeft: 15 }}
                    />
                </TouchableOpacity>
            </View>
        );
    };

    render() {
        const { recurringPayments } = this.props.RecurringPaymentsStore;

        return (
            <Screen>
                <Header
                    centerComponent={{
                        text: localeString('recurring.title') || 'Recurring Payments',
                        style: { color: themeColor('text'), fontSize: 20, fontWeight: 'bold' }
                    }}
                    navigation={this.props.navigation}
                    leftComponent="Back"
                />
                <FlatList
                    data={recurringPayments}
                    renderItem={this.renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No recurring payments setup.</Text>
                        </View>
                    }
                />
                <TouchableOpacity
                    style={styles.fab}
                    onPress={this.onAddPress}
                >
                    <Icon name="plus" type="font-awesome" color="white" />
                </TouchableOpacity>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    listContainer: {
        padding: 20
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        marginBottom: 10,
        backgroundColor: themeColor('surface') || '#333',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#333'
    },
    itemDetails: {
        flex: 1
    },
    itemName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: themeColor('text') || 'white'
    },
    itemDest: {
        fontSize: 14,
        color: themeColor('secondaryText') || '#aaa',
        marginBottom: 5
    },
    itemAmount: {
        fontSize: 16,
        color: themeColor('text') || 'white'
    },
    itemNext: {
        fontSize: 12,
        color: themeColor('secondaryText') || '#888',
        marginTop: 5
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 50
    },
    emptyText: {
        color: themeColor('secondaryText') || '#888',
        fontSize: 16
    },
    fab: {
        position: 'absolute',
        width: 56,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        right: 20,
        bottom: 20,
        backgroundColor: themeColor('primary') || '#ff9900',
        borderRadius: 28,
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
    }
});
