import React, { Component } from 'react';
import { FlatList, StyleSheet, Text, View, I18nManager } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { RectButton } from 'react-native-gesture-handler';
import { StackNavigationProp } from '@react-navigation/stack';

import { Spacer } from '../layout/Spacer';
import OnchainSwipeableRow from './OnchainSwipeableRow';
import LightningSwipeableRow from './LightningSwipeableRow';
import EcashSwipeableRow from './EcashSwipeableRow';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import OnChainSvg from '../../assets/images/SVG/DynamicSVG/OnChainSvg';
import LightningSvg from '../../assets/images/SVG/DynamicSVG/LightningSvg';
import EcashSvg from '../../assets/images/SVG/DynamicSVG/EcashSvg';

import stores from '../../stores/Stores';

interface PaymentMethodListProps {
    navigation: StackNavigationProp<any, any>;
    value?: string;
    amount?: string;
    lightning?: string;
    ecash?: string;
    offer?: string;
}

//  To toggle LTR/RTL change to `true`
I18nManager.allowRTL(false);

type DataRow = {
    layer: string;
    subtitle?: string;
    disabled?: boolean;
};

const Row = ({ item }: { item: DataRow }) => {
    return (
        <RectButton style={{ opacity: item.disabled ? 0.5 : 1 }}>
            <LinearGradient
                colors={
                    themeColor('buttonGradient')
                        ? themeColor('buttonGradient')
                        : themeColor('buttonBackground')
                        ? [
                              themeColor('buttonBackground'),
                              themeColor('buttonBackground')
                          ]
                        : [themeColor('secondary'), themeColor('secondary')]
                }
                style={styles.rectButton}
            >
                <View style={styles.left}>
                    {item.layer === 'On-chain' ? (
                        <OnChainSvg />
                    ) : item.layer === 'Lightning' || item.layer === 'Offer' ? (
                        <LightningSvg />
                    ) : item.layer === 'Lightning via ecash' ? (
                        <EcashSvg />
                    ) : (
                        <OnChainSvg />
                    )}
                    <Spacer width={5} />
                    <View
                        style={{
                            flexDirection: 'column'
                        }}
                    >
                        <Text
                            style={{
                                ...styles.layerText,
                                color:
                                    themeColor('buttonText') ||
                                    themeColor('text')
                            }}
                        >
                            {item.layer === 'Lightning'
                                ? localeString('general.lightning')
                                : item.layer === 'Lightning via ecash'
                                ? localeString(
                                      'components.LayerBalances.lightningViaEcash'
                                  )
                                : item.layer === 'Offer'
                                ? localeString('views.Settings.Bolt12Offer')
                                : item.layer === 'On-chain'
                                ? localeString('general.onchain')
                                : item.layer}
                        </Text>
                        {item.subtitle && (
                            <Text
                                style={{
                                    ...styles.layerText,
                                    color:
                                        themeColor('buttonTextSecondary') ||
                                        themeColor('secondaryText')
                                }}
                            >
                                {item.subtitle}
                            </Text>
                        )}
                    </View>
                </View>
            </LinearGradient>
        </RectButton>
    );
};

const SwipeableRow = ({
    item,
    navigation,
    value,
    amount,
    lightning,
    offer
}: {
    item: DataRow;
    index: number;
    navigation: StackNavigationProp<any, any>;
    value?: string;
    amount?: string;
    lightning?: string;
    offer?: string;
}) => {
    if (item.layer === 'Lightning') {
        return (
            <LightningSwipeableRow
                navigation={navigation}
                lightning={lightning}
                locked={true}
                disabled={item.disabled}
            >
                <Row item={item} />
            </LightningSwipeableRow>
        );
    }

    if (item.layer === 'Lightning via ecash') {
        return (
            <EcashSwipeableRow
                navigation={navigation}
                lightning={lightning}
                locked={true}
                disabled={item.disabled}
            >
                <Row item={item} />
            </EcashSwipeableRow>
        );
    }

    if (item.layer === 'Offer') {
        return (
            <LightningSwipeableRow
                navigation={navigation}
                offer={offer}
                locked={true}
                disabled={item.disabled}
            >
                <Row item={item} />
            </LightningSwipeableRow>
        );
    }

    if (item.layer === 'On-chain') {
        return (
            <OnchainSwipeableRow
                navigation={navigation}
                value={value}
                amount={amount}
                locked={true}
                disabled={item.disabled}
            >
                <Row item={item} />
            </OnchainSwipeableRow>
        );
    }
};

export default class PaymentMethodList extends Component<
    PaymentMethodListProps,
    {}
> {
    render() {
        const { navigation, value, amount, lightning, offer } = this.props;

        let DATA: DataRow[] = [];

        if (lightning) {
            DATA.push({
                layer: 'Lightning',
                subtitle: `${lightning?.slice(0, 12)}...${lightning?.slice(
                    -12
                )}`
            });
        }

        if (
            lightning &&
            BackendUtils.supportsCashuWallet() &&
            stores?.settingsStore?.settings?.ecash?.enableCashu
        ) {
            DATA.push({
                layer: 'Lightning via ecash',
                subtitle: `${lightning?.slice(0, 12)}...${lightning?.slice(
                    -12
                )}`
            });
        }

        if (offer) {
            DATA.push({
                layer: 'Offer',
                subtitle: `${offer?.slice(0, 12)}...${offer?.slice(-12)}`,
                disabled: !BackendUtils.supportsOffers()
            });
        }

        // Only show on-chain balance for non-Lnbank accounts
        if (value && BackendUtils.supportsOnchainReceiving()) {
            DATA.push({
                layer: 'On-chain',
                subtitle: value
                    ? `${value.slice(0, 12)}...${value.slice(-12)}`
                    : undefined,
                disabled: !BackendUtils.supportsOnchainSends()
            });
        }

        return (
            <View style={{ flex: 1 }}>
                <FlatList
                    data={DATA}
                    ItemSeparatorComponent={() => (
                        <View style={styles.separator} />
                    )}
                    renderItem={({ item, index }) => (
                        // @ts-ignore:next-line
                        <SwipeableRow
                            item={item}
                            index={index}
                            navigation={navigation}
                            // select pay method vars
                            value={value}
                            amount={amount}
                            lightning={lightning}
                            offer={offer}
                        />
                    )}
                    keyExtractor={(_item, index) => `message ${index}`}
                    style={{ marginTop: 20 }}
                    refreshing={false}
                />
            </View>
        );
    }
}

const styles = StyleSheet.create({
    rectButton: {
        flex: 1,
        height: 80,
        paddingVertical: 10,
        paddingLeft: 6,
        paddingRight: 20,
        justifyContent: 'space-between',
        alignItems: 'center',
        flexDirection: 'row',
        marginLeft: 15,
        marginRight: 15,
        borderRadius: 50
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
        fontFamily: 'PPNeueMontreal-Medium'
    },
    eyeIcon: { alignSelf: 'center', margin: 15, marginLeft: 25 }
});
