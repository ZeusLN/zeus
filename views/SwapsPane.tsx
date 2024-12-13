import React from 'react';
import { Text, TouchableOpacity, View, FlatList } from 'react-native';

import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import EncryptedStorage from 'react-native-encrypted-storage';
import moment from 'moment';

import {
    ErrorMessage,
    WarningMessage
} from '../components/SuccessErrorMessage';
import Screen from '../components/Screen';
import Header from '../components/Header';
import Amount from '../components/Amount';
import LoadingIndicator from '../components/LoadingIndicator';

import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';

import SwapStore, { HOST } from '../stores/SwapStore';

interface SwapsPaneProps {
    navigation: StackNavigationProp<any, any>;
    SwapStore?: SwapStore;
}

interface SwapsPaneState {
    swaps: Array<any>;
    error: string | null;
    loading: boolean;
}

@inject('TransactionsStore', 'SwapStore')
@observer
export default class SwapsPane extends React.Component<
    SwapsPaneProps,
    SwapsPaneState
> {
    constructor(props: SwapsPaneProps) {
        super(props);
        this.state = {
            swaps: [],
            error: null,
            loading: false
        };
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.addListener('focus', async () => {
            this.fetchSwaps();
        });
    }

    fetchSwaps = async () => {
        this.setState({ loading: true });
        try {
            const storedSwaps = await EncryptedStorage.getItem('swaps');
            const swaps = storedSwaps ? JSON.parse(storedSwaps) : [];
            this.setState({ swaps, loading: false });
            console.log('All Swaps:', swaps);
        } catch (error) {
            this.setState({ error: 'Failed to load swaps' });
            console.error('Error retrieving swaps:', error);
        }
    };

    handleSwapPress = (swap: any) => {
        const { navigation } = this.props;
        const { keys, invoice } = swap;
        navigation.navigate('SwapDetails', {
            swapData: swap,
            keys,
            endpoint: HOST,
            invoice
        });
    };

    renderSeparator = () => (
        <View
            style={{
                height: 0.4,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    renderSwap = ({ item }: { item: any }) => {
        const { SwapStore } = this.props;

        return (
            <TouchableOpacity
                key={item.id}
                style={{ padding: 16 }}
                onPress={() => this.handleSwapPress(item)}
            >
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: 5
                    }}
                >
                    <Text style={{ color: themeColor('text'), fontSize: 16 }}>
                        {`${localeString('views.Channel.status')}:`}
                    </Text>
                    <Text
                        style={{
                            color: SwapStore?.statusColor(item.status),
                            fontSize: 16
                        }}
                    >
                        {SwapStore?.formatStatus(item.status)}
                    </Text>
                </View>
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: 5
                    }}
                >
                    <Text style={{ color: themeColor('text'), fontSize: 16 }}>
                        {`${localeString('views.SwapDetails.swapId')}:`}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('secondaryText'),
                            fontSize: 16
                        }}
                    >
                        {item.id}
                    </Text>
                </View>

                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: 5
                    }}
                >
                    <Text style={{ color: themeColor('text'), fontSize: 16 }}>
                        {`${localeString('views.SwapDetails.expectedAmount')}:`}
                    </Text>
                    <Amount sats={item.expectedAmount} sensitive toggleable />
                </View>
                {item?.createdAt && (
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            marginBottom: 5
                        }}
                    >
                        <Text
                            style={{ color: themeColor('text'), fontSize: 16 }}
                        >
                            {`${localeString('general.createdAt')}:`}
                        </Text>
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontSize: 16
                            }}
                        >
                            {moment(item.createdAt).format(
                                'MMM Do YYYY, h:mm:ss a'
                            )}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    render() {
        const { navigation } = this.props;
        const { swaps, error, loading } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Swaps.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />

                {error && <ErrorMessage message={error} />}
                {loading ? (
                    <LoadingIndicator />
                ) : swaps.length === 0 && !error ? (
                    <View style={{ paddingHorizontal: 15 }}>
                        <WarningMessage message="No Swaps Available" />
                    </View>
                ) : (
                    <FlatList
                        data={swaps}
                        keyExtractor={(item) => item.id}
                        renderItem={this.renderSwap}
                        ItemSeparatorComponent={this.renderSeparator}
                    />
                )}
            </Screen>
        );
    }
}
