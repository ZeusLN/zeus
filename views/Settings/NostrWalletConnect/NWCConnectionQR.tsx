import React from 'react';
import { View, StyleSheet, Text, ScrollView, Platform } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import Button from '../../../components/Button';
import LoadingIndicator from '../../../components/LoadingIndicator';
import CollapsedQR from '../../../components/CollapsedQR';

import NostrWalletConnectStore from '../../../stores/NostrWalletConnectStore';
import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';

interface NWCConnectionQRProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<'NWCConnectionQR', { connectionId: string; nostrUrl: string }>;
    NostrWalletConnectStore: NostrWalletConnectStore;
}

interface NWCConnectionQRState {
    isConnected: boolean;
}

@inject('NostrWalletConnectStore')
@observer
export default class NWCConnectionQR extends React.Component<
    NWCConnectionQRProps,
    NWCConnectionQRState
> {
    constructor(props: NWCConnectionQRProps) {
        super(props);
        this.state = {
            isConnected: false
        };
    }
    componentDidMount() {
        const { NostrWalletConnectStore, route } = this.props;
        const { connectionId } = route.params;
        NostrWalletConnectStore.startWaitingForConnection(connectionId);
    }

    componentDidUpdate() {
        const { NostrWalletConnectStore, navigation } = this.props;
        if (
            NostrWalletConnectStore.connectionJustSucceeded &&
            !this.state.isConnected
        ) {
            this.setState({ isConnected: true });
            setTimeout(() => {
                navigation.navigate('NostrWalletConnect');
            }, 2000);
        }
    }

    componentWillUnmount() {
        const { NostrWalletConnectStore } = this.props;
        NostrWalletConnectStore.stopWaitingForConnection();
    }

    render() {
        const { navigation, NostrWalletConnectStore, route } = this.props;
        const { nostrUrl } = route.params;
        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    onBack={() => {
                        navigation.pop();
                    }}
                    centerComponent={{
                        text: localeString(
                            'views.Settings.NostrWalletConnect.connectionSecret'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={{
                        paddingHorizontal: 15
                    }}
                >
                    <CollapsedQR
                        value={nostrUrl}
                        showShare={true}
                        hideText={true}
                        expanded
                        iconOnly={true}
                    />

                    {NostrWalletConnectStore.waitingForConnection && (
                        <View style={[styles.loadingContainer]}>
                            <LoadingIndicator />
                            <Text
                                style={[
                                    styles.loadingText,
                                    { color: themeColor('secondaryText') }
                                ]}
                            >
                                {localeString(
                                    'views.Settings.NostrWalletConnect.waitingForAppToConnect'
                                )}
                            </Text>
                        </View>
                    )}

                    {Platform.OS === 'ios' &&
                        NostrWalletConnectStore.iosHandoffInProgress &&
                        NostrWalletConnectStore.iosBackgroundTimeRemaining >
                            0 && (
                            <View style={styles.iosTimerContainer}>
                                <Text
                                    style={[
                                        styles.iosTimerTitle,
                                        { color: themeColor('text') }
                                    ]}
                                >
                                    {localeString(
                                        'views.Settings.NostrWalletConnect.switchToNostrClient'
                                    )}
                                </Text>
                                <View style={styles.timerCircle}>
                                    <Text
                                        style={[
                                            styles.timerText,
                                            { color: themeColor('highlight') }
                                        ]}
                                    >
                                        {
                                            NostrWalletConnectStore.iosBackgroundTimeRemaining
                                        }
                                    </Text>
                                    <Text
                                        style={[
                                            styles.timerLabel,
                                            {
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }
                                        ]}
                                    >
                                        {localeString('models.Invoice.seconds')}
                                    </Text>
                                </View>
                                <Text
                                    style={[
                                        styles.iosTimerSubtitle,
                                        { color: themeColor('secondaryText') }
                                    ]}
                                >
                                    {localeString(
                                        'views.Settings.NostrWalletConnect.backgroundConnectionWindow'
                                    )}
                                </Text>
                            </View>
                        )}

                    {this.state.isConnected && (
                        <View style={[styles.connectedContainer]}>
                            <Text
                                style={[
                                    styles.connectedText,
                                    { color: themeColor('success') }
                                ]}
                            >
                                {localeString(
                                    'views.Settings.NostrWalletConnect.connectedSuccessfully'
                                )}
                            </Text>
                        </View>
                    )}
                    <View style={styles.buttonContainer}>
                        <Button
                            title={localeString('general.close')}
                            onPress={() => {
                                navigation.navigate('NostrWalletConnect');
                            }}
                            secondary
                            noUppercase
                        />
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        paddingVertical: 5,
        borderRadius: 12,
        paddingHorizontal: 10
    },
    loadingText: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book',
        textAlign: 'center',
        marginTop: 12,
        fontWeight: '500'
    },
    buttonContainer: {
        width: '100%',
        alignItems: 'center'
    },
    connectedContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
        paddingVertical: 20,
        paddingHorizontal: 24
    },
    connectedText: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book',
        textAlign: 'center',
        fontWeight: '600'
    },
    iosTimerContainer: {
        alignItems: 'center',
        marginVertical: 16,
        paddingVertical: 16
    },
    iosTimerTitle: {
        fontSize: 18,
        fontFamily: 'PPNeueMontreal-Book',
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 16
    },
    timerCircle: {
        width: 70,
        height: 70,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 12
    },
    timerText: {
        fontSize: 36,
        fontFamily: 'PPNeueMontreal-Book',
        fontWeight: '700'
    },
    timerLabel: {
        fontSize: 12,
        fontFamily: 'PPNeueMontreal-Book',
        marginTop: 4
    },
    iosTimerSubtitle: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book',
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 20
    }
});
