import React from 'react';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
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
                        copyText={localeString(
                            'views.Settings.NostrWalletConnect.copyUrl'
                        )}
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
    container: {
        flex: 1
    },
    content: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
        alignItems: 'center'
    },
    header: {
        alignItems: 'center',
        marginBottom: 40
    },
    title: {
        fontSize: 24,
        fontFamily: 'PPNeueMontreal-Book',
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 8
    },
    subtitle: {
        fontSize: 18,
        fontFamily: 'PPNeueMontreal-Book',
        textAlign: 'center'
    },
    qrContainer: {
        marginBottom: 40
    },
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
    }
});
