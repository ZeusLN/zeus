import * as React from 'react';
import { FlatList, Text, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { Spacer } from '../../components/layout/Spacer';
import SwipeableOrderItem from '../Wallet/SwipeableOrderItem';
import { themeColor } from '../../utils/ThemeUtils';
import Order from '../../models/Order';

interface OrderListProps {
    orders: Order[];
    loading: boolean;
    onRefresh: () => void;
    onHideOrder: (orderId: string) => void;
    onOrderClick: (order: Order) => void;
    navigation: any;
    fiatStore: any;
    emptyText: string;
}

export default class OrderList extends React.PureComponent<OrderListProps> {
    private rows: Array<Swipeable | null> = [];
    private prevOpenedRow: Swipeable | null = null;

    private closeRow = (index: number) => {
        if (this.prevOpenedRow && this.prevOpenedRow !== this.rows[index]) {
            this.prevOpenedRow.close();
        }
        this.prevOpenedRow = this.rows[index];
    };

    render() {
        const {
            orders,
            loading,
            onRefresh,
            onHideOrder,
            onOrderClick,
            navigation,
            fiatStore,
            emptyText
        } = this.props;

        if (!loading && orders && orders.length === 0) {
            return (
                <TouchableOpacity onPress={onRefresh}>
                    <Text
                        style={{
                            color: themeColor('text'),
                            margin: 10,
                            textAlign: 'center'
                        }}
                    >
                        {emptyText}
                    </Text>
                </TouchableOpacity>
            );
        }

        return (
            <FlatList
                data={orders}
                renderItem={({ item, index }) => (
                    <SwipeableOrderItem
                        ref={(ref: Swipeable | null) =>
                            (this.rows[index] = ref)
                        }
                        onSwipeableOpen={() => this.closeRow(index)}
                        item={item}
                        navigation={navigation}
                        fiatStore={fiatStore}
                        onClickPaid={() => onOrderClick(item)}
                        onClickHide={() => onHideOrder(item.id)}
                    />
                )}
                ListFooterComponent={<Spacer height={100} />}
                onRefresh={onRefresh}
                refreshing={loading}
                keyExtractor={(_, index) => `${index}`}
            />
        );
    }
}
