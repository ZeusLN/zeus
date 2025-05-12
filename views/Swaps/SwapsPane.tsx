import React from 'react';
import { Text, TouchableOpacity, View, FlatList } from 'react-native';

import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import moment from 'moment';

import { WarningMessage } from '../../components/SuccessErrorMessage';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import Amount from '../../components/Amount';
import LoadingIndicator from '../../components/LoadingIndicator';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import SwapStore from '../../stores/SwapStore';
import SettingsStore from '../../stores/SettingsStore';
import NodeInfoStore from '../../stores/NodeInfoStore';

interface SwapsPaneProps {
    navigation: StackNavigationProp<any, any>;
    SwapStore?: SwapStore;
    SettingsStore?: SettingsStore;
    NodeInfoStore?: NodeInfoStore;
}

@inject('SwapStore', 'SettingsStore', 'NodeInfoStore')
@observer
export default class SwapsPane extends React.Component<SwapsPaneProps, {}> {
    componentDidMount() {
        const { navigation, SwapStore } = this.props;

        navigation.addListener('focus', async () => {
            SwapStore?.fetchAndUpdateSwaps();
        });
    }

    handleSwapPress = (swap: any) => {
        const { navigation } = this.props;
        const { keys, invoice } = swap;
        navigation.navigate('SwapDetails', {
            swapData: swap,
            keys,
            endpoint: swap.endpoint,
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
                        {`${localeString('general.type')} `}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('secondaryText'),
                            fontSize: 16
                        }}
                    >
                        {item?.type}
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
                        {`${localeString('views.Channel.status')}`}
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
                        {`${localeString('views.SwapDetails.swapId')}`}
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
                        {item?.type === 'Submarine'
                            ? `${localeString(
                                  'views.SwapDetails.expectedAmount'
                              )}`
                            : `${localeString(
                                  'views.SwapDetails.onchainAmount'
                              )}`}
                    </Text>
                    <Amount
                        sats={
                            item?.type === 'Submarine'
                                ? item.expectedAmount
                                : item.onchainAmount
                        }
                        sensitive
                        toggleable
                    />
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
                            {`${localeString('general.createdAt')}`}
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
        const { navigation, SwapStore } = this.props;

        const { swaps, swapsLoading } = SwapStore!;

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

                {swapsLoading ? (
                    <LoadingIndicator />
                ) : swaps.length === 0 ? (
                    <View style={{ paddingHorizontal: 15 }}>
                        <WarningMessage
                            message={localeString(
                                'views.Swaps.SwapsPane.noSwaps'
                            )}
                        />
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
