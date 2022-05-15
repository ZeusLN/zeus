import React, { Component } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    I18nManager
} from 'react-native';

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
import Wallet from './../../assets/images/SVG/Wallet Account.svg';

interface LayerBalancesProps {
    BalanceStore: BalanceStore;
    UnitsStore: UnitsStore;
    navigation: any;
    onRefresh?: any;
    consolidated?: boolean;
}

//  To toggle LTR/RTL change to `true`
I18nManager.allowRTL(false);

type DataRow = {
    layer: string;
    balance: string | number;
};

const Row = ({ item }: { item: DataRow }) => {
    const moreAccounts = item.layer === 'More accounts';
    return (
        <RectButton
            style={
                !moreAccounts
                    ? {
                          ...styles.rectButton,
                          backgroundColor: themeColor('secondary')
                      }
                    : {
                          ...styles.moreButton,
                          backgroundColor: themeColor('secondary')
                      }
            }
        >
            <View style={styles.left}>
                {item.layer === 'On-chain' ? (
                    <OnChain />
                ) : item.layer === 'Lightning' ? (
                    <Lightning />
                ) : moreAccounts ? null : (
                    <Wallet />
                )}
                <Spacer width={5} />
                <Text
                    style={{ ...styles.layerText, color: themeColor('text') }}
                >
                    {item.layer}
                </Text>
            </View>

            {item.layer !== 'More accounts' ? (
                <Amount sats={item.balance} sensitive />
            ) : (
                <Text
                    style={{ ...styles.layerText, color: themeColor('text') }}
                >
                    {`+${item.count - 1}`}
                </Text>
            )}
        </RectButton>
    );
};

const SwipeableRow = ({
    item,
    index,
    navigation
}: {
    item: DataRow;
    index: number;
    navigation: any;
}) => {
    if (index === 0) {
        return (
            <LightningSwipeableRow navigation={navigation}>
                <Row item={item} />
            </LightningSwipeableRow>
        );
    }

    if (item.layer === 'More accounts') {
        return (
            <TouchableOpacity onPress={() => navigation.navigate('Accounts')}>
                <Row item={item} />
            </TouchableOpacity>
        );
    }

    return (
        <OnchainSwipeableRow navigation={navigation} account={item.layer}>
            <Row item={item} />
        </OnchainSwipeableRow>
    );
};

@inject()
@observer
export default class LayerBalances extends Component<LayerBalancesProps, {}> {
    render() {
        const { BalanceStore, navigation, onRefresh, consolidated } =
            this.props;

        const { totalBlockchainBalance, lightningBalance, otherAccounts } =
            BalanceStore;

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

        if (Object.keys(otherAccounts).length > 0 && !consolidated) {
            for (const key in otherAccounts) {
                DATA.push({
                    layer: key,
                    balance: otherAccounts[key].confirmed_balance
                });
            }
        }

        if (Object.keys(otherAccounts).length > 0 && consolidated) {
            let n = 0;
            for (const key in otherAccounts) {
                while (n < 1) {
                    DATA.push({
                        layer: key,
                        balance: otherAccounts[key].confirmed_balance
                    });
                    n++;
                }
            }
        }

        if (Object.keys(otherAccounts).length > 1 && consolidated) {
            DATA.push({
                layer: 'More accounts',
                count: Object.keys(otherAccounts).length
            });
        }

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
                style={{ marginTop: 20 }}
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
    moreButton: {
        height: 40,
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
