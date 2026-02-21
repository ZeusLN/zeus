import * as React from 'react';
import {
    ImageBackground,
    Modal,
    ScrollView,
    Text,
    View,
    StyleSheet,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { LinearProgress } from '@rneui/themed';
import BigNumber from 'bignumber.js';
import { StackNavigationProp } from '@react-navigation/stack';

import WalletHeader from '../../components/WalletHeader';
import Amount from '../../components/Amount';
import Button from '../../components/Button';
import Conversion from '../../components/Conversion';

import { localeString } from '../../utils/LocaleUtils';
import { IS_BACKED_UP_KEY } from '../../utils/MigrationUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Storage from '../../storage';

import BalanceStore from '../../stores/BalanceStore';
import CashuStore from '../../stores/CashuStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore from '../../stores/SettingsStore';
import SyncStore from '../../stores/SyncStore';

import AlertIcon from '../../assets/images/SVG/Alert.svg';
import ClockIcon from '../../assets/images/SVG/Clock.svg';
import PauseIcon from '../../assets/images/SVG/Pause.svg';
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
    showOfflinePendingModal: boolean;
    showOfflineSpentModal: boolean;
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
        showBackupPrompt: false,
        showOfflinePendingModal: false,
        showOfflineSpentModal: false
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
        const {
            showBackupPrompt,
            showOfflinePendingModal,
            showOfflineSpentModal
        } = this.state;
        const {
            totalBlockchainBalance,
            unconfirmedBlockchainBalance,
            lightningBalance,
            pendingOpenBalance
        } = BalanceStore;
        const cashuBalance = CashuStore.totalBalanceSats;
        const cashuOfflinePendingBalance = CashuStore.offlinePendingBalance;
        const { implementation, settings, lndFolderMissing } = SettingsStore;
        const {
            currentBlockHeight,
            bestBlockHeight,
            recoveryProgress,
            isSyncing,
            isRecovering,
            isRescanning,
            rescanStartHeight,
            rescanCurrentHeight
        } = SyncStore;

        // Calculate rescan progress (clamped to max 1 in case current exceeds best)
        // Use explicit null checks since rescanStartHeight can be 0 for genesis rescans
        const rescanProgress =
            rescanCurrentHeight !== null &&
            rescanStartHeight !== null &&
            bestBlockHeight !== null &&
            bestBlockHeight > rescanStartHeight
                ? Math.min(
                      1,
                      (rescanCurrentHeight - rescanStartHeight) /
                          (bestBlockHeight - rescanStartHeight)
                  )
                : null;

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
                {cashuOfflinePendingBalance > 0 && (
                    <Amount
                        sats={cashuOfflinePendingBalance}
                        sensitive
                        jumboText
                        toggleable
                        pending
                    />
                )}
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
                        {isRecovering && recoveryProgress !== 1 && (
                            <TouchableOpacity
                                onPress={() => {
                                    if (recoveryProgress) {
                                        navigation.navigate('SyncRecovery');
                                    }
                                }}
                            >
                                <View
                                    style={[
                                        styles.card,
                                        {
                                            backgroundColor:
                                                themeColor('highlight')
                                        }
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.cardTitleText,
                                            { color: themeColor('background') }
                                        ]}
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
                                            style={[
                                                styles.cardBodyText,
                                                {
                                                    color: themeColor(
                                                        'background'
                                                    )
                                                }
                                            ]}
                                        >
                                            {localeString(
                                                'views.Wallet.BalancePane.recovery.text'
                                            ).replace('Zeus', 'ZEUS')}
                                        </Text>
                                    )}
                                    {recoveryProgress && (
                                        <View style={styles.progressContainer}>
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
                                                style={styles.progressBar}
                                            />
                                            <Text
                                                style={[
                                                    styles.progressText,
                                                    {
                                                        color: themeColor(
                                                            'background'
                                                        )
                                                    }
                                                ]}
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
                        {isRescanning && (
                            <TouchableOpacity
                                onPress={() => navigation.navigate('LNDLogs')}
                            >
                                <View
                                    style={[
                                        styles.card,
                                        {
                                            backgroundColor:
                                                themeColor('secondary'),
                                            marginBottom: 20
                                        }
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.cardTitleText,
                                            { color: themeColor('text') }
                                        ]}
                                    >
                                        {localeString(
                                            'views.Wallet.BalancePane.rescan.title'
                                        )}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.cardBodyText,
                                            { color: themeColor('text') }
                                        ]}
                                    >
                                        {localeString(
                                            'views.Wallet.BalancePane.rescan.text'
                                        )}
                                    </Text>
                                    {rescanProgress !== null && (
                                        <View style={styles.progressContainer}>
                                            <LinearProgress
                                                value={
                                                    Math.floor(
                                                        rescanProgress * 100
                                                    ) / 100
                                                }
                                                variant="determinate"
                                                color={themeColor('highlight')}
                                                trackColor={themeColor(
                                                    'secondaryBackground'
                                                )}
                                                style={styles.progressBar}
                                            />
                                            <Text
                                                style={[
                                                    styles.progressText,
                                                    {
                                                        color: themeColor(
                                                            'text'
                                                        )
                                                    }
                                                ]}
                                            >
                                                {`${Math.floor(
                                                    rescanProgress * 100
                                                ).toString()}%`}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        )}
                        {(isSyncing ||
                            cashuOfflinePendingBalance > 0 ||
                            CashuStore.offlineSpentTokens.length > 0) && (
                            <View style={{ marginTop: 20 }}>
                                {isSyncing && (
                                    <TouchableOpacity
                                        onPress={() =>
                                            navigation.navigate('Sync')
                                        }
                                    >
                                        {CashuStore.isOffline ? (
                                            <View
                                                style={[
                                                    styles.card,
                                                    {
                                                        backgroundColor:
                                                            themeColor(
                                                                'secondary'
                                                            ),
                                                        marginTop: 0,
                                                        marginBottom: 10,
                                                        paddingVertical: 10,
                                                        flexDirection: 'row',
                                                        alignItems: 'center'
                                                    }
                                                ]}
                                            >
                                                <PauseIcon
                                                    color={themeColor('text')}
                                                    width={16}
                                                    height={16}
                                                    style={{ marginRight: 8 }}
                                                />
                                                <Text
                                                    style={[
                                                        styles.cardTitleText,
                                                        {
                                                            color: themeColor(
                                                                'text'
                                                            ),
                                                            fontSize: 14,
                                                            marginBottom: 0
                                                        }
                                                    ]}
                                                >
                                                    {localeString(
                                                        'views.Wallet.BalancePane.sync.paused'
                                                    )}
                                                </Text>
                                            </View>
                                        ) : (
                                            <View
                                                style={[
                                                    styles.card,
                                                    {
                                                        backgroundColor:
                                                            themeColor(
                                                                'secondary'
                                                            ),
                                                        marginTop: 0,
                                                        marginBottom: 10
                                                    }
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.cardTitleText,
                                                        {
                                                            color: themeColor(
                                                                'text'
                                                            )
                                                        }
                                                    ]}
                                                >
                                                    {localeString(
                                                        'views.Wallet.BalancePane.sync.title'
                                                    )}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.cardBodyText,
                                                        {
                                                            color: themeColor(
                                                                'text'
                                                            )
                                                        }
                                                    ]}
                                                >
                                                    {localeString(
                                                        'views.Wallet.BalancePane.sync.text'
                                                    ).replace('Zeus', 'ZEUS')}
                                                </Text>
                                                {currentBlockHeight !==
                                                    undefined &&
                                                    bestBlockHeight && (
                                                        <View
                                                            style={
                                                                styles.progressContainer
                                                            }
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
                                                                color={themeColor(
                                                                    'highlight'
                                                                )}
                                                                trackColor={themeColor(
                                                                    'secondaryBackground'
                                                                )}
                                                                style={
                                                                    styles.progressBar
                                                                }
                                                            />
                                                            <Text
                                                                style={[
                                                                    styles.progressText,
                                                                    {
                                                                        color: themeColor(
                                                                            'text'
                                                                        )
                                                                    }
                                                                ]}
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
                                        )}
                                    </TouchableOpacity>
                                )}
                                {implementation === 'embedded-lnd' &&
                                    !isSyncing &&
                                    showBackupPrompt &&
                                    (BalanceStore.lightningBalance !== 0 ||
                                        BalanceStore.totalBlockchainBalance !==
                                            0) &&
                                    !BalanceStore.loadingBlockchainBalance &&
                                    !BalanceStore.loadingLightningBalance && (
                                        <TouchableOpacity
                                            onPress={() =>
                                                navigation.navigate('Seed')
                                            }
                                        >
                                            <View
                                                style={[
                                                    styles.backupCard,
                                                    {
                                                        backgroundColor:
                                                            themeColor(
                                                                'secondary'
                                                            ),
                                                        borderColor:
                                                            themeColor(
                                                                'highlight'
                                                            )
                                                    }
                                                ]}
                                            >
                                                <View
                                                    style={
                                                        styles.lockIconContainer
                                                    }
                                                >
                                                    <LockIcon
                                                        fill={themeColor(
                                                            'highlight'
                                                        )}
                                                    />
                                                </View>
                                                <Text
                                                    style={[
                                                        styles.cardTitleText,
                                                        {
                                                            color: themeColor(
                                                                'text'
                                                            )
                                                        }
                                                    ]}
                                                >
                                                    {localeString(
                                                        'views.Wallet.BalancePane.backup.title'
                                                    )}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.cardBodyText,
                                                        {
                                                            color: themeColor(
                                                                'text'
                                                            )
                                                        }
                                                    ]}
                                                >
                                                    {localeString(
                                                        'views.Wallet.BalancePane.backup.text'
                                                    )}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.cardBodyTextBold,
                                                        {
                                                            color: themeColor(
                                                                'text'
                                                            )
                                                        }
                                                    ]}
                                                >
                                                    {localeString(
                                                        'views.Wallet.BalancePane.backup.action'
                                                    )}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                {implementation === 'embedded-lnd' &&
                                    lndFolderMissing && (
                                        <View
                                            style={[
                                                styles.errorCard,
                                                {
                                                    backgroundColor:
                                                        themeColor('error')
                                                }
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
                                                        navigation.navigate(
                                                            'Wallets'
                                                        )
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
                                                        navigation.navigate(
                                                            'Tools',
                                                            {
                                                                showClearDataModal:
                                                                    true
                                                            }
                                                        )
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
                                {cashuOfflinePendingBalance > 0 && (
                                    <>
                                        <TouchableOpacity
                                            onPress={() =>
                                                this.setState({
                                                    showOfflinePendingModal:
                                                        true
                                                })
                                            }
                                        >
                                            <View
                                                style={[
                                                    styles.pendingBanner,
                                                    {
                                                        backgroundColor:
                                                            themeColor(
                                                                'warning'
                                                            )
                                                    }
                                                ]}
                                            >
                                                <View
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    <ClockIcon
                                                        color="#fff"
                                                        width={18}
                                                        height={18}
                                                        style={{
                                                            marginRight: 8
                                                        }}
                                                    />
                                                    <Text
                                                        style={
                                                            styles.pendingBannerText
                                                        }
                                                    >
                                                        {`${
                                                            CashuStore
                                                                .offlinePendingTokens
                                                                .length
                                                        } ${localeString(
                                                            CashuStore
                                                                .offlinePendingTokens
                                                                .length === 1
                                                                ? 'cashu.offlinePending.bannerTitleSingular'
                                                                : 'cashu.offlinePending.bannerTitle'
                                                        )}`}
                                                    </Text>
                                                </View>
                                                <Amount
                                                    sats={
                                                        cashuOfflinePendingBalance
                                                    }
                                                    sensitive
                                                    toggleable
                                                    colorOverride="#fff"
                                                />
                                            </View>
                                        </TouchableOpacity>
                                        <Modal
                                            animationType="fade"
                                            transparent
                                            visible={showOfflinePendingModal}
                                            onRequestClose={() =>
                                                this.setState({
                                                    showOfflinePendingModal:
                                                        false
                                                })
                                            }
                                        >
                                            <TouchableOpacity
                                                style={styles.modalOverlay}
                                                activeOpacity={1}
                                                onPress={() =>
                                                    this.setState({
                                                        showOfflinePendingModal:
                                                            false
                                                    })
                                                }
                                            >
                                                <View
                                                    style={[
                                                        styles.modalContent,
                                                        {
                                                            backgroundColor:
                                                                themeColor(
                                                                    'secondary'
                                                                )
                                                        }
                                                    ]}
                                                    onStartShouldSetResponder={() =>
                                                        true
                                                    }
                                                >
                                                    <Text
                                                        style={[
                                                            styles.cardTitleText,
                                                            {
                                                                color: themeColor(
                                                                    'text'
                                                                ),
                                                                fontSize: 18,
                                                                marginBottom: 15
                                                            }
                                                        ]}
                                                    >
                                                        {localeString(
                                                            'cashu.offlinePending.bannerTitle'
                                                        )}
                                                    </Text>
                                                    <ScrollView
                                                        style={{
                                                            maxHeight: 250
                                                        }}
                                                    >
                                                        {CashuStore.offlinePendingTokens.map(
                                                            (token, index) => (
                                                                <TouchableOpacity
                                                                    key={index}
                                                                    onPress={() => {
                                                                        this.setState(
                                                                            {
                                                                                showOfflinePendingModal:
                                                                                    false
                                                                            }
                                                                        );
                                                                        navigation.navigate(
                                                                            'CashuToken',
                                                                            {
                                                                                token: token.encodedToken,
                                                                                decoded:
                                                                                    token
                                                                            }
                                                                        );
                                                                    }}
                                                                    style={[
                                                                        styles.tokenRow,
                                                                        {
                                                                            borderBottomColor:
                                                                                themeColor(
                                                                                    'secondaryText'
                                                                                ),
                                                                            borderBottomWidth:
                                                                                index <
                                                                                CashuStore
                                                                                    .offlinePendingTokens
                                                                                    .length -
                                                                                    1
                                                                                    ? StyleSheet.hairlineWidth
                                                                                    : 0
                                                                        }
                                                                    ]}
                                                                >
                                                                    <View
                                                                        style={{
                                                                            flex: 1
                                                                        }}
                                                                    >
                                                                        <Amount
                                                                            sats={
                                                                                token.getAmount
                                                                            }
                                                                            sensitive
                                                                            toggleable
                                                                            pending
                                                                        />
                                                                        <Text
                                                                            style={[
                                                                                styles.tokenMint,
                                                                                {
                                                                                    color: themeColor(
                                                                                        'secondaryText'
                                                                                    )
                                                                                }
                                                                            ]}
                                                                            numberOfLines={
                                                                                1
                                                                            }
                                                                            ellipsizeMode="middle"
                                                                        >
                                                                            {
                                                                                token.mint
                                                                            }
                                                                        </Text>
                                                                        {token.getDisplayTimeShort !==
                                                                            '' && (
                                                                            <Text
                                                                                style={[
                                                                                    styles.tokenMint,
                                                                                    {
                                                                                        color: themeColor(
                                                                                            'secondaryText'
                                                                                        )
                                                                                    }
                                                                                ]}
                                                                            >
                                                                                {
                                                                                    token.getDisplayTimeShort
                                                                                }
                                                                            </Text>
                                                                        )}
                                                                    </View>
                                                                    <Text
                                                                        style={{
                                                                            color: themeColor(
                                                                                'secondaryText'
                                                                            ),
                                                                            fontSize: 18
                                                                        }}
                                                                    >
                                                                        {'>'}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            )
                                                        )}
                                                    </ScrollView>
                                                    <Text
                                                        style={[
                                                            styles.cardBodyText,
                                                            {
                                                                color: themeColor(
                                                                    'warning'
                                                                )
                                                            }
                                                        ]}
                                                    >
                                                        {localeString(
                                                            'cashu.offlinePending.bannerWarning'
                                                        )}
                                                    </Text>
                                                    <TouchableOpacity
                                                        onPress={() =>
                                                            this.setState({
                                                                showOfflinePendingModal:
                                                                    false
                                                            })
                                                        }
                                                        style={[
                                                            styles.modalDismiss,
                                                            {
                                                                backgroundColor:
                                                                    themeColor(
                                                                        'highlight'
                                                                    )
                                                            }
                                                        ]}
                                                    >
                                                        <Text
                                                            style={{
                                                                color: themeColor(
                                                                    'background'
                                                                ),
                                                                fontFamily:
                                                                    'PPNeueMontreal-Medium',
                                                                textAlign:
                                                                    'center'
                                                            }}
                                                        >
                                                            {localeString(
                                                                'general.ok'
                                                            )}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </TouchableOpacity>
                                        </Modal>
                                    </>
                                )}
                                {CashuStore.offlineSpentTokens.length > 0 && (
                                    <>
                                        <TouchableOpacity
                                            onPress={() =>
                                                this.setState({
                                                    showOfflineSpentModal: true
                                                })
                                            }
                                        >
                                            <View
                                                style={[
                                                    styles.pendingBanner,
                                                    {
                                                        backgroundColor:
                                                            themeColor('error')
                                                    }
                                                ]}
                                            >
                                                <View
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    <AlertIcon
                                                        fill="#fff"
                                                        width={18}
                                                        height={18}
                                                        style={{
                                                            marginRight: 8
                                                        }}
                                                    />
                                                    <Text
                                                        style={
                                                            styles.pendingBannerText
                                                        }
                                                    >
                                                        {`${
                                                            CashuStore
                                                                .offlineSpentTokens
                                                                .length
                                                        } ${localeString(
                                                            CashuStore
                                                                .offlineSpentTokens
                                                                .length === 1
                                                                ? 'cashu.offlineSpent.bannerTitleSingular'
                                                                : 'cashu.offlineSpent.bannerTitle'
                                                        )}`}
                                                    </Text>
                                                </View>
                                                <Amount
                                                    sats={CashuStore.offlineSpentTokens.reduce(
                                                        (sum, t) =>
                                                            sum + t.getAmount,
                                                        0
                                                    )}
                                                    sensitive
                                                    toggleable
                                                    colorOverride="#fff"
                                                />
                                            </View>
                                        </TouchableOpacity>
                                        <Modal
                                            animationType="fade"
                                            transparent
                                            visible={
                                                showOfflineSpentModal ||
                                                CashuStore.showOfflineSpentAlert
                                            }
                                            onRequestClose={() => {
                                                CashuStore.dismissOfflineSpentTokens();
                                                this.setState({
                                                    showOfflineSpentModal: false
                                                });
                                            }}
                                        >
                                            <TouchableOpacity
                                                style={styles.modalOverlay}
                                                activeOpacity={1}
                                                onPress={() => {
                                                    CashuStore.dismissOfflineSpentTokens();
                                                    this.setState({
                                                        showOfflineSpentModal:
                                                            false
                                                    });
                                                }}
                                            >
                                                <View
                                                    style={[
                                                        styles.modalContent,
                                                        {
                                                            backgroundColor:
                                                                themeColor(
                                                                    'secondary'
                                                                ),
                                                            borderColor:
                                                                themeColor(
                                                                    'error'
                                                                ),
                                                            borderWidth: 2
                                                        }
                                                    ]}
                                                    onStartShouldSetResponder={() =>
                                                        true
                                                    }
                                                >
                                                    <Text
                                                        style={[
                                                            styles.cardTitleText,
                                                            {
                                                                color: themeColor(
                                                                    'warning'
                                                                ),
                                                                fontSize: 18,
                                                                marginBottom: 15
                                                            }
                                                        ]}
                                                    >
                                                        {localeString(
                                                            'cashu.offlineSpent.title'
                                                        )}
                                                    </Text>
                                                    <Text
                                                        style={[
                                                            styles.cardBodyText,
                                                            {
                                                                color: themeColor(
                                                                    'text'
                                                                ),
                                                                marginTop: 0,
                                                                marginBottom: 10
                                                            }
                                                        ]}
                                                    >
                                                        {localeString(
                                                            'cashu.offlineSpent.message'
                                                        )}
                                                    </Text>
                                                    <ScrollView
                                                        style={{
                                                            maxHeight: 250
                                                        }}
                                                    >
                                                        {CashuStore.offlineSpentTokens.map(
                                                            (token, index) => (
                                                                <TouchableOpacity
                                                                    key={index}
                                                                    onPress={() => {
                                                                        CashuStore.dismissOfflineSpentTokens();
                                                                        this.setState(
                                                                            {
                                                                                showOfflineSpentModal:
                                                                                    false
                                                                            }
                                                                        );
                                                                        navigation.navigate(
                                                                            'CashuToken',
                                                                            {
                                                                                token: token.encodedToken,
                                                                                decoded:
                                                                                    token,
                                                                                offlineSpent:
                                                                                    true
                                                                            }
                                                                        );
                                                                    }}
                                                                    style={[
                                                                        styles.tokenRow,
                                                                        {
                                                                            borderBottomColor:
                                                                                themeColor(
                                                                                    'secondaryText'
                                                                                ),
                                                                            borderBottomWidth:
                                                                                index <
                                                                                CashuStore
                                                                                    .offlineSpentTokens
                                                                                    .length -
                                                                                    1
                                                                                    ? StyleSheet.hairlineWidth
                                                                                    : 0
                                                                        }
                                                                    ]}
                                                                >
                                                                    <View
                                                                        style={{
                                                                            flex: 1
                                                                        }}
                                                                    >
                                                                        <Amount
                                                                            sats={
                                                                                token.getAmount
                                                                            }
                                                                            sensitive
                                                                            toggleable
                                                                            color="warning"
                                                                        />
                                                                        <Text
                                                                            style={[
                                                                                styles.tokenMint,
                                                                                {
                                                                                    color: themeColor(
                                                                                        'secondaryText'
                                                                                    )
                                                                                }
                                                                            ]}
                                                                            numberOfLines={
                                                                                1
                                                                            }
                                                                            ellipsizeMode="middle"
                                                                        >
                                                                            {
                                                                                token.mint
                                                                            }
                                                                        </Text>
                                                                        {token.getDisplayTimeShort !==
                                                                            '' && (
                                                                            <Text
                                                                                style={[
                                                                                    styles.tokenMint,
                                                                                    {
                                                                                        color: themeColor(
                                                                                            'secondaryText'
                                                                                        )
                                                                                    }
                                                                                ]}
                                                                            >
                                                                                {
                                                                                    token.getDisplayTimeShort
                                                                                }
                                                                            </Text>
                                                                        )}
                                                                    </View>
                                                                    <Text
                                                                        style={{
                                                                            color: themeColor(
                                                                                'secondaryText'
                                                                            ),
                                                                            fontSize: 18
                                                                        }}
                                                                    >
                                                                        {'>'}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            )
                                                        )}
                                                    </ScrollView>
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            CashuStore.dismissOfflineSpentTokens();
                                                            this.setState({
                                                                showOfflineSpentModal:
                                                                    false
                                                            });
                                                        }}
                                                        style={[
                                                            styles.modalDismiss,
                                                            {
                                                                backgroundColor:
                                                                    themeColor(
                                                                        'error'
                                                                    )
                                                            }
                                                        ]}
                                                    >
                                                        <Text
                                                            style={{
                                                                color: '#fff',
                                                                fontFamily:
                                                                    'PPNeueMontreal-Medium',
                                                                textAlign:
                                                                    'center'
                                                            }}
                                                        >
                                                            {localeString(
                                                                'general.ok'
                                                            )}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </TouchableOpacity>
                                        </Modal>
                                    </>
                                )}
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
    pendingBanner: {
        borderRadius: 10,
        marginHorizontal: 20,
        marginBottom: 10,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    pendingBannerText: {
        fontFamily: 'PPNeueMontreal-Medium',
        color: '#fff',
        fontSize: 14
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalContent: {
        borderRadius: 15,
        marginHorizontal: 30,
        padding: 25,
        width: '85%'
    },
    tokenRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12
    },
    tokenMint: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 12,
        marginTop: 4
    },
    modalDismiss: {
        borderRadius: 8,
        paddingVertical: 12,
        marginTop: 20
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
