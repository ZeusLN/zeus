import * as React from 'react';
import {
    ImageBackground,
    Text,
    View,
    StyleSheet,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { LinearProgress } from 'react-native-elements';
import BigNumber from 'bignumber.js';
import { StackNavigationProp } from '@react-navigation/stack';

import WalletHeader from '../../components/WalletHeader';
import Amount from '../../components/Amount';
import Conversion from '../../components/Conversion';

import { localeString } from '../../utils/LocaleUtils';
import { IS_BACKED_UP_KEY } from '../../utils/MigrationUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Storage from '../../storage';

import BalanceStore from '../../stores/BalanceStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore from '../../stores/SettingsStore';
import SyncStore from '../../stores/SyncStore';

import LockIcon from '../../assets/images/SVG/Lock.svg';

const ErrorZeus = require('../../assets/images/errorZeus.png');

interface BalancePaneProps {
    navigation: StackNavigationProp<any, any>;
    BalanceStore: BalanceStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
    SyncStore: SyncStore;
}

interface BalancePaneState {
    showBackupPrompt: boolean;
}

@inject('BalanceStore', 'NodeInfoStore', 'SettingsStore', 'SyncStore')
@observer
export default class BalancePane extends React.PureComponent<
    BalancePaneProps,
    BalancePaneState
> {
    state = {
        showBackupPrompt: false
    };

    async UNSAFE_componentWillMount() {
        const isBackedUp = await Storage.getItem(IS_BACKED_UP_KEY);
        if (isBackedUp !== 'true') {
            this.setState({
                showBackupPrompt: true
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
        const { showBackupPrompt } = this.state;
        const {
            totalBlockchainBalance,
            unconfirmedBlockchainBalance,
            lightningBalance,
            pendingOpenBalance
        } = BalanceStore;
        const { implementation } = SettingsStore;
        const {
            currentBlockHeight,
            bestBlockHeight,
            recoveryProgress,
            isSyncing,
            isRecovering
        } = SyncStore;

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
                <View style={{ minHeight: 200 }}>
                    <WalletHeader
                        navigation={navigation}
                        SettingsStore={SettingsStore}
                    />
                    <View
                        style={{
                            marginBottom: 20
                        }}
                    >
                        {isRecovering && recoveryProgress !== 1 && (
                            <TouchableOpacity
                                onPress={() => {
                                    if (recoveryProgress) {
                                        navigation.navigate('SyncRecovery');
                                    }
                                }}
                            >
                                <View
                                    style={{
                                        backgroundColor:
                                            themeColor('highlight'),
                                        borderRadius: 10,
                                        margin: 20,
                                        marginBottom: 0,
                                        padding: 15,
                                        borderWidth: 0.5
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontFamily: 'PPNeueMontreal-Medium',
                                            color: themeColor('background')
                                        }}
                                    >
                                        {`${localeString(
                                            'views.Wallet.BalancePane.recovery.title'
                                        )}${
                                            !recoveryProgress
                                                ? ` - ${localeString(
                                                      'views.Wallet.BalancePane.recovery.textAlt'
                                                  ).replace('Zeus', 'ZEUS')}`
                                                : ''
                                        }`}
                                    </Text>
                                    {recoveryProgress && (
                                        <Text
                                            style={{
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                color: themeColor('background'),
                                                marginTop: 20
                                            }}
                                        >
                                            {localeString(
                                                'views.Wallet.BalancePane.recovery.text'
                                            ).replace('Zeus', 'ZEUS')}
                                        </Text>
                                    )}
                                    {recoveryProgress && (
                                        <View
                                            style={{
                                                marginTop: 30,
                                                flex: 1,
                                                flexDirection: 'row',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                minWidth: '100%'
                                            }}
                                        >
                                            <LinearProgress
                                                value={
                                                    Math.floor(
                                                        recoveryProgress * 100
                                                    ) / 100
                                                }
                                                variant="determinate"
                                                color={themeColor('background')}
                                                trackColor={themeColor(
                                                    'secondaryBackground'
                                                )}
                                                style={{
                                                    flex: 1,
                                                    flexDirection: 'row'
                                                }}
                                            />
                                            <Text
                                                style={{
                                                    fontFamily:
                                                        'PPNeueMontreal-Medium',
                                                    color: themeColor(
                                                        'background'
                                                    ),
                                                    marginTop: -8,
                                                    marginLeft: 14,
                                                    height: 40
                                                }}
                                            >
                                                {`${Math.floor(
                                                    recoveryProgress * 100
                                                ).toString()}%`}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        )}
                        {isSyncing && (
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Sync')}
                            >
                                <View
                                    style={{
                                        backgroundColor:
                                            themeColor('secondary'),
                                        borderRadius: 10,
                                        margin: 20,
                                        padding: 15,
                                        borderWidth: 0.5
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontFamily: 'PPNeueMontreal-Medium',
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.Wallet.BalancePane.sync.title'
                                        )}
                                    </Text>
                                    <Text
                                        style={{
                                            fontFamily: 'PPNeueMontreal-Book',
                                            color: themeColor('text'),
                                            marginTop: 20
                                        }}
                                    >
                                        {localeString(
                                            'views.Wallet.BalancePane.sync.text'
                                        ).replace('Zeus', 'ZEUS')}
                                    </Text>
                                    {currentBlockHeight && bestBlockHeight && (
                                        <View
                                            style={{
                                                marginTop: 30,
                                                flex: 1,
                                                flexDirection: 'row',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                minWidth: '100%'
                                            }}
                                        >
                                            <LinearProgress
                                                value={
                                                    Math.floor(
                                                        (currentBlockHeight /
                                                            bestBlockHeight) *
                                                            100
                                                    ) / 100
                                                }
                                                variant="determinate"
                                                color={themeColor('highlight')}
                                                trackColor={themeColor(
                                                    'secondaryBackground'
                                                )}
                                                style={{
                                                    flex: 1,
                                                    flexDirection: 'row'
                                                }}
                                            />
                                            <Text
                                                style={{
                                                    fontFamily:
                                                        'PPNeueMontreal-Medium',
                                                    color: themeColor('text'),
                                                    marginTop: -8,
                                                    marginLeft: 14,
                                                    height: 40
                                                }}
                                            >
                                                {`${Math.floor(
                                                    (currentBlockHeight /
                                                        bestBlockHeight) *
                                                        100
                                                ).toString()}%`}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        )}
                        {implementation === 'embedded-lnd' &&
                            !isSyncing &&
                            showBackupPrompt &&
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
                                                fontFamily:
                                                    'PPNeueMontreal-Medium',
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Wallet.BalancePane.backup.title'
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
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
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
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
                    <ImageBackground
                        source={ErrorZeus}
                        resizeMode="cover"
                        style={{
                            flex: 1
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Book',
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
                    </ImageBackground>
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
