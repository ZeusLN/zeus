import * as React from 'react';
import {
    ImageBackground,
    Text,
    View,
    StyleSheet,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';
import { StackNavigationProp } from '@react-navigation/stack';

import WalletHeader from '../../components/WalletHeader';
import Amount from '../../components/Amount';
import Button from '../../components/Button';
import Conversion from '../../components/Conversion';
import SyncingStatus from '../../components/SyncingStatus';
import RecoveryStatus from '../../components/RecoveryStatus';

import { localeString } from '../../utils/LocaleUtils';
import { IS_BACKED_UP_KEY } from '../../utils/MigrationUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Storage from '../../storage';

import BalanceStore from '../../stores/BalanceStore';
import CashuStore from '../../stores/CashuStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore from '../../stores/SettingsStore';
import SyncStore from '../../stores/SyncStore';

import LockIcon from '../../assets/images/SVG/Lock.svg';

const ErrorZeus = require('../../assets/images/errorZeus.png');

interface BalancePaneProps {
    navigation: StackNavigationProp<any, any>;
    BalanceStore: BalanceStore;
    CashuStore: CashuStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
    SyncStore: SyncStore;
    loading: boolean;
}

interface BalancePaneState {
    showBackupPrompt: boolean;
}

@inject(
    'BalanceStore',
    'CashuStore',
    'NodeInfoStore',
    'SettingsStore',
    'SyncStore'
)
@observer
export default class BalancePane extends React.PureComponent<
    BalancePaneProps,
    BalancePaneState
> {
    state = {
        showBackupPrompt: false
    };

    async componentDidMount() {
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
            CashuStore,
            SettingsStore,
            SyncStore,
            navigation,
            loading
        } = this.props;
        const { showBackupPrompt } = this.state;
        const {
            totalBlockchainBalance,
            unconfirmedBlockchainBalance,
            lightningBalance,
            pendingOpenBalance
        } = BalanceStore;
        const cashuBalance = CashuStore.totalBalanceSats;
        const { implementation, settings, lndFolderMissing } = SettingsStore;

        const pendingUnconfirmedBalance = new BigNumber(pendingOpenBalance)
            .plus(unconfirmedBlockchainBalance)
            .toNumber()
            .toFixed(3);
        const combinedBalanceValue = new BigNumber(totalBlockchainBalance)
            .plus(lightningBalance)
            .plus(settings?.ecash?.enableCashu ? cashuBalance : 0)
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
        const error =
            NodeInfoStore.error || SettingsStore.error || BalanceStore.error;

        if (!error) {
            balancePane = (
                <View style={styles.balancePaneContainer}>
                    <WalletHeader
                        navigation={navigation}
                        SettingsStore={SettingsStore}
                        loading={loading}
                    />
                    <View style={styles.contentContainer}>
                        <RecoveryStatus navigation={navigation} />
                        <SyncingStatus navigation={navigation} />
                        {implementation === 'embedded-lnd' &&
                            !SyncStore.isSyncing &&
                            showBackupPrompt &&
                            (BalanceStore.lightningBalance !== 0 ||
                                BalanceStore.totalBlockchainBalance !== 0) &&
                            !BalanceStore.loadingBlockchainBalance &&
                            !BalanceStore.loadingLightningBalance && (
                                <TouchableOpacity
                                    onPress={() => navigation.navigate('Seed')}
                                >
                                    <View
                                        style={[
                                            styles.backupCard,
                                            {
                                                backgroundColor:
                                                    themeColor('secondary'),
                                                borderColor:
                                                    themeColor('highlight')
                                            }
                                        ]}
                                    >
                                        <View style={styles.lockIconContainer}>
                                            <LockIcon
                                                fill={themeColor('highlight')}
                                            />
                                        </View>
                                        <Text
                                            style={[
                                                styles.cardTitleText,
                                                { color: themeColor('text') }
                                            ]}
                                        >
                                            {localeString(
                                                'views.Wallet.BalancePane.backup.title'
                                            )}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.cardBodyText,
                                                { color: themeColor('text') }
                                            ]}
                                        >
                                            {localeString(
                                                'views.Wallet.BalancePane.backup.text'
                                            )}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.cardBodyTextBold,
                                                { color: themeColor('text') }
                                            ]}
                                        >
                                            {localeString(
                                                'views.Wallet.BalancePane.backup.action'
                                            )}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        {implementation === 'embedded-lnd' && lndFolderMissing && (
                            <View
                                style={[
                                    styles.errorCard,
                                    { backgroundColor: themeColor('error') }
                                ]}
                            >
                                <Text style={styles.errorTitleText}>
                                    {localeString(
                                        'views.Wallet.lndFolderMissing.title'
                                    )}
                                </Text>
                                <Text style={styles.errorBodyText}>
                                    {localeString(
                                        'views.Wallet.lndFolderMissing.message'
                                    )}
                                </Text>
                                <View style={styles.errorButtonRow}>
                                    <Button
                                        title={localeString(
                                            'views.Wallet.lndFolderMissing.deleteWallet'
                                        )}
                                        onPress={() =>
                                            navigation.navigate('Wallets')
                                        }
                                        quaternary
                                        buttonStyle={{
                                            minHeight: 80
                                        }}
                                        containerStyle={{
                                            flex: 1,
                                            marginRight: 5
                                        }}
                                    />
                                    <Button
                                        title={localeString(
                                            'views.Tools.clearStorage.title'
                                        )}
                                        onPress={() =>
                                            navigation.navigate('Tools', {
                                                showClearDataModal: true
                                            })
                                        }
                                        quaternary
                                        buttonStyle={{
                                            minHeight: 80
                                        }}
                                        containerStyle={{
                                            flex: 1,
                                            marginLeft: 5
                                        }}
                                    />
                                </View>
                            </View>
                        )}
                        {implementation === 'lndhub' ||
                        implementation === 'nostr-wallet-connect' ? (
                            <View style={styles.balanceContainer}>
                                <LightningBalance />
                            </View>
                        ) : (
                            <View style={styles.balanceContainer}>
                                <BalanceViewCombined />
                            </View>
                        )}
                    </View>
                </View>
            );
        } else {
            balancePane = (
                <View
                    style={[
                        styles.errorPane,
                        { backgroundColor: themeColor('error') }
                    ]}
                >
                    <WalletHeader
                        navigation={navigation}
                        SettingsStore={SettingsStore}
                        loading={loading}
                    />
                    <ImageBackground
                        source={ErrorZeus}
                        resizeMode="cover"
                        style={styles.errorBackground}
                    >
                        <Text style={styles.errorText}>
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
    },
    balancePaneContainer: {
        minHeight: 200
    },
    contentContainer: {
        marginBottom: 20
    },
    card: {
        borderRadius: 10,
        margin: 20,
        marginBottom: 0,
        padding: 15,
        borderWidth: 0.5
    },
    backupCard: {
        borderRadius: 10,
        margin: 20,
        padding: 15,
        borderWidth: 1.5
    },
    cardTitleText: {
        fontFamily: 'PPNeueMontreal-Medium'
    },
    cardBodyText: {
        fontFamily: 'PPNeueMontreal-Book',
        marginTop: 20
    },
    cardBodyTextBold: {
        fontFamily: 'PPNeueMontreal-Book',
        fontWeight: 'bold',
        marginTop: 20
    },
    progressContainer: {
        marginTop: 30,
        flex: 1,
        flexDirection: 'row',
        display: 'flex',
        justifyContent: 'space-between',
        minWidth: '100%'
    },
    progressBar: {
        flex: 1,
        flexDirection: 'row'
    },
    progressText: {
        fontFamily: 'PPNeueMontreal-Medium',
        marginTop: -8,
        marginLeft: 14,
        height: 40
    },
    lockIconContainer: {
        marginBottom: 10
    },
    errorCard: {
        borderRadius: 10,
        margin: 20,
        marginBottom: 0,
        padding: 15
    },
    errorTitleText: {
        fontFamily: 'PPNeueMontreal-Medium',
        color: '#fff',
        fontSize: 16,
        marginBottom: 10
    },
    errorBodyText: {
        fontFamily: 'PPNeueMontreal-Book',
        color: '#fff',
        marginBottom: 20
    },
    errorButtonRow: {
        flexDirection: 'row'
    },
    balanceContainer: {
        marginTop: 60,
        marginBottom: 30
    },
    errorPane: {
        flex: 1
    },
    errorBackground: {
        flex: 1
    },
    errorText: {
        fontFamily: 'PPNeueMontreal-Book',
        color: '#fff',
        fontSize: 20,
        margin: 20
    }
});
