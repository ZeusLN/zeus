import * as React from 'react';
import { View, TouchableHighlight } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import BigNumber from 'bignumber.js';

import Button from '../../components/Button';
import { Row } from '../../components/layout/Row';
import OrderItem from './OrderItem';
import { SATS_PER_BTC } from '../../utils/UnitsUtils';

interface SwipeableOrderItemProps {
    item: any;
    navigation: any;
    fiatStore: any;
    onClickPaid: () => void;
    onClickHide: () => void;
    onSwipeableOpen: () => void;
}

const SwipeableOrderItem = React.forwardRef<Swipeable, SwipeableOrderItemProps>(
    (
        {
            item,
            navigation,
            fiatStore,
            onClickPaid,
            onClickHide,
            onSwipeableOpen
        },
        ref
    ) => {
        const { getRate, getSymbol } = fiatStore;
        const isPaid = !!item.payment;

        let tip = '';
        if (isPaid && item.payment?.orderTip) {
            const { orderTip, rate } = item.payment;
            tip = new BigNumber(orderTip)
                .multipliedBy(rate)
                .dividedBy(SATS_PER_BTC)
                .toFixed(2);
        }

        const renderRightActions = () => (
            <View
                style={{
                    margin: 0,
                    alignContent: 'center',
                    justifyContent: 'center',
                    width: 280,
                    marginVertical: 5
                }}
            >
                <Row>
                    <View style={{ flex: 1 }}>
                        <Button
                            onPress={onClickPaid}
                            icon={{ name: 'payments', size: 25 }}
                            containerStyle={{
                                backgroundColor: 'green',
                                height: '100%'
                            }}
                            iconOnly
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Button
                            onPress={onClickHide}
                            icon={{ name: 'delete', size: 25 }}
                            containerStyle={{
                                backgroundColor: 'red',
                                height: '100%'
                            }}
                            iconOnly
                        />
                    </View>
                </Row>
            </View>
        );

        return (
            <Swipeable
                ref={ref}
                onSwipeableOpen={onSwipeableOpen}
                renderRightActions={renderRightActions}
            >
                <TouchableHighlight
                    onPress={() => {
                        if (getRate() === '$N/A') return;
                        navigation.navigate('Order', { order: item });
                    }}
                >
                    <OrderItem
                        title={item.getItemsList}
                        money={
                            isPaid
                                ? `${item.getTotalMoneyDisplay} + ${
                                      getSymbol().symbol
                                  }${tip}`
                                : item.getTotalMoneyDisplay
                        }
                        date={item.getDisplayTime}
                    />
                </TouchableHighlight>
            </Swipeable>
        );
    }
);

export default SwipeableOrderItem;
