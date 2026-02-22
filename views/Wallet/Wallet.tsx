import * as React from 'react';
import {
    Animated,
    AppState,
    AppStateStatus,
    BackHandler,
    Linking,
    NativeEventSubscription,
    PanResponder,
    PanResponderInstance,
    Platform,
    Text,
    TouchableOpacity,
    View,
    Alert,
    AlertButton,
    InteractionManager
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
    DefaultTheme,
    NavigationContainer,
    NavigationContainerRef,
    NavigationIndependentTree
} from '@react-navigation/native';
import { inject, observer } from 'mobx-react';
import RNRestart from 'react-native-restart';
import { StackNavigationProp } from '@react-navigation/stack';
import SystemNavigationBar from 'react-native-system-navigation-bar';

import ChannelsPane from '../Channels/ChannelsPane';
import BalancePane from './BalancePane';
import KeypadPane from './KeypadPane';
import SquarePosPane from './SquarePosPane';
import StandalonePosPane from './StandalonePosPane';
import StandalonePosKeypadPane from './StandalonePosKeypadPane';

import Button from '../../components/Button';
import LayerBalances from '../../components/LayerBalances';
import LoadingColumns from '../../components/LoadingColumns';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import WalletHeader from '../../components/WalletHeader';

import BackendUtils from '../../utils/BackendUtils';
import { getSupportedBiometryType } from '../../utils/BiometricUtils';
import LinkingUtils from '../../utils/LinkingUtils';
import {
    initializeLnd,
    startLnd,
    stopLnd,
    expressGraphSync,
    isLndError,
    isTransientRpcError,
    LndErrorCode,
    matchesLndErrorCode,
    waitForRpcReady
} from '../../utils/LndMobileUtils';
import { localeString, bridgeJavaStrings } from '../../utils/LocaleUtils';
import { isBatterySaverEnabled } from '../../utils/BatteryUtils';
import { IS_BACKED_UP_KEY } from '../../utils/MigrationUtils';
import { protectedNavigation } from '../../utils/NavigationUtils';
import { isLightTheme, themeColor } from '../../utils/ThemeUtils';
import { restartNeeded } from '../../utils/RestartUtils';
import {
    loadPendingPaymentData,
    clearPendingPaymentData
} from '../../utils/GraphSyncUtils';

import Storage from '../../storage';

import AlertStore from '../../stores/AlertStore';
import BalanceStore from '../../stores/BalanceStore';
import CashuStore from '../../stores/CashuStore';
import ChannelBackupStore from '../../stores/ChannelBackupStore';
import ChannelsStore from '../../stores/ChannelsStore';
import TransactionsStore from '../../stores/TransactionsStore';
import FiatStore from '../../stores/FiatStore';
import InvoicesStore from '../../stores/InvoicesStore';
import LightningAddressStore from '../../stores/LightningAddressStore';
import LnurlPayStore from '../../stores/LnurlPayStore';
import LSPStore from '../../stores/LSPStore';
import ModalStore from '../../stores/ModalStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import PosStore from '../../stores/PosStore';
import SettingsStore, {
    PosEnabled,
    INTERFACE_KEYS
} from '../../stores/SettingsStore';
import SyncStore from '../../stores/SyncStore';
import UnitsStore from '../../stores/UnitsStore';
import UTXOsStore from '../../stores/UTXOsStore';
import ContactStore from '../../stores/ContactStore';
import NotesStore from '../../stores/NotesStore';
import SwapStore from '../../stores/SwapStore';
import NostrWalletConnectStore from '../../stores/NostrWalletConnectStore';

import Bitcoin from '../../assets/images/SVG/Bitcoin.svg';
import CaretUp from '../../assets/images/SVG/Caret Up.svg';
import ChannelsIcon from '../../assets/images/SVG/Channels.svg';
import POS from '../../assets/images/SVG/POS.svg';
import Temple from '../../assets/images/SVG/Temple.svg';
import Scan from '../../assets/images/SVG/Scan.svg';

import { version } from '../../package.json';

const Tab = createBottomTabNavigator();

interface WalletProps {
    enterSetup: any;
    exitTransaction: any;
    navigation: StackNavigationProp<any, any>;
    route?: any;
    AlertStore: AlertStore;
    BalanceStore: BalanceStore;
    CashuStore: CashuStore;
    ChannelsStore: ChannelsStore;
    TransactionsStore: TransactionsStore;
    InvoicesStore: InvoicesStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
    FiatStore: FiatStore;
    PosStore: PosStore;
    UTXOsStore: UTXOsStore;
    ContactStore: ContactStore;
    ModalStore: ModalStore;
    SyncStore: SyncStore;
    LSPStore: LSPStore;
    NotesStore: NotesStore;
    SwapStore: SwapStore;
    ChannelBackupStore: ChannelBackupStore;
    LightningAddressStore: LightningAddressStore;
    LnurlPayStore: LnurlPayStore;
    NostrWalletConnectStore: NostrWalletConnectStore;
}

interface WalletState {
    unlocked: boolean;
    initialLoad: boolean;
    loading: boolean;
    pendingShareIntent?: { qrData?: string; base64Image?: string };
}

