import React from 'react';
import {
    View,
    StyleSheet,
    Text,
    ScrollView,
    AppState,
    AppStateStatus,
    NativeEventSubscription
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Route } from '@react-navigation/native';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import Button from '../../../components/Button';
import LoadingIndicator from '../../../components/LoadingIndicator';
import CollapsedQR from '../../../components/CollapsedQR';
import ModalBox from '../../../components/ModalBox';

import NostrWalletConnectStore from '../../../stores/NostrWalletConnectStore';
import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';
import { font } from '../../../utils/FontUtils';
import AlertIcon from '../../../assets/images/SVG/Alert.svg';
import SuccessAnimation from '../../../components/SuccessAnimation';

interface NWCConnectionQRProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<
        'NWCConnectionQR',
        { connectionId: string; nostrUrl?: string }
    >;
    NostrWalletConnectStore: NostrWalletConnectStore;
}

interface NWCConnectionQRState {
    isConnected: boolean;
    appState: AppStateStatus;
    showTimeoutMessage: boolean;
    nostrUrl: string | null;
    loadingUrl: boolean;
    urlUnavailable: boolean;
}
const CONNECTION_TIMEOUT_MS = 20000;
const CONNECTED_REDIRECT_MS = 2000;

@inject('NostrWalletConnectStore')
@observer
export default class NWCConnectionQR extends React.Component<
    NWCConnectionQRProps,
    NWCConnectionQRState
