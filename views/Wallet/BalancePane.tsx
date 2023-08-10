import * as React from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';
import { LinearProgress } from 'react-native-elements';
import EncryptedStorage from 'react-native-encrypted-storage';
import BigNumber from 'bignumber.js';

import Button from '../../components/Button';
import WalletHeader from '../../components/WalletHeader';
import Amount from '../../components/Amount';
import Conversion from '../../components/Conversion';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import BalanceStore from '../../stores/BalanceStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore from '../../stores/SettingsStore';
import SyncStore from '../../stores/SyncStore';

import { version, playStore } from '../../package.json';

import LockIcon from '../../assets/images/SVG/Lock.svg';

interface BalancePaneProps {
    navigation: any;
    BalanceStore: BalanceStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
    SyncStore: SyncStore;
}

interface BalancePaneState {
    isBackedUp: boolean;
}

@inject('BalanceStore', 'NodeInfoStore', 'SettingsStore', 'SyncStore')
@observer
export default class BalancePane extends React.PureComponent<
    BalancePaneProps,
    BalancePaneState
> {
    state = {
        isBackedUp: false
    };

    async UNSAFE_componentWillMount() {
        const isBackedUp = await EncryptedStorage.getItem('backup-complete');
        if (isBackedUp === 'true') {
            this.setState({
                isBackedUp: true
            });
        }
    }

    render() {
        const {
            NodeInfoStore,
            BalanceStore,
            SettingsStore,
            SyncStore,
            navigation
        } = this.props;
        const { isBackedUp } = this.state;
        const {
            totalBlockchainBalance,
            unconfirmedBlockchainBalance,
            lightningBalance,
            pendingOpenBalance
        } = BalanceStore;
        const { implementation } = SettingsStore;
        const { currentBlockHeight, bestBlockHeight, isSyncing } = SyncStore;

        const pendingUnconfirmedBalance = new BigNumber(pendingOpenBalance)
            .plus(unconfirmedBlockchainBalance)
            .toNumber()
            .toFixed(3);
        const combinedBalanceValue = new BigNumber(totalBlockchainBalance)
            .plus(lightningBalance)
            .toNumber()
            .toFixed(3);

        const LightningBalance = () => (
            <View style={styles.balance}>
                <Amount
                    sats={lightningBalance}
                    sensitive
                    jumboText
                    toggleable
                />
                {!(pendingOpenBalance > 0) && (
                    <View style={styles.conversion}>
                        <Conversion sats={lightningBalance} sensitive />
                    </View>
                )}
                {pendingOpenBalance > 0 ? (
                    <>
                        <Amount
                            sats={pendingOpenBalance}
                            sensitive
                            jumboText
                            toggleable
                            pending
                        />
                        <View style={styles.conversion}>
                            <Conversion
                                sats={lightningBalance}
                                satsPending={pendingOpenBalance}
                                sensitive
                            />
                        </View>
                    </>
                ) : null}
            </View>
        );
        const BalanceViewCombined = () => (
            <View style={styles.balance}>
                <Amount
                    sats={combinedBalanceValue}
                    sensitive
                    jumboText
                    toggleable
                />
                {!(unconfirmedBlockchainBalance || pendingOpenBalance) && (
                    <View style={styles.conversion}>
                        <Conversion sats={combinedBalanceValue} sensitive />
                    </View>
                )}
                {unconfirmedBlockchainBalance || pendingOpenBalance ? (
                    <>
                        <Amount
                            sats={pendingUnconfirmedBalance}
                            sensitive
                            jumboText
                            toggleable
                            pending
                        />
                        <View style={styles.conversionSecondary}>
                            <Conversion
                                sats={combinedBalanceValue}
                                satsPending={pendingUnconfirmedBalance}
                                sensitive
                            />
                        </View>
                    </>
                ) : null}
            </View>
        );

        let balancePane;
        const error = NodeInfoStore.error || SettingsStore.error;

        if (!error) {
            balancePane = (
                <View
                    style={{
                        minHeight: 200
                    }}
                >
                    <WalletHeader
                        navigation={navigation}
                        SettingsStore={SettingsStore}
                    />
                    <View
                        style={{
                            marginBottom: 20
                        }}
                    >
                        {isSyncing && (
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Sync')}
                            >
                                <View
                                    style={{
                                        backgroundColor:
                                            themeColor('secondary'),
                                        borderRadius: 10,
                                        width: '90%',
                                        top: 10,
                                        margin: 20,
                                        padding: 15,
                                        borderWidth: 0.5
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontFamily: 'Lato-Bold',
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.Wallet.BalancePane.sync.title'
                                        )}
                                    </Text>
                                    <Text
                                        style={{
                                            fontFamily: 'Lato-Regular',
                                            color: themeColor('text'),
                                            marginTop: 20
                                        }}
                                    >
                                        {localeString(
                                            'views.Wallet.BalancePane.sync.text'
                                        )}
                                    </Text>
                                    {currentBlockHeight && bestBlockHeight && (
                                        <View
                                            style={{
                                                marginTop: 30,
                                                flex: 1,
                                                flexDirection: 'row',
                                                flexWrap: 'wrap',
                                                width: '100%'
                                            }}
                                        >
                                            <LinearProgress
                                                value={Number(
                                                    currentBlockHeight /
                                                        bestBlockHeight
                                                )}
                                                variant="determinate"
                                                color={themeColor('highlight')}
                                                trackColor={themeColor(
                                                    'secondaryBackground'
                                                )}
                                                style={{
                                                    width: '80%'
                                                }}
                                            />
                                            <Text
                                                style={{
                                                    fontFamily: 'Lato-Bold',
                                                    color: themeColor('text'),
                                                    marginTop: -8,
                                                    marginLeft: 14
                                                }}
                                            >
                                                {`~${Number(
                                                    (currentBlockHeight /
                                                        bestBlockHeight) *
                                                        100
                                                )
                                                    .toFixed(0)
                                                    .toString()}%`}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        )}
                        {implementation === 'embedded-lnd' &&
                            !isSyncing &&
                            !isBackedUp &&
                            (BalanceStore.lightningBalance !== 0 ||
                                BalanceStore.totalBlockchainBalance !== 0) &&
                            !BalanceStore.loadingBlockchainBalance &&
                            !BalanceStore.loadingLightningBalance && (
                                <TouchableOpacity
                                    onPress={() => navigation.navigate('Seed')}
                                >
                                    <View
                                        style={{
                                            backgroundColor:
                                                themeColor('secondary'),
                                            borderRadius: 10,
                                            borderColor:
                                                themeColor('highlight'),
                                            width: '90%',
                                            top: 10,
                                            margin: 20,
                                            padding: 15,
                                            borderWidth: 1.5
                                        }}
                                    >
                                        <View style={{ marginBottom: 10 }}>
                                            <LockIcon
                                                color={themeColor('highlight')}
                                            />
                                        </View>
                                        <Text
                                            style={{
                                                fontFamily: 'Lato-Bold',
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Wallet.BalancePane.backup.title'
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                fontFamily: 'Lato-Regular',
                                                color: themeColor('text'),
                                                marginTop: 20
                                            }}
                                        >
                                            {localeString(
                                                'views.Wallet.BalancePane.backup.text'
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                fontFamily: 'Lato-Regular',
                                                fontWeight: 'bold',
                                                color: themeColor('text'),
                                                marginTop: 20
                                            }}
                                        >
                                            {localeString(
                                                'views.Wallet.BalancePane.backup.action'
                                            )}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        {implementation === 'lndhub' ? (
                            <View style={{ marginTop: 40 }}>
                                <LightningBalance />
                            </View>
                        ) : (
                            <View style={{ marginTop: 40 }}>
                                <BalanceViewCombined />
                            </View>
                        )}
                    </View>
                </View>
            );
        } else {
            balancePane = (
                <View
                    style={{
                        backgroundColor: themeColor('error'),
                        paddingTop: 20,
                        paddingLeft: 10,
                        flex: 1
                    }}
                >
                    <Text
                        style={{
                            fontFamily: 'Lato-Regular',
                            color: '#fff',
                            fontSize: 20,
                            marginTop: 20,
                            marginBottom: 25
                        }}
                    >
                        {SettingsStore.errorMsg
                            ? SettingsStore.errorMsg
                            : NodeInfoStore.errorMsg
                            ? NodeInfoStore.errorMsg
                            : localeString('views.Wallet.MainPane.error')}
                    </Text>
                    <Button
                        icon={{
                            name: 'settings',
                            size: 25,
                            color: '#fff'
                        }}
                        title={localeString(
                            'views.Wallet.MainPane.goToSettings'
                        )}
                        buttonStyle={{
                            backgroundColor: 'gray',
                            borderRadius: 30
                        }}
                        containerStyle={{
                            alignItems: 'center'
                        }}
                        onPress={() => navigation.navigate('Settings')}
                        adaptiveWidth
                    />
                    <Text
                        style={{
                            fontFamily: 'Lato-Regular',
                            color: '#fff',
                            fontSize: 12,
                            marginTop: 20,
                            marginBottom: -40
                        }}
                    >
                        {playStore ? `v${version}-play` : `v${version}`}
                    </Text>
                </View>
            );
        }

        return <React.Fragment>{balancePane}</React.Fragment>;
    }
}

const styles = StyleSheet.create({
    balance: {
        alignItems: 'center'
    },
    conversion: {
        top: 10,
        alignItems: 'center'
    },
    conversionSecondary: {
        top: 3,
        alignItems: 'center'
    }
});
