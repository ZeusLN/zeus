import * as React from 'react';
import { TouchableHighlight, StyleSheet } from 'react-native';
import Animated, {
    Extrapolation,
    interpolate,
    SharedValue,
    useAnimatedStyle
} from 'react-native-reanimated';
import ReanimatedSwipeable, {
    SwipeableMethods
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import BigNumber from 'bignumber.js';

import Button from '../../components/Button';
import OrderItem from './OrderItem';
import { SATS_PER_BTC } from '../../utils/UnitsUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Order from '../../models/Order';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FiatStore from '../../stores/FiatStore';

interface SwipeableOrderItemProps {
    item: Order;
    navigation: NativeStackNavigationProp<any, any>;
    fiatStore?: FiatStore;
    onClickPaid: () => void;
    onClickHide: () => void;
    onSwipeableOpen: () => void;
}
const RightActions = ({
    translation,
    onClickPaid,
    onClickHide
}: {
    translation: SharedValue<number>;
    onClickPaid: () => void;
    onClickHide: () => void;
}) => {
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            {
                translateX: interpolate(
                    translation.value,
                    [-180, 0],
                    [0, 180],
                    Extrapolation.CLAMP
                )
            }
        ]
    }));
    return (
        <Animated.View style={[styles.rightActionsContainer, animatedStyle]}>
            <Button
                onPress={onClickPaid}
                icon={{
                    name: 'payments',
                    size: 25,
                    color: themeColor('text')
                }}
                containerStyle={styles.paidButton}
                iconOnly
            />
            <Button
                onPress={onClickHide}
                icon={{
                    name: 'delete',
                    size: 25,
                    color: themeColor('text')
                }}
                containerStyle={styles.deleteButton}
                iconOnly
            />
        </Animated.View>
    );
};

const SwipeableOrderItem = React.forwardRef<
    SwipeableMethods,
    SwipeableOrderItemProps
>(
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
        const { getRate, getSymbol } = fiatStore!;
        const isPaid = !!item.payment;

        let tip = '';
        if (isPaid && item.payment?.orderTip) {
            const { orderTip, rate } = item.payment;
            tip = new BigNumber(orderTip)
                .multipliedBy(rate)
                .dividedBy(SATS_PER_BTC)
                .toFixed(2);
        }

        const renderRightActions = (
            _progress: SharedValue<number>,
            translation: SharedValue<number>
        ) => (
            <RightActions
                translation={translation}
                onClickPaid={onClickPaid}
                onClickHide={onClickHide}
            />
        );

        return (
            <ReanimatedSwipeable
                ref={ref}
                onSwipeableOpen={onSwipeableOpen}
                renderRightActions={renderRightActions}
                containerStyle={styles.swipeableContainer}
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
            </ReanimatedSwipeable>
        );
    }
);

const styles = StyleSheet.create({
    swipeableContainer: {
        marginVertical: 5
    },
    rightActionsContainer: {
        width: 180,
        flexDirection: 'row'
    },
    paidButton: {
        flex: 1,
        backgroundColor: '#4CAF50',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 1
    },
    deleteButton: {
        flex: 1,
        backgroundColor: '#F44336',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center'
    }
});

export default SwipeableOrderItem;