> {
    appStateSubscription: NativeEventSubscription | null = null;
    connectionTimeout: ReturnType<typeof setTimeout> | null = null;
    navigateBackTimeout: ReturnType<typeof setTimeout> | null = null;
    isUnmounted = false;
    // True when this screen was opened to re-display an existing
    // connection's secret (no nostrUrl route param) rather than right
    // after creating/regenerating one. In this mode the connection is
    // already paired, so the waiting-for-first-connection flow (spinner,
    // timeout modal, success redirect) does not apply.
    isViewOnly: boolean;

    constructor(props: NWCConnectionQRProps) {
        super(props);
        this.isViewOnly = !props.route.params.nostrUrl;
        this.state = {
            isConnected: false,
            appState: AppState.currentState,
            showTimeoutMessage: false,
            nostrUrl: props.route.params.nostrUrl ?? null,
            loadingUrl: !props.route.params.nostrUrl,
            urlUnavailable: false
        };
    }

    componentDidMount() {
        const { NostrWalletConnectStore, route } = this.props;
        const { connectionId } = route.params;
        this.appStateSubscription = AppState.addEventListener(
            'change',
            this.handleAppStateChange
        );

        if (!this.isViewOnly) {
            NostrWalletConnectStore.startWaitingForConnection(connectionId);
            this.connectionTimeout = setTimeout(() => {
                if (
                    NostrWalletConnectStore.waitingForConnection &&
                    !NostrWalletConnectStore.connectionJustSucceeded
                ) {
                    this.setState({ showTimeoutMessage: true });
                }
            }, CONNECTION_TIMEOUT_MS);
        }

        if (!this.state.nostrUrl) {
            NostrWalletConnectStore.getConnectionUrl(connectionId)
                .then((nostrUrl) => {
                    if (this.isUnmounted) return;
                    this.setState({
                        nostrUrl,
                        loadingUrl: false,
                        urlUnavailable: !nostrUrl
                    });
                })
                .catch((error) => {
                    console.error(
                        'Failed to load NWC connection secret:',
                        error
                    );
                    if (this.isUnmounted) return;
                    this.setState({
                        nostrUrl: null,
                        loadingUrl: false,
                        urlUnavailable: true
                    });
                });
        }
    }

    componentDidUpdate() {
        const { NostrWalletConnectStore, navigation } = this.props;
        if (
            !this.isViewOnly &&
            NostrWalletConnectStore.connectionJustSucceeded &&
            !this.state.isConnected
        ) {
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            this.setState({ isConnected: true, showTimeoutMessage: false });
            this.navigateBackTimeout = setTimeout(() => {
                navigation.popTo('NostrWalletConnect');
            }, CONNECTED_REDIRECT_MS);
        }
    }

    componentWillUnmount() {
        const { NostrWalletConnectStore } = this.props;
        this.isUnmounted = true;
        NostrWalletConnectStore.cancelWaitingForConnection();
        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
        }
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        if (this.navigateBackTimeout) {
            clearTimeout(this.navigateBackTimeout);
            this.navigateBackTimeout = null;
        }
    }

    handleAppStateChange = (nextAppState: AppStateStatus) => {
        this.setState({ appState: nextAppState });
    };

    handleContinueWaiting = () => {
        const { NostrWalletConnectStore } = this.props;

        this.setState({ showTimeoutMessage: false });

        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
        }
        this.connectionTimeout = setTimeout(() => {
            if (
                NostrWalletConnectStore.waitingForConnection &&
                !NostrWalletConnectStore.connectionJustSucceeded
            ) {
                this.setState({ showTimeoutMessage: true });
            }
        }, CONNECTION_TIMEOUT_MS);
    };

    handleGoBack = () => {
        const { navigation } = this.props;
        this.setState({ showTimeoutMessage: false });
        if (this.isViewOnly) {
            navigation.goBack();
        } else {
            navigation.popTo('NostrWalletConnect');
        }
    };

    renderConnectedSuccess = () => (
        <View style={styles.connectedContainer}>
            <View style={styles.connectedAnimationWrap}>
                <SuccessAnimation />
            </View>
            <Text
                style={[styles.connectedTitle, { color: themeColor('text') }]}
            >
                {localeString(
                    'views.Settings.NostrWalletConnect.connectedSuccessfully'
                )}
            </Text>
            <Text
                style={[
                    styles.connectedSubtitle,
                    { color: themeColor('secondaryText') }
                ]}
            >
                {localeString(
                    'views.Settings.NostrWalletConnect.returningToConnections'
                )}
            </Text>
        </View>
    );

    renderWaitingStatus = () => {
        const { NostrWalletConnectStore } = this.props;

        if (!NostrWalletConnectStore.waitingForConnection) {
            return null;
        }

        return (
            <View style={styles.statusContainer}>
                <LoadingIndicator size={36} />
                <Text
                    style={[
                        styles.statusText,
                        { color: themeColor('secondaryText') }
                    ]}
                >
                    {localeString(
                        'views.Settings.NostrWalletConnect.waitingForAppToConnect'
                    )}
                </Text>
            </View>
        );
    };

    renderConnectionContent = (nostrUrl: string) => (
        <>
            <Text
                style={[
                    styles.description,
                    { color: themeColor('secondaryText') }
                ]}
            >
                {localeString(
                    'views.Settings.NostrWalletConnect.connectionSecretDescription'
                )}
            </Text>

            <View style={styles.qrCard}>
                <CollapsedQR value={nostrUrl} hideText={true} expanded />
            </View>

            {this.isViewOnly ? (
                <View style={styles.goBackButton}>
                    <Button
                        title={localeString('general.goBack')}
                        onPress={this.handleGoBack}
                        secondary
                        noUppercase
                    />
                </View>
            ) : (
                this.renderWaitingStatus()
            )}
        </>
    );

    renderLoadingUrl = () => (
        <View style={styles.statusContainer}>
            <LoadingIndicator size={36} />
        </View>
    );

    renderUrlUnavailable = () => (
        <>
            <Text
                style={[
                    styles.description,
                    { color: themeColor('secondaryText') }
                ]}
            >
                {localeString(
                    'views.Settings.NostrWalletConnect.connectionSecretUnavailable'
                )}
            </Text>
            {this.isViewOnly && (
                <View style={styles.goBackButton}>
                    <Button
                        title={localeString('general.goBack')}
                        onPress={this.handleGoBack}
                        secondary
                        noUppercase
                    />
                </View>
            )}
        </>
    );

    render() {
        const { NostrWalletConnectStore } = this.props;
        const { isConnected, nostrUrl, loadingUrl, urlUnavailable } =
            this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    navigateBackOnBackPress={false}
                    onBack={this.handleGoBack}
                    centerComponent={{
                        text: localeString(
                            'views.Settings.NostrWalletConnect.connectionSecret'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                />
                <View style={styles.main}>
                    <ScrollView
                        style={styles.scroll}
                        contentContainerStyle={[
                            styles.scrollContent,
                            isConnected && styles.scrollContentConnected
                        ]}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {isConnected
                            ? this.renderConnectedSuccess()
                            : loadingUrl
                            ? this.renderLoadingUrl()
                            : urlUnavailable || !nostrUrl
                            ? this.renderUrlUnavailable()
                            : this.renderConnectionContent(nostrUrl)}
                    </ScrollView>

                    {!isConnected && !this.isViewOnly && (
                        <View
                            style={[
                                styles.footer,
                                { backgroundColor: themeColor('background') }
                            ]}
                        >
                            <Button
                                title={localeString('general.close')}
                                onPress={this.handleGoBack}
                                secondary
                                noUppercase
                            />
                        </View>
                    )}
                </View>

                <ModalBox
                    isOpen={
                        this.state.showTimeoutMessage &&
                        NostrWalletConnectStore.waitingForConnection
                    }
                    style={styles.modalBackdrop}
                    onClosed={() =>
                        this.setState({ showTimeoutMessage: false })
                    }
                    backdropPressToClose={false}
                    swipeToClose={false}
                >
                    <View style={styles.modalOverlay}>
                        <View
                            style={[
                                styles.modalContainer,
                                {
                                    backgroundColor:
                                        themeColor('modalBackground')
                                }
                            ]}
                        >
                            <View style={styles.modalIconContainer}>
                                <AlertIcon
                                    fill={themeColor('highlight')}
                                    width={42}
                                    height={42}
                                />
                            </View>
                            <Text
                                style={[
                                    styles.modalTitle,
                                    { color: themeColor('text') }
                                ]}
                            >
                                {localeString(
                                    'views.Settings.NostrWalletConnect.connectionTimeout'
                                )}
                            </Text>
                            <Text
                                style={[
                                    styles.modalMessage,
                                    { color: themeColor('secondaryText') }
                                ]}
                            >
                                {localeString(
                                    'views.Settings.NostrWalletConnect.noEventReceivedTimeoutDescription'
                                )}
                            </Text>
                            <View style={styles.modalButtonsContainer}>
                                <View style={styles.modalButton}>
                                    <Button
                                        title={localeString(
                                            'views.Settings.NostrWalletConnect.keepWaiting'
                                        )}
                                        onPress={this.handleContinueWaiting}
                                    />
                                </View>
                                <View style={styles.modalButton}>
                                    <Button
                                        title={localeString('general.goBack')}
                                        onPress={this.handleGoBack}
                                        secondary
                                    />
                                </View>
                            </View>
                        </View>
                    </View>
                </ModalBox>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    main: {
        flex: 1
    },
    scroll: {
        flex: 1
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 24,
        alignItems: 'center'
    },
    scrollContentConnected: {
        justifyContent: 'center'
    },
    description: {
        fontSize: 15,
        fontFamily: 'PPNeueMontreal-Book',
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 340
    },
    qrCard: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 20,
        paddingVertical: 20,
        paddingHorizontal: 12,
        alignItems: 'center'
    },
    goBackButton: {
        width: '100%',
        maxWidth: 340,
        marginTop: 20
    },
    statusContainer: {
        marginTop: 28,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: 16,
        maxWidth: 340
    },
    statusText: {
        fontSize: 15,
        fontFamily: 'PPNeueMontreal-Book',
        textAlign: 'center',
        lineHeight: 22
    },
    connectedContainer: {
        flex: 1,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40
    },
    connectedAnimationWrap: {
        alignItems: 'center',
        marginBottom: 15
    },
    connectedTitle: {
        fontSize: 28,
        fontFamily: font('marlideBold'),
        textAlign: 'center',
        marginBottom: 8
    },
    connectedSubtitle: {
        fontSize: 15,
        fontFamily: 'PPNeueMontreal-Book',
        textAlign: 'center',
        lineHeight: 22
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16
    },
    modalBackdrop: {
        backgroundColor: 'transparent',
        minHeight: 200,
        zIndex: 9999
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalContainer: {
        borderRadius: 30,
        paddingHorizontal: 28,
        paddingTop: 32,
        paddingBottom: 28,
        width: '90%',
        maxWidth: 400,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8
    },
    modalIconContainer: {
        marginBottom: 16,
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalTitle: {
        fontSize: 26,
        fontFamily: font('marlideBold'),
        textAlign: 'center',
        marginBottom: 12
    },
    modalMessage: {
        fontSize: 15,
        fontFamily: 'PPNeueMontreal-Book',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28
    },
    modalButtonsContainer: {
        width: '100%',
        alignItems: 'center'
    },
    modalButton: {
        width: '100%',
        marginBottom: 12
    }
});