@inject(
    'AlertStore',
    'BalanceStore',
    'CashuStore',
    'ChannelsStore',
    'TransactionsStore',
    'InvoicesStore',
    'NodeInfoStore',
    'SettingsStore',
    'UnitsStore',
    'FiatStore',
    'PosStore',
    'UTXOsStore',
    'ContactStore',
    'ModalStore',
    'SyncStore',
    'LSPStore',
    'LnurlPayStore',
    'ChannelBackupStore',
    'LightningAddressStore',
    'NotesStore',
    'SwapStore',
    'NostrWalletConnectStore'
)
@observer
export default class Wallet extends React.Component<WalletProps, WalletState> {
    private tabNavigationRef = React.createRef<NavigationContainerRef<any>>();
    private pan: Animated.ValueXY;
    private panResponder: PanResponderInstance;
    private handleAppStateChangeSubscription: NativeEventSubscription;
    private backPressSubscription: NativeEventSubscription;
    private startupTimeoutId?: ReturnType<typeof setTimeout>;

    constructor(props: WalletProps) {
        super(props);
        this.state = {
            unlocked: false,
            initialLoad: true,
            loading: false,
            pendingShareIntent: undefined
        };
        this.pan = new Animated.ValueXY();
        this.panResponder = PanResponder.create({
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: Animated.event(
                [null, { dx: this.pan.x, dy: this.pan.y }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: () => {
                Animated.spring(this.pan, {
                    toValue: { x: 0, y: 0 },
                    useNativeDriver: false
                }).start();
                props.navigation.navigate('Activity', {
                    animation: 'slide_from_bottom'
                });
            }
        });
    }

    private handleBackButton() {
        const tabNavigator = this.tabNavigationRef.current;
        if (!tabNavigator) {
            return false;
        }
        const tabNavigatorState = tabNavigator.getState();
        if (!tabNavigatorState) {
            return false;
        }
        const currentTabName =
            tabNavigatorState.routeNames[tabNavigatorState.index];
        const defaultView =
            this.props.SettingsStore.settings.display.defaultView;

        if (defaultView === currentTabName || currentTabName === 'POS') {
            return false;
        } else if (defaultView) {
            tabNavigator.navigate(defaultView);
            return true;
        }
        return false;
    }

    private handleFocus = () => {
        this.backPressSubscription?.remove();
        this.backPressSubscription = BackHandler.addEventListener(
            'hardwareBackPress',
            this.handleBackButton.bind(this)
        );

        const { SettingsStore, CashuStore, route } = this.props;

        const shareIntentData = route?.params?.shareIntentData;
        if (shareIntentData) {
            this.setState({ pendingShareIntent: shareIntentData });
            if (route.params) {
                delete route.params.shareIntentData;
            }
        }

        if (
            this.state.initialLoad ||
            SettingsStore.posWasEnabled ||
            SettingsStore.triggerSettingsRefresh
        ) {
            // Trigger getSettingsAndNavigate() in three scenarios:
            // 1. On initial wallet load to ensure proper initialization
            // 2. When exiting POS to handle potential lockscreen navigation
            // 3. When any settings are updated to refresh the UI state
            this.getSettingsAndNavigate();
            SettingsStore.posWasEnabled = false;
            SettingsStore.triggerSettingsRefresh = false;
        }

        if (
            BackendUtils.supportsCashuWallet() &&
            SettingsStore.settings?.ecash?.enableCashu &&
            CashuStore?.cdkInitialized
        ) {
            CashuStore.checkPendingItems();
            CashuStore.syncCDKBalances().catch((e) =>
                console.error('Wallet: Failed to sync CDK balances:', e)
            );
        }
    };

    private handleBlur = () => this.backPressSubscription?.remove();

    async componentDidMount() {
        // triggers when loaded from navigation or back action
        this.props.navigation.addListener('focus', this.handleFocus);
        this.props.navigation.addListener('blur', this.handleBlur);

        this.handleAppStateChangeSubscription = AppState.addEventListener(
            'change',
            this.handleAppStateChange
        );

        const {
            SettingsStore: { updateSettings }
        } = this.props;

        const supportedBiometryType = await getSupportedBiometryType();

        await updateSettings({ supportedBiometryType });
    }

    componentWillUnmount() {
        this.props.navigation.removeListener &&
            this.props.navigation.removeListener('focus', this.handleFocus);
        this.handleAppStateChangeSubscription?.remove();
        this.backPressSubscription?.remove();
        if (this.startupTimeoutId) {
            clearTimeout(this.startupTimeoutId);
            this.startupTimeoutId = undefined;
        }
    }

    handleAppStateChange = (nextAppState: AppStateStatus) => {
        const { SettingsStore, NostrWalletConnectStore } = this.props;
        const { settings } = SettingsStore;
        const { loginBackground } = settings;
        if (
            nextAppState === 'background' &&
            SettingsStore.loginMethodConfigured() &&
            loginBackground
        ) {
            SettingsStore.setLoginStatus(false);
        } else if (nextAppState === 'inactive') {
            NostrWalletConnectStore.reset();
        } else if (nextAppState === 'active') {
            if (SettingsStore.loginRequired()) {
                this.props.navigation.navigate('Lockscreen');
            } else {
                if (BackendUtils.supportsNostrWalletConnectService()) {
                    NostrWalletConnectStore.initializeService();
                }
                this.getSettingsAndNavigate();
            }
        }
    };

    startListeners() {
        Linking.addEventListener('url', this.handleOpenURL);
    }

    async getSettingsAndNavigate() {
        try {
            this.setState({ loading: true });
            const { SettingsStore, navigation } = this.props;
            const { posStatus, setPosStatus, initialStart } = SettingsStore;

            // This awaits on settings, so should await on Tor being bootstrapped before making requests
            const settings = await SettingsStore.getSettings();
            if (Platform.OS === 'android') {
                const locale = settings.locale || 'en';
                bridgeJavaStrings(locale);
            }

            SystemNavigationBar.setNavigationColor(
                themeColor('background'),
                isLightTheme() ? 'dark' : 'light'
            );
            SystemNavigationBar.setNavigationBarDividerColor(
                themeColor('secondary')
            );
            const loginRequired = SettingsStore.loginRequired();
            const posEnabled =
                settings?.pos?.posEnabled &&
                settings.pos.posEnabled !== PosEnabled.Disabled;

            if (!loginRequired) SettingsStore.setLoginStatus(true);

            if (posEnabled && posStatus === 'inactive' && loginRequired) {
                navigation.navigate('Lockscreen');
            } else if (posEnabled && posStatus === 'unselected') {
                setPosStatus('active');
                if (!this.state.unlocked) {
                    this.startListeners();
                    this.setState({ unlocked: true });
                }
                await this.fetchData();
            } else if (loginRequired) {
                navigation.navigate('Lockscreen');
            } else if (
                settings &&
                settings.nodes &&
                settings.nodes.length > 0
            ) {
                // If select wallet on startup is enabled and this is initial start,
                // navigate to wallet selection screen without activating any wallet
                if (settings.selectNodeOnStartup && initialStart) {
                    // Update UI state but don't connect to any wallet yet
                    if (!this.state.unlocked) {
                        this.setState({ unlocked: true });
                    }
                    // Skip wallet activation by navigating directly to Wallets screen
                    navigation.replace('Wallets', { fromStartup: true });
                    return;
                }

                if (!this.state.unlocked) {
                    this.startListeners();
                    this.setState({ unlocked: true });
                }
                await this.fetchData();
            } else {
                // Only navigate to IntroSplash if Wallet screen is focused
                // to prevent interference when user is on other screens
                // (e.g., setting up a wallet image via WalletConfiguration)
                if (navigation.isFocused()) {
                    navigation.navigate('IntroSplash');
                }
            }
        } finally {
            this.setState({ loading: false });
        }

        setTimeout(() => {
            this.processPendingShareIntent();
        }, 100);
    }

    async fetchData() {
        const {
            AlertStore,
            NodeInfoStore,
            BalanceStore,
            CashuStore,
            ChannelsStore,
            TransactionsStore,
            UTXOsStore,
            ContactStore,
            SettingsStore,
            PosStore,
            FiatStore,
            LSPStore,
            ChannelBackupStore,
            SyncStore,
            LightningAddressStore,
            LnurlPayStore,
            NotesStore,
            SwapStore,
            NostrWalletConnectStore
        } = this.props;
        const {
            settings,
            implementation,
            username,
            password,
            login,
            connecting,
            setConnectingStatus,
            connect,
            connectNWC,
            posStatus,
            walletPassword,
            lndDir,
            embeddedLndNetwork,
            isSqlite,
            updateSettings,
            fetchLock
        } = SettingsStore;
        const { isSyncing } = SyncStore;
        const {
            fiatEnabled,
            pos,
            rescan,
            compactDb,
            recovery,
            lightningAddress,
            embeddedTor,
            initialLoad
        } = settings;
        const expressGraphSyncEnabled =
            settings.expressGraphSync && embeddedLndNetwork === 'Mainnet';

        // ensure we don't run this twice in parallel
        if (fetchLock) return;
        SettingsStore.fetchLock = true;

        let start;
        if (connecting) {
            start = new Date().getTime();
            AlertStore.reset();
            NodeInfoStore.reset();
            BalanceStore.reset();
            ChannelsStore.reset();
            TransactionsStore.reset();
            SyncStore.reset();
            LightningAddressStore.reset();
            LSPStore.reset();
            ChannelBackupStore.reset();
            UTXOsStore.reset();
            ContactStore.loadContacts();
            NotesStore.loadNoteKeys();
            CashuStore.reset();
        }

        LnurlPayStore.reset();

        if (
            pos?.posEnabled &&
            pos.posEnabled !== PosEnabled.Disabled &&
            posStatus === 'active'
        ) {
            PosStore.getOrders();
        }

        if (fiatEnabled) {
            FiatStore.getFiatRates();
        }

        if (implementation === 'embedded-lnd') {
            if (connecting) {
                // Helper to show folder missing alert
                const showFolderMissingAlert = () => {
                    console.log('showFolderMissingAlert called');
                    SettingsStore.setConnectingStatus(false);
                    SettingsStore.setLndFolderMissing(true);
                    Alert.alert(
                        localeString('views.Wallet.lndFolderMissing.title'),
                        localeString('views.Wallet.lndFolderMissing.message'),
                        [
                            {
                                text: localeString(
                                    'views.Wallet.lndFolderMissing.deleteWallet'
                                ),
                                onPress: () =>
                                    this.props.navigation.navigate('Wallets'),
                                style: 'destructive' as const
                            },
                            {
                                text: localeString(
                                    'views.Tools.clearStorage.title'
                                ),
                                onPress: () =>
                                    this.props.navigation.navigate('Tools', {
                                        showClearDataModal: true
                                    })
                            },
                            {
                                text: localeString('general.cancel'),
                                style: 'cancel' as const
                            }
                        ]
                    );
                };

                try {
                    AlertStore.checkNeutrinoPeers();

                    // Skip stopLnd when wallet is already closed (e.g. after delete)
                    if (!recovery && SettingsStore.embeddedLndStarted) {
                        await stopLnd();
                    }

                    if (settings?.ecash?.enableCashu)
                        await CashuStore.initializeWallets();

                    console.log('lndDir', lndDir);

                    try {
                        await initializeLnd({
                            lndDir: lndDir || 'lnd',
                            isTestnet: embeddedLndNetwork === 'Testnet',
                            rescan,
                            compactDb,
                            isSqlite
                        });
                    } catch (initError: any) {
                        // During recovery, initializeLnd may fail because createLndWallet
                        // already set up the directories and config - that's OK, continue
                        if (recovery) {
                            console.log(
                                'initializeLnd failed during recovery (expected):',
                                initError?.message
                            );
                        } else {
                            throw initError;
                        }
                    }
                } catch (error: any) {
                    console.log(
                        'embedded-lnd startup error:',
                        error?.message,
                        error
                    );
                    if (
                        !recovery &&
                        matchesLndErrorCode(
                            error?.message || String(error),
                            LndErrorCode.LND_FOLDER_MISSING
                        )
                    ) {
                        showFolderMissingAlert();
                        return;
                    }
                    throw error;
                }

                // on initial load, do not run EGS
                if (initialLoad) {
                    await updateSettings({
                        initialLoad: false
                    });
                } else {
                    if (expressGraphSyncEnabled) {
                        const expressGraphSyncStart = new Date().getTime();
                        console.log(
                            '[Performance] Express Graph Sync starting...'
                        );

                        await expressGraphSync();

                        const expressGraphSyncDuration =
                            new Date().getTime() - expressGraphSyncStart;
                        console.log(
                            `[Performance] Express Graph Sync completed in ${expressGraphSyncDuration}ms`
                        );

                        if (settings.resetExpressGraphSyncOnStartup) {
                            await updateSettings({
                                resetExpressGraphSyncOnStartup: false
                            });
                        }
                    } else {
                        console.log(
                            '[Performance] Express Graph Sync skipped (disabled) - faster startup'
                        );
                    }
                }

                try {
                    await startLnd({
                        lndDir: lndDir || 'lnd',
                        walletPassword: walletPassword || '',
                        isTorEnabled: embeddedTor,
                        isTestnet: embeddedLndNetwork === 'Testnet',
                        isRecovery: recovery
                    });
                } catch (error: any) {
                    const errorMessage = error?.message ?? '';
                    console.log('startLnd error:', errorMessage);

                    // Handle folder missing error
                    if (
                        matchesLndErrorCode(
                            errorMessage,
                            LndErrorCode.LND_FOLDER_MISSING
                        )
                    ) {
                        showFolderMissingAlert();
                        return;
                    }

                    // Handle LND start failed after max retries - show restart modal
                    if (isLndError(error, LndErrorCode.LND_START_FAILED)) {
                        setConnectingStatus(false);
                        this.props.ModalStore.toggleInfoModal({
                            title: localeString('restart.title'),
                            text: localeString(
                                'views.Wallet.lndStartFailed.message'
                            ),
                            buttons: [
                                {
                                    title: localeString('views.Wallet.restart'),
                                    callback: () => restartNeeded(true)
                                }
                            ]
                        });
                        return;
                    }

                    // Handle transient errors - attempt restart
                    if (isTransientRpcError(errorMessage)) {
                        console.log(
                            'Transient error during startup - attempting restart:',
                            errorMessage
                        );
                        setConnectingStatus(false);
                        await new Promise((resolve) =>
                            setTimeout(resolve, 2000)
                        );
                        setConnectingStatus(true);
                        this.getSettingsAndNavigate();
                        return;
                    }

                    // Fatal error - throw to outer handler
                    console.error('Fatal startLnd error:', error);
                    setConnectingStatus(false);
                    throw error;
                }

                try {
                    const batterySaverEnabled = await isBatterySaverEnabled();
                    if (batterySaverEnabled) {
                        if (Platform.OS === 'ios') {
                            InteractionManager.runAfterInteractions(() => {
                                setTimeout(() => {
                                    this.showBatterySaverModal();
                                }, 500);
                            });
                        } else {
                            this.showBatterySaverModal();
                        }
                    }
                } catch (error) {
                    console.warn('Failed to check battery saver mode:', error);
                }

                if (!this.startupTimeoutId) {
                    this.startupTimeoutId = setTimeout(() => {
                        if (
                            this.props.SettingsStore.connecting &&
                            this.props.SettingsStore.implementation ===
                                'embedded-lnd'
                        ) {
                            try {
                                const message =
                                    Platform.OS === 'ios'
                                        ? localeString(
                                              'views.Wallet.startupSlowMsg.ios'
                                          )
                                        : localeString(
                                              'views.Wallet.startupSlowMsg.android'
                                          );

                                const buttons: AlertButton[] =
                                    Platform.OS === 'ios'
                                        ? [
                                              {
                                                  text: localeString(
                                                      'views.Settings.EmbeddedNode.LNDLogs.title'
                                                  ),
                                                  onPress: () =>
                                                      this.props.navigation.navigate(
                                                          'LNDLogs'
                                                      )
                                              },
                                              {
                                                  text: localeString(
                                                      'general.cancel'
                                                  ),
                                                  style: 'cancel' as const
                                              }
                                          ]
                                        : [
                                              {
                                                  text: localeString(
                                                      'views.Settings.EmbeddedNode.LNDLogs.title'
                                                  ),
                                                  onPress: () =>
                                                      this.props.navigation.navigate(
                                                          'LNDLogs'
                                                      )
                                              },
                                              {
                                                  text: localeString(
                                                      'views.Wallet.restart'
                                                  ),
                                                  style: 'destructive' as const,
                                                  onPress: () =>
                                                      restartNeeded(true)
                                              },
                                              {
                                                  text: localeString(
                                                      'general.cancel'
                                                  ),
                                                  style: 'cancel' as const
                                              }
                                          ];

                                Alert.alert(
                                    localeString(
                                        'views.Wallet.startupSlowTitle'
                                    ),
                                    message,
                                    buttons
                                );
                            } catch (e) {}
                        }
                    }, 60000); // 60 seconds
                }
            }
            try {
                await waitForRpcReady();
                SyncStore.checkRecoveryStatus();
                await NodeInfoStore.getNodeInfo();
                NodeInfoStore.getNetworkInfo();
                await UTXOsStore.listAccounts();
                await BalanceStore.getCombinedBalance(false);
                ChannelsStore.getChannelsWithPolling().then(() => {
                    // Check for sweep to self-custody threshold after channels are online
                    if (settings?.ecash?.enableCashu) {
                        CashuStore.checkAndSweepMints();
                        // Check Cashu balance for upgrade prompts after channels are loaded
                        CashuStore.checkAndShowUpgradeModal(
                            0,
                            CashuStore.totalBalanceSats || 0
                        );
                    }
                });

                if (rescan) {
                    await updateSettings({
                        rescan: false
                    });
                }
                if (recovery) {
                    const isBackedUp = await Storage.getItem(IS_BACKED_UP_KEY);
                    if (!isBackedUp) {
                        await Storage.setItem(IS_BACKED_UP_KEY, true);
                    }
                    if (isSyncing) return;
                    try {
                        await ChannelBackupStore.recoverStaticChannelBackup();
                        await updateSettings({
                            recovery: false
                        });
                        if (
                            SettingsStore.settings
                                .automaticDisasterRecoveryBackup
                        )
                            ChannelBackupStore.initSubscribeChannelEvents();
                    } catch (recoverError) {
                        console.error('recover error', recoverError);
                    }
                } else {
                    if (SettingsStore.settings.automaticDisasterRecoveryBackup)
                        ChannelBackupStore.initSubscribeChannelEvents();
                }
            } catch (rpcError: any) {
                const errorMessage = rpcError?.message ?? '';
                console.error('RPC/Data fetching error:', errorMessage);

                // Handle wallet directory not found (deleted wallet)
                if (
                    matchesLndErrorCode(
                        errorMessage,
                        LndErrorCode.LND_FOLDER_MISSING
                    )
                ) {
                    setConnectingStatus(false);
                    Alert.alert(
                        localeString('views.Wallet.lndFolderMissing.title'),
                        localeString('views.Wallet.lndFolderMissing.message'),
                        [
                            {
                                text: localeString(
                                    'views.Wallet.lndFolderMissing.deleteWallet'
                                ),
                                onPress: () =>
                                    this.props.navigation.navigate('Wallets'),
                                style: 'destructive' as const
                            }
                        ]
                    );
                    return;
                }

                // Handle transient RPC errors - attempt restart
                if (isTransientRpcError(errorMessage)) {
                    console.log(
                        'Transient RPC error - attempting restart:',
                        errorMessage
                    );
                    setConnectingStatus(false);
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                    setConnectingStatus(true);
                    this.getSettingsAndNavigate();
                    return;
                }

                // Fatal error - clear connecting status and re-throw
                console.error('Fatal RPC error:', rpcError);
                setConnectingStatus(false);
                throw rpcError;
            }
        } else if (implementation === 'lndhub') {
            if (connecting) {
                try {
                    await login({ login: username, password });
                    await BalanceStore.getLightningBalance(true);
                } catch (connectionError) {
                    console.log('LNDHub connection failed:', connectionError);
                    return;
                }
            } else {
                BalanceStore.getLightningBalance(true);
            }
        } else if (implementation === 'lightning-node-connect') {
            let error;
            if (connecting) {
                error = await connect();
            }
            if (!error) {
                try {
                    await BackendUtils.checkPerms();
                    await NodeInfoStore.getNodeInfo();
                    if (BackendUtils.supportsAccounts())
                        await UTXOsStore.listAccounts();
                    await BalanceStore.getCombinedBalance();
                    if (BackendUtils.supportsChannelManagement())
                        await ChannelsStore.getChannels();
                } catch (connectionError) {
                    console.log('LNC connection failed:', connectionError);
                    return;
                }
            }
        } else if (implementation === 'nostr-wallet-connect') {
            let error;
            if (connecting) {
                error = await connectNWC();
            }
            if (!error) {
                try {
                    await BalanceStore.getLightningBalance(true);
                } catch (connectionError) {
                    console.log('NWC connection failed:', connectionError);
                    return;
                }
            }
        } else {
            try {
                await NodeInfoStore.getNodeInfo();
                if (BackendUtils.supportsAccounts()) {
                    await UTXOsStore.listAccounts();
                }
                await BalanceStore.getCombinedBalance();
                await ChannelsStore.getChannels();
            } catch (connectionError) {
                console.log('Node connection failed:', connectionError);
                NodeInfoStore.handleGetNodeInfoError();
                setConnectingStatus(false);
                return;
            }
        }

        if (
            lightningAddress.enabled &&
            BackendUtils.supportsCustomPreimages() &&
            !NodeInfoStore.testnet
        ) {
            if (connecting) {
                try {
                    await LightningAddressStore.status();

                    if (settings?.lightningAddress?.automaticallyAccept) {
                        if (
                            LightningAddressStore.lightningAddressType ===
                            'zaplocker'
                        ) {
                            LightningAddressStore.prepareToAutomaticallyAcceptZaplocker();
                        } else if (
                            LightningAddressStore.lightningAddressType ===
                            'cashu'
                        ) {
                            LightningAddressStore.prepareToAutomaticallyAcceptCashu();
                        }
                    }

                    if (
                        // TODO add enum
                        SettingsStore.settings.lightningAddress
                            ?.notifications === 1
                    ) {
                        LightningAddressStore.updatePushCredentials();
                    }
                } catch (e) {
                    console.error('Lightning address error', e);
                }
            }
        }

        // check for swaps after node info is fetched
        if (connecting) {
            SwapStore.getSwapFees();
            SwapStore.fetchAndUpdateSwaps();
        }

        if (connecting && start != null) {
            console.log(
                'connect time: ' + (new Date().getTime() - start) / 1000 + 's'
            );
            setConnectingStatus(false);
            SettingsStore.setInitialStart(false);

            if (this.startupTimeoutId) {
                clearTimeout(this.startupTimeoutId);
                this.startupTimeoutId = undefined;
            }

            try {
                LinkingUtils.processPendingShareIntent(this.props.navigation);
            } catch (error) {
                console.error('Error processing pending share intent:', error);
            }
        }

        if (BackendUtils.supportsFlowLSP()) {
            if (
                SettingsStore.settings.enableLSP &&
                (implementation !== 'lnd' ||
                    !this.props.NodeInfoStore.flowLspNotConfigured)
            ) {
                await LSPStore.getLSPInfo();
            }
            if (BackendUtils.supportsLSPScustomMessage()) {
                LSPStore.subscribeCustomMessages();
            }
            LSPStore.initChannelAcceptor();
        }

        if (connecting && BackendUtils.supportsNostrWalletConnectService()) {
            try {
                NostrWalletConnectStore.initializeService();
            } catch (error) {
                console.warn(
                    'Failed to initialize Nostr Wallet Connect service:',
                    error
                );
            }
        }
        // only navigate to initial url after connection and main calls are made
        if (
            this.state.initialLoad &&
            !(
                SettingsStore.settings.selectNodeOnStartup &&
                SettingsStore.initialStart
            )
        ) {
            this.setState({
                initialLoad: false
            });
            SettingsStore.fetchLock = false;
            LinkingUtils.handleInitialUrl(this.props.navigation);
        }

        SettingsStore.fetchLock = false;

        // Process pending share intent after wallet is fully loaded and synced
        this.processPendingShareIntent();

        // Process pending graph sync payment after wallet is fully loaded and synced
        this.processPendingGraphSyncPayment();
    }

    processPendingShareIntent = () => {
        if (this.state.pendingShareIntent) {
            const { navigation } = this.props;
            const shareIntentData = this.state.pendingShareIntent;

            this.setState({ pendingShareIntent: undefined });

            navigation.navigate('ShareIntentProcessing', shareIntentData);
        }
    };

    private showBatterySaverModal = () => {
        this.props.ModalStore.toggleInfoModal({
            title: localeString('views.Wallet.batterySaverWarningTitle'),
            text: localeString('views.Wallet.batterySaverWarningText')
        });
    };

    processPendingGraphSyncPayment = async () => {
        try {
            const pendingPaymentData = await loadPendingPaymentData();
            if (pendingPaymentData) {
                const { InvoicesStore, navigation } = this.props;

                if (pendingPaymentData.payment_request) {
                    await InvoicesStore.getPayReq(
                        pendingPaymentData.payment_request
                    );
                    navigation.navigate('PaymentRequest', {
                        fromGraphSync: true
                    });
                } else if (pendingPaymentData.pubkey) {
                    navigation.navigate('Send', {
                        destination: pendingPaymentData.pubkey,
                        satAmount: pendingPaymentData.amount,
                        transactionType: 'Keysend',
                        fromGraphSync: true
                    });
                } else {
                    clearPendingPaymentData().catch((error) => {
                        console.error(
                            'Failed to clear invalid pending payment data:',
                            error
                        );
                    });
                }
            }
        } catch (error) {
            console.error(
                'Error processing pending graph sync payment:',
                error
            );
        }
    };

    handleOpenURL = (event: any) => {
        const { navigation } = this.props;
        if (event.url) {
            LinkingUtils.handleDeepLink(event.url, navigation);
        }
    };

    render() {
        const { loading } = this.state;
        const {
            NodeInfoStore,
            BalanceStore,
            CashuStore,
            SettingsStore,
            SyncStore,
            navigation
        } = this.props;
        const { isSyncing, isInExpressGraphSync } = SyncStore;
        const { nodeInfo } = NodeInfoStore;
        const error =
            NodeInfoStore.error || SettingsStore.error || BalanceStore.error;
        const {
            implementation,
            settings,
            loggedIn,
            connecting,
            posStatus,
            setConnectingStatus,
            isMigrating
        } = SettingsStore;
        const loginRequired = !settings || SettingsStore.loginRequired();

        const posEnabled: PosEnabled =
            settings?.pos?.posEnabled || PosEnabled.Disabled;

        const showKeypad: boolean = settings?.pos?.showKeypad || false;

        const dataAvailable =
            implementation === 'lndhub' ||
            implementation === 'nostr-wallet-connect' ||
            nodeInfo.version;

        // Define the type for implementationDisplayValue
        interface ImplementationDisplayValue {
            [key: string]: string;
        }

        const implementationDisplayValue: ImplementationDisplayValue = {};
        INTERFACE_KEYS.forEach((item) => {
            implementationDisplayValue[item.value] = item.key;
        });

        const BalanceScreen = () => {
            return (
                <Screen>
                    <BalancePane
                        navigation={navigation}
                        NodeInfoStore={NodeInfoStore}
                        BalanceStore={BalanceStore}
                        CashuStore={CashuStore}
                        SettingsStore={SettingsStore}
                        SyncStore={SyncStore}
                        loading={loading}
                    />

                    {error && (
                        <View style={{ backgroundColor: themeColor('error') }}>
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: '#fff',
                                    fontSize: 12,
                                    marginBottom: 15,
                                    textAlign: 'center'
                                }}
                            >
                                {`v${version} | ${implementationDisplayValue[implementation]}`}
                            </Text>
                            <Button
                                icon={{
                                    name: 'settings',
                                    size: 25,
                                    color: '#fff'
                                }}
                                title={localeString(
                                    'views.Wallet.BalancePane.goToWalletConfig'
                                )}
                                buttonStyle={{
                                    backgroundColor: 'gray',
                                    marginBottom: 20
                                }}
                                onPress={() => {
                                    const { settings } = SettingsStore;
                                    const selectedNode =
                                        settings.selectedNode || 0;
                                    const node = settings.nodes?.[selectedNode];
                                    protectedNavigation(
                                        navigation,
                                        'WalletConfiguration',
                                        false,
                                        {
                                            node,
                                            index: selectedNode,
                                            active: true,
                                            newEntry: false
                                        }
                                    );
                                }}
                            />
                            <Button
                                title={localeString('views.Wallet.restart')}
                                icon={{
                                    name: 'sync',
                                    size: 25
                                }}
                                onPress={() => {
                                    if (Platform.OS === 'android') {
                                        RNRestart.Restart();
                                    } else {
                                        setConnectingStatus(true);
                                        this.getSettingsAndNavigate();
                                    }
                                }}
                            />
                        </View>
                    )}

                    {dataAvailable && !error && (
                        <>
                            <LayerBalances
                                navigation={navigation}
                                onRefresh={() => this.getSettingsAndNavigate()}
                                consolidated
                            />

                            <Animated.View
                                style={{
                                    position: 'absolute',
                                    bottom: 10,
                                    width: '100%',
                                    height: 80,
                                    transform: [{ translateY: this.pan.y }],
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                                {...this.panResponder.panHandlers}
                            >
                                <TouchableOpacity
                                    onPress={() =>
                                        this.props.navigation.navigate(
                                            'Activity',
                                            { animation: 'slide_from_bottom' }
                                        )
                                    }
                                    accessibilityLabel={localeString(
                                        'general.activity'
                                    )}
                                    style={{
                                        alignItems: 'center',
                                        padding: 10
                                    }}
                                >
                                    <CaretUp fill={themeColor('text')} />
                                    <Text
                                        style={{
                                            marginTop: 7,
                                            textAlign: 'center',
                                            fontFamily: 'PPNeueMontreal-Book',
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString('general.activity')}
                                    </Text>
                                </TouchableOpacity>
                            </Animated.View>
                        </>
                    )}
                </Screen>
            );
        };

        const PosScreen = () => {
            return (
                <Screen>
                    {posEnabled === PosEnabled.Square && (
                        <SquarePosPane navigation={navigation} />
                    )}
                    {posEnabled === PosEnabled.Standalone && (
                        <StandalonePosPane navigation={navigation} />
                    )}
                </Screen>
            );
        };

        const PosKeypadScreen = () => {
            return (
                <Screen>
                    <StandalonePosKeypadPane navigation={navigation} />
                </Screen>
            );
        };

        const KeypadScreen = () => {
            return (
                <Screen>
                    <KeypadPane navigation={navigation} loading={loading} />
                </Screen>
            );
        };

        const CameraScreen: any = () => {};

        const ChannelsScreen = () => {
            return (
                <Screen>
                    <ChannelsPane navigation={navigation} />
                </Screen>
            );
        };

        const Theme = {
            ...DefaultTheme,
            colors: {
                ...DefaultTheme.colors,
                background: themeColor('background'),
                card: error ? themeColor('error') : themeColor('background'),
                border: error ? themeColor('error') : themeColor('background')
            }
        };

        return (
            <View style={{ flex: 1 }}>
                {!connecting &&
                    (!loginRequired || posEnabled !== PosEnabled.Disabled) && (
                        <NavigationIndependentTree>
                            <NavigationContainer
                                theme={Theme}
                                ref={this.tabNavigationRef}
                            >
                                <Tab.Navigator
                                    initialRouteName={
                                        error &&
                                        posEnabled === PosEnabled.Disabled
                                            ? 'Balance'
                                            : posEnabled !==
                                                  PosEnabled.Disabled &&
                                              posStatus === 'active'
                                            ? (settings.pos &&
                                                  settings.pos.defaultView) ||
                                              'Products'
                                            : isSyncing
                                            ? 'Balance'
                                            : (settings.display &&
                                                  settings.display
                                                      .defaultView) ||
                                              'Keypad'
                                    }
                                    backBehavior="none"
                                    screenOptions={({ route }) => ({
                                        tabBarIcon: ({ color }) => {
                                            if (
                                                isSyncing &&
                                                !settings?.ecash?.enableCashu &&
                                                route.name === 'Keypad'
                                            ) {
                                                return;
                                            }
                                            if (route.name === 'Keypad') {
                                                return <Bitcoin fill={color} />;
                                            }
                                            if (route.name === 'Balance') {
                                                return <Temple fill={color} />;
                                            }
                                            if (route.name === 'Products') {
                                                return <POS stroke={color} />;
                                            }
                                            if (route.name === 'POS Keypad') {
                                                return <Bitcoin fill={color} />;
                                            }
                                            if (route.name === 'Camera') {
                                                return (
                                                    <Scan
                                                        fill={color}
                                                        width={20}
                                                    />
                                                );
                                            }
                                            if (
                                                BackendUtils.supportsChannelManagement()
                                            ) {
                                                return (
                                                    <ChannelsIcon
                                                        height={26}
                                                        width={26}
                                                        fill={color}
                                                    />
                                                );
                                            }
                                        },
                                        headerShown: false,
                                        tabBarActiveTintColor: error
                                            ? themeColor('error')
                                            : themeColor('text'),
                                        tabBarInactiveTintColor: error
                                            ? themeColor('error')
                                            : 'gray',
                                        tabBarShowLabel: false,
                                        tabBarStyle: {
                                            paddingBottom: 12
                                        },
                                        // Disable top safe area - WalletHeader handles it
                                        safeAreaInsets: { top: 0 },
                                        // TODO re-enable for iOS once ZEUS-3514 is resolved
                                        animation:
                                            Platform.OS === 'android'
                                                ? 'shift'
                                                : undefined
                                    })}
                                >
                                    {posEnabled !== PosEnabled.Disabled &&
                                    posStatus === 'active' ? (
                                        <Tab.Screen name="Products">
                                            {PosScreen}
                                        </Tab.Screen>
                                    ) : (
                                        <Tab.Screen name="Balance">
                                            {BalanceScreen}
                                        </Tab.Screen>
                                    )}
                                    {posEnabled === PosEnabled.Standalone &&
                                        posStatus === 'active' &&
                                        showKeypad && (
                                            <Tab.Screen name="POS Keypad">
                                                {PosKeypadScreen}
                                            </Tab.Screen>
                                        )}
                                    {posStatus !== 'active' && (
                                        <>
                                            {!error &&
                                                !(
                                                    isSyncing &&
                                                    !settings?.ecash
                                                        ?.enableCashu
                                                ) && (
                                                    <Tab.Screen name="Keypad">
                                                        {KeypadScreen}
                                                    </Tab.Screen>
                                                )}
                                            {BackendUtils.supportsChannelManagement() &&
                                                !error &&
                                                !isSyncing && (
                                                    <Tab.Screen
                                                        name={localeString(
                                                            'views.Wallet.Wallet.channels'
                                                        )}
                                                    >
                                                        {ChannelsScreen}
                                                    </Tab.Screen>
                                                )}
                                        </>
                                    )}
                                    {posStatus !== 'active' && !error && (
                                        <Tab.Screen
                                            name="Camera"
                                            listeners={{
                                                tabPress: (e) => {
                                                    // Prevent default action
                                                    e.preventDefault();
                                                    navigation.navigate(
                                                        'HandleAnythingQRScanner'
                                                    );
                                                }
                                            }}
                                        >
                                            {CameraScreen}
                                        </Tab.Screen>
                                    )}
                                </Tab.Navigator>
                            </NavigationContainer>
                        </NavigationIndependentTree>
                    )}
                {connecting &&
                    (!loginRequired || posEnabled !== PosEnabled.Disabled) && (
                        <Screen>
                            <View
                                style={{
                                    position: 'absolute',
                                    zIndex: 1
                                }}
                            >
                                <WalletHeader
                                    navigation={navigation}
                                    connecting
                                />
                            </View>
                            <View
                                style={{
                                    flex: 1,
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                <LoadingColumns />
                                <View
                                    style={{
                                        position: 'absolute',
                                        bottom: 130
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            alignSelf: 'center',
                                            fontSize: 15,
                                            padding: 8
                                        }}
                                    >
                                        {isMigrating
                                            ? localeString(
                                                  'views.Wallet.Wallet.migrating'
                                              ).replace('Zeus', 'ZEUS')
                                            : CashuStore.initializing
                                            ? CashuStore.loadingMsg
                                            : settings.nodes &&
                                              loggedIn &&
                                              implementation
                                            ? implementation === 'embedded-lnd'
                                                ? isInExpressGraphSync
                                                    ? localeString(
                                                          'views.Wallet.Wallet.expressGraphSync'
                                                      ).replace('Zeus', 'ZEUS')
                                                    : localeString(
                                                          'views.Wallet.Wallet.startingNode'
                                                      ).replace('Zeus', 'ZEUS')
                                                : implementation === 'lndhub' ||
                                                  implementation ===
                                                      'nostr-wallet-connect'
                                                ? localeString(
                                                      'views.Wallet.Wallet.loadingAccount'
                                                  ).replace('Zeus', 'ZEUS')
                                                : localeString(
                                                      'views.Wallet.Wallet.connecting'
                                                  ).replace('Zeus', 'ZEUS')
                                            : localeString(
                                                  'views.Wallet.Wallet.startingUp'
                                              ).replace('Zeus', 'ZEUS')}
                                    </Text>
                                    <View style={{ marginTop: 40 }}>
                                        <LoadingIndicator />
                                    </View>
                                </View>
                            </View>
                            {isInExpressGraphSync && (
                                <View
                                    style={{
                                        bottom: 70,
                                        position: 'absolute',
                                        alignSelf: 'center'
                                    }}
                                >
                                    <Button
                                        title={localeString('general.skip')}
                                        containerStyle={{
                                            width: 320
                                        }}
                                        titleStyle={{
                                            color: themeColor('text')
                                        }}
                                        onPress={() => {
                                            SyncStore.setExpressGraphSyncStatus(
                                                false
                                            );
                                        }}
                                        adaptiveWidth
                                        iconOnly
                                    />
                                </View>
                            )}
                        </Screen>
                    )}
            </View>
        );
    }
}
