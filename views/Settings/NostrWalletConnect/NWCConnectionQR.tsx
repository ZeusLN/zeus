import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
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
        console.log('Started waiting for connection:', connectionId);
    }

    componentDidUpdate(prevProps: NWCConnectionQRProps) {
        const { NostrWalletConnectStore, navigation } = this.props;
        if (
            prevProps.NostrWalletConnectStore.waitingForConnection &&
            !NostrWalletConnectStore.waitingForConnection
        ) {
            this.setState({ isConnected: true });
            setTimeout(() => {
                navigation.navigate('ConnectionsList');
            }, 1500);
        }
    }

    componentWillUnmount() {
        const { NostrWalletConnectStore } = this.props;
        NostrWalletConnectStore.stopWaitingForConnection();
    }

    render() {
        const { navigation, NostrWalletConnectStore, route } = this.props;
        const { connectionId, nostrUrl } = route.params;
        const connection = NostrWalletConnectStore.getConnection(connectionId);

        return (
            <Screen>
                <Header
                    leftComponent="Back"
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

                <View style={[styles.container]}>
                    <View style={styles.content}>
                        <View style={styles.header}>
                            <Text
                                style={[
                                    styles.title,
                                    { color: themeColor('text') }
                                ]}
                            >
                                {localeString(
                                    'views.Settings.NostrWalletConnect.connectionSecretCreated'
                                )}
                            </Text>
                            {connection && (
                                <Text
                                    style={[
                                        styles.subtitle,
                                        { color: themeColor('secondaryText') }
                                    ]}
                                >
                                    {connection.name}
                                </Text>
                            )}
                        </View>

                        <View style={styles.qrContainer}>
                            <CollapsedQR
                                value={nostrUrl}
                                showShare={true}
                                copyText={localeString(
                                    'views.Settings.NostrWalletConnect.copyUrl'
                                )}
                                expanded={true}
                                iconOnly={true}
                                hideText={true}
                            />
                        </View>

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
                            <View
                                style={[
                                    styles.connectedContainer,
                                    {
                                        backgroundColor: themeColor('success'),
                                        borderColor: themeColor('success')
                                    }
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.connectedText,
                                        { color: themeColor('text') }
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
                                    NostrWalletConnectStore.stopWaitingForConnection();
                                    navigation.goBack();
                                }}
                                buttonStyle={[
                                    styles.closeButton,
                                    {
                                        backgroundColor: themeColor('secondary')
                                    }
                                ]}
                                titleStyle={{
                                    ...styles.closeButtonText,
                                    color: themeColor('secondary')
                                }}
                            />
                        </View>
                    </View>
                </View>
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
    closeButton: {
        borderRadius: 12,
        paddingVertical: 12,
        minWidth: 120
    },
    closeButtonText: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book',
        fontWeight: '600'
    },
    connectedContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
        paddingVertical: 20,
        borderRadius: 12,
        paddingHorizontal: 24,
        borderWidth: 1
    },
    connectedText: {
        fontSize: 18,
        fontFamily: 'PPNeueMontreal-Book',
        textAlign: 'center',
        fontWeight: '600'
    }
});
