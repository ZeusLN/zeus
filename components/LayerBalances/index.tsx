import React, { Component } from 'react';
import { StyleSheet, Text, View, I18nManager, Alert } from 'react-native';

import { FlatList, RectButton } from 'react-native-gesture-handler';

import OnchainSwipeableRow from './OnchainSwipeableRow';
import LightningSwipeableRow from './LightningSwipeableRow';

import BalanceStore from './../../stores/BalanceStore';
import UnitsStore from './../../stores/UnitsStore';

import { themeColor } from './../../utils/ThemeUtils';

import { inject, observer } from 'mobx-react';

import OnChain from './../../images/SVG/OnChain.svg';
import Lightning from './../../images/SVG/Lightning Circle.svg';

interface LayerBalancesProps {
    BalanceStore: BalanceStore;
    UnitsStore: UnitsStore;
    navigation: any;
}

//  To toggle LTR/RTL change to `true`
I18nManager.allowRTL(false);

type DataRow = {
    layer: string;
    balance: string;
};

const Row = ({ item }: { item: DataRow }) => (
    <RectButton
        style={{
            ...styles.rectButton,
            backgroundColor: themeColor('secondary')
        }}
    >
        {item.layer === 'On-chain' ? (
            <OnChain style={{ top: 5 }} />
        ) : (
            <Lightning style={{ top: 5 }} />
        )}
        <Text style={{ ...styles.layerText, color: themeColor('text') }}>
            {item.layer}
        </Text>
        <Text
            style={{
                ...styles.balanceText,
                color: themeColor('secondaryText')
            }}
        >
            {item.balance}
        </Text>
    </RectButton>
);

const SwipeableRow = ({
    item,
    index,
    navigation
}: {
    item: DataRow;
    index: number;
    navigation: any;
}) => {
    if (index === 1) {
        return (
            <OnchainSwipeableRow navigation={navigation}>
                <Row item={item} />
            </OnchainSwipeableRow>
        );
    }

    return (
        <LightningSwipeableRow navigation={navigation}>
            <Row item={item} />
        </LightningSwipeableRow>
    );
};

@inject('UnitsStore')
@observer
export default class LayerBalances extends Component<LayerBalancesProps, {}> {
    render() {
        const { BalanceStore, UnitsStore, navigation } = this.props;

        const {
            totalBlockchainBalance,
            unconfirmedBlockchainBalance,
            lightningBalance,
            pendingOpenBalance
        } = BalanceStore;

        const { changeUnits, getAmount, units } = UnitsStore;

        const DATA: DataRow[] = [
            {
                layer: 'Lightning',
                balance: getAmount(lightningBalance)
            },
            {
                layer: 'On-chain',
                balance: getAmount(totalBlockchainBalance)
            }
        ];

        return (
            <FlatList
                data={DATA}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                renderItem={({ item, index }) => (
                    <SwipeableRow
                        item={item}
                        index={index}
                        navigation={navigation}
                    />
                )}
                keyExtractor={(_item, index) => `message ${index}`}
                style={{ top: 20 }}
            />
        );
    }
}

const styles = StyleSheet.create({
    rectButton: {
        height: 80,
        paddingVertical: 10,
        paddingHorizontal: 20,
        justifyContent: 'space-between',
        flexDirection: 'column',
        marginLeft: 15,
        marginRight: 15,
        borderRadius: 15
    },
    separator: {
        backgroundColor: 'transparent',
        height: 20
    },
    layerText: {
        backgroundColor: 'transparent',
        position: 'absolute',
        fontWeight: 'bold',
        fontSize: 15,
        top: 30,
        left: 75
    },
    balanceText: {
        backgroundColor: 'transparent',
        position: 'absolute',
        right: 20,
        top: 30,
        fontWeight: 'bold'
    }
});
