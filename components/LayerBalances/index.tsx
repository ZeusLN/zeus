import React, { Component } from 'react';
import { FlatList, StyleSheet, Text, View, I18nManager } from 'react-native';

import { RectButton } from 'react-native-gesture-handler';

import { inject, observer } from 'mobx-react';
import Amount from '../Amount';
import { Spacer } from '../layout/Spacer';
import OnchainSwipeableRow from './OnchainSwipeableRow';
import LightningSwipeableRow from './LightningSwipeableRow';

import BalanceStore from './../../stores/BalanceStore';
import UnitsStore from './../../stores/UnitsStore';

import BackendUtils from '../../utils/BackendUtils';
import { themeColor } from './../../utils/ThemeUtils';

import BlueWalletWarning from '../../components/BlueWalletWarning';

import OnChainSvg from '../../assets/images/SVG/DynamicSVG/OnChainSvg';
import LightningSvg from '../../assets/images/SVG/DynamicSVG/LightningSvg';
import { localeString } from '../../utils/LocaleUtils';

interface LayerBalancesProps {
    BalanceStore: BalanceStore;
    UnitsStore: UnitsStore;
    navigation: any;
    onRefresh?: any;
    value?: string;
    amount?: string;
    lightning?: string;
    locked?: boolean;
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
            {item.layer === 'On-chain' ? <OnChainSvg /> : <LightningSvg />}
            <Spacer width={5} />
            <Text style={{ ...styles.layerText, color: themeColor('text') }}>
                {item.layer === 'Lightning'
                    ? localeString('general.lightning')
                    : localeString('general.onchain')}
            </Text>
        </View>

        <Amount sats={item.balance} sensitive />
    </RectButton>
);

const SwipeableRow = ({
    item,
    index,
    navigation,
    value,
    amount,
    lightning,
    locked
}: {
    item: DataRow;
    index: number;
    navigation: any;
    selectMode: boolean;
    value?: string;
    amount?: string;
    lightning?: string;
    locked?: boolean;
}) => {
    if (index === 1) {
        return (
            <OnchainSwipeableRow
                navigation={navigation}
                value={value}
                amount={amount}
                locked={locked}
            >
                <Row item={item} />
            </OnchainSwipeableRow>
        );
    }

    return (
        <LightningSwipeableRow
            navigation={navigation}
            lightning={lightning}
            locked={locked}
        >
            <Row item={item} />
        </LightningSwipeableRow>
    );
};

@inject()
@observer
export default class LayerBalances extends Component<LayerBalancesProps, {}> {
    render() {
        const {
            BalanceStore,
            navigation,
            value,
            amount,
            lightning,
            onRefresh,
            locked
        } = this.props;

        const { totalBlockchainBalance, lightningBalance } = BalanceStore;

        let DATA: DataRow[] = [
            {
                layer: 'Lightning',
                balance: Number(lightningBalance).toFixed(3)
            }
        ];

        // Only show on-chain balance for non-Lnbank accounts
        if (BackendUtils.supportsOnchainReceiving()) {
            DATA.push({
                layer: 'On-chain',
                balance: Number(totalBlockchainBalance).toFixed(3)
            });
        }

        return (
            <>
                <BlueWalletWarning />
                <FlatList
                    data={DATA}
                    ItemSeparatorComponent={() => (
                        <View style={styles.separator} />
                    )}
                    renderItem={({ item, index }) => (
                        <SwipeableRow
                            item={item}
                            index={index}
                            navigation={navigation}
                            // select pay method vars
                            value={value}
                            amount={amount}
                            lightning={lightning}
                            locked={locked}
                        />
                    )}
                    keyExtractor={(_item, index) => `message ${index}`}
                    style={{ top: 20 }}
                    onRefresh={() => onRefresh()}
                    refreshing={false}
                />
            </>
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
