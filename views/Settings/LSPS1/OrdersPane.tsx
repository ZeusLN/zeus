import * as React from 'react';
import EncryptedStorage from 'react-native-encrypted-storage';
import moment from 'moment';
import { inject, observer } from 'mobx-react';
import { View, FlatList, TouchableOpacity, Text } from 'react-native';

import Header from '../../../components/Header';
import Screen from '../../../components/Screen';
import Amount from '../../../components/Amount';
import LoadingIndicator from '../../../components/LoadingIndicator';

import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';

import LSPStore from '../../../stores/LSPStore';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';

interface OrdersPaneProps {
    navigation: any;
    LSPStore: LSPStore;
}

interface OrdersPaneState {
    orders: any[];
    isLoading: boolean;
}

@inject('LSPStore')
@observer
export default class OrdersPane extends React.Component<
    OrdersPaneProps,
    OrdersPaneState
> {
    constructor(props: OrdersPaneProps) {
        super(props);
        this.state = {
            orders: [],
            isLoading: true
        };
    }

    componentDidMount() {
        const { navigation, LSPStore } = this.props;
        navigation.addListener('didFocus', async () => {
            // Retrieve saved responses from encrypted storage
            EncryptedStorage.getItem('orderResponses')

                .then((responseArrayString) => {
                    if (responseArrayString) {
                        const responseArray = JSON.parse(responseArrayString);
                        const decodedResponses = responseArray.map(
                            (response) => {
                                return JSON.parse(response);
                            }
                        );

                        // Extract required information from each order for display
                        const orders = decodedResponses.map((response) => ({
                            orderId:
                                response?.order?.result?.order_id ||
                                response?.order?.order_id,
                            state:
                                response?.order?.result?.order_state ||
                                response?.order?.order_state,
                            createdAt:
                                response?.order?.result?.created_at ||
                                response?.order?.created_at,
                            fundedAt:
                                response?.order?.result?.channel?.funded_at ||
                                response?.order?.channel?.funded_at,
                            lspBalanceSat:
                                response?.order?.result?.lsp_balance_sat ||
                                response?.order?.lsp_balance_sat
                        }));

                        const reversedOrders = orders.reverse();

                        this.setState({
                            orders: reversedOrders,
                            isLoading: false
                        });
                        LSPStore.error = false;
                        LSPStore.error_msg = '';
                    } else {
                        this.setState({ isLoading: false });
                        LSPStore.error = true;
                        LSPStore.error_msg = localeString(
                            'views.LSPS1.noOrdersError'
                        );
                    }
                })
                .catch((error) =>
                    console.error(
                        'Error retrieving saved responses from encrypted storage:',
                        error
                    )
                );
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

    renderItem = ({ item }: { item: any }) => {
        let stateColor;
        switch (item.state) {
            case 'CREATED':
                stateColor = 'orange';
                break;
            case 'FAILED':
                stateColor = 'red';
                break;
            case 'COMPLETED':
                stateColor = 'green';
                break;
            default:
                stateColor = themeColor('text');
                break;
        }

        return (
            <TouchableOpacity
                onPress={() =>
                    this.props.navigation.navigate('LSPS1Order', {
                        orderId: item.orderId
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
                        {localeString('views.LSPS1.lspBalance')}
                    </Text>
                    <Amount sats={item.lspBalanceSat} sensitive toggleable />
                </View>
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: 5
                    }}
                >
                    <Text style={{ color: themeColor('text'), fontSize: 16 }}>
                        {localeString('general.state')}
                    </Text>
                    <Text style={{ color: stateColor, fontSize: 16 }}>
                        {item.state}
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
                        {localeString('general.createdAt')}
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
                {item.fundedAt && (
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between'
                        }}
                    >
                        <Text
                            style={{ color: themeColor('text'), fontSize: 16 }}
                        >
                            {localeString('views.LSPS1.fundedAt')}
                        </Text>
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontSize: 16
                            }}
                        >
                            {moment(item.fundedAt).format(
                                'MMM Do YYYY, h:mm:ss a'
                            )}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    render() {
        const { navigation, LSPStore } = this.props;
        const { orders, isLoading } = this.state;

        return (
            <Screen>
                {isLoading ? (
                    <View style={{ marginTop: 50 }}>
                        <LoadingIndicator />
                    </View>
                ) : LSPStore.error && LSPStore.error_msg ? (
                    <>
                        <Header
                            leftComponent="Back"
                            onBack={() => {
                                LSPStore.error = false;
                                LSPStore.error_msg = '';
                            }}
                            navigation={navigation}
                        />
                        <ErrorMessage message={LSPStore.error_msg} />
                    </>
                ) : (
                    <>
                        <Header
                            leftComponent="Back"
                            centerComponent={{
                                text: `${localeString(
                                    'views.LSPS1.lsps1Orders'
                                )} (${orders.length})`,
                                style: {
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }
                            }}
                            navigation={navigation}
                        />
                        <FlatList
                            data={orders}
                            renderItem={this.renderItem}
                            keyExtractor={(item) => item.orderId.toString()}
                            ItemSeparatorComponent={this.renderSeparator}
                        />
                    </>
                )}
            </Screen>
        );
    }
}
