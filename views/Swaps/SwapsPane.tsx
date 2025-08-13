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
import Button from '../../components/Button';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import SwapStore from '../../stores/SwapStore';
import SettingsStore from '../../stores/SettingsStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import Swap from '../../models/Swap';

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

    handleSwapPress = (swap: Swap) => {
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

    renderSwap = ({ item }: { item: Swap }) => {
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
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: 16
                        }}
                    >
                        {`${localeString('general.type')} `}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('secondaryText'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: 16
                        }}
                    >
                        {item?.type}{' '}
                        {item?.type === 'Submarine' ? '🔗 → ⚡' : '⚡ → 🔗'}
                    </Text>
                </View>

                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: 5
                    }}
                >
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: 16
                        }}
                    >
                        {`${localeString('views.Channel.status')}`}
                    </Text>
                    <Text
                        style={{
                            color: SwapStore?.statusColor(item.status),
                            fontFamily: 'PPNeueMontreal-Book',
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
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: 16
                        }}
                    >
                        {`${localeString('views.SwapDetails.swapId')}`}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('secondaryText'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: 16
                        }}
                    >
                        {item.id}
                    </Text>
                </View>
                {(item.expectedAmount || item.isReverseSwap) && (
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            marginBottom: 5
                        }}
                    >
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 16
                            }}
                        >
                            {item?.isSubmarineSwap
                                ? `${localeString(
                                      'views.SwapDetails.expectedAmount'
                                  )}`
                                : `${localeString(
                                      'views.SwapDetails.onchainAmount'
                                  )}`}
                        </Text>
                        <Amount
                            sats={
                                item?.isSubmarineSwap
                                    ? item.expectedAmount
                                    : item.isReverseSwap
                                    ? item.getAmount
                                    : undefined
                            }
                            sensitive
                            toggleable
                        />
                    </View>
                )}

                {item?.createdAt && (
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            marginBottom: 5
                        }}
                    >
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 16
                            }}
                        >
                            {`${localeString('general.createdAt')}`}
                        </Text>
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 16
                            }}
                        >
                            {moment(item.createdAtFormatted).format(
                                'MMM Do YYYY, h:mm:ss a'
                            )}
                        </Text>
                    </View>
                )}
                {item?.imported && (
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            marginBottom: 5
                        }}
                    >
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 16
                            }}
                        >
                            {localeString('views.Swaps.SwapsPane.imported')}
                        </Text>
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 16
                            }}
                        >
                            {localeString('general.true')}
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
                {!swapsLoading && (
                    <Button
                        title={localeString(
                            'views.Swaps.SwapsPane.restoreSwaps'
                        )}
                        secondary
                        onPress={async () => {
                            navigation.navigate('SeedRecovery', {
                                restoreSwaps: true
                            });
                        }}
                        containerStyle={{ paddingTop: 8 }}
                    />
                )}
            </Screen>
        );
    }
}
