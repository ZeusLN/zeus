import React, { Component } from 'react';
import { FlatList, StyleSheet, Text, View, I18nManager } from 'react-native';

import { RectButton } from 'react-native-gesture-handler';

import { inject, observer } from 'mobx-react';
import { Amount } from '../Amount';
import { Spacer } from '../layout/Spacer';
import OnchainSwipeableRow from './OnchainSwipeableRow';
import LightningSwipeableRow from './LightningSwipeableRow';

import BalanceStore from './../../stores/BalanceStore';
import UnitsStore from './../../stores/UnitsStore';

import { themeColor } from './../../utils/ThemeUtils';

import OnChain from './../../assets/images/SVG/OnChain.svg';
import Lightning from './../../assets/images/SVG/Lightning.svg';

interface LayerBalancesProps {
    BalanceStore: BalanceStore;
    UnitsStore: UnitsStore;
    navigation: any;
    onRefresh?: any;
}

//  To toggle LTR/RTL change to `true`
I18nManager.allowRTL(false);

type DataRow = {
    layer: string;
    balance: string | number;
};

const Row = ({ item }: { item: DataRow }) => (
    <RectButton
        style={{
            ...styles.rectButton,
            backgroundColor: themeColor('secondary')
        }}
    >
        <View style={styles.left}>
            {item.layer === 'On-chain' ? <OnChain /> : <Lightning />}
            <Spacer width={5} />
            <Text style={{ ...styles.layerText, color: themeColor('text') }}>
                {item.layer}
            </Text>
        </View>

        <Amount sats={item.balance} sensitive />
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

@inject()
@observer
export default class LayerBalances extends Component<LayerBalancesProps, {}> {
    render() {
        const { BalanceStore, navigation, onRefresh } = this.props;

        const { totalBlockchainBalance, lightningBalance } = BalanceStore;

        const DATA: DataRow[] = [
            {
                layer: 'Lightning',
                balance: lightningBalance
            },
            {
                layer: 'On-chain',
                balance: totalBlockchainBalance
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
                onRefresh={() => onRefresh()}
                refreshing={false}
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
        alignItems: 'center',
        flexDirection: 'row',
        marginLeft: 15,
        marginRight: 15,
        borderRadius: 15
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start'
    },
    separator: {
        backgroundColor: 'transparent',
        height: 20
    },
    layerText: {
        backgroundColor: 'transparent',
        fontSize: 15,
        fontFamily: 'Lato-Bold'
    }
});
