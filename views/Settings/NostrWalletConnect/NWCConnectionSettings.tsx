import React from 'react';
import { View, ScrollView, Text } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import Switch from '../../../components/Switch';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';

import SettingsStore from '../../../stores/SettingsStore';
import NostrWalletConnectStore from '../../../stores/NostrWalletConnectStore';
import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';
import BackendUtils from '../../../utils/BackendUtils';

interface NWCConnectionSettingsProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<'NWCConnectionSettings', { connectionId: string }>;
    SettingsStore: SettingsStore;
    NostrWalletConnectStore: NostrWalletConnectStore;
}

interface NWCConnectionSettingsState {
    loading: boolean;
    error: string | null;
    enableCashu: boolean;
    connectionId: string | null;
}

@inject('SettingsStore', 'NostrWalletConnectStore')
@observer
export default class NWCConnectionSettings extends React.Component<
    NWCConnectionSettingsProps,
    NWCConnectionSettingsState
> {
    constructor(props: NWCConnectionSettingsProps) {
        super(props);
        this.state = {
            loading: false,
            error: null,
            enableCashu: false,
            connectionId: null
        };
    }

    async UNSAFE_componentWillMount() {
        const { NostrWalletConnectStore, route } = this.props;
        const connectionId = route.params?.connectionId;

        let connectionCashuSetting = false;
        if (connectionId) {
            const connection =
                NostrWalletConnectStore.getConnection(connectionId);
            connectionCashuSetting = connection?.settings?.enableCashu || false;
        }

        this.setState({
            enableCashu: connectionCashuSetting,
            connectionId: connectionId || null
        });
    }

    toggleCashuWallet = async () => {
        const { NostrWalletConnectStore } = this.props;
        const currentEnableCashu = this.state.enableCashu;
        const { connectionId } = this.state;

        this.setState({ loading: true, error: null });
        try {
            if (connectionId) {
                await NostrWalletConnectStore.updateConnection(connectionId, {
                    settings: {
                        enableCashu: !currentEnableCashu
                    }
                });
            }

            this.setState({ enableCashu: !currentEnableCashu });
        } catch (error) {
            console.error('Failed to toggle Cashu wallet:', error);
            this.setState({ error: 'Failed to update settings' });
        } finally {
            this.setState({ loading: false });
        }
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const { loading, error, enableCashu } = this.state;
        const supportsCashu = BackendUtils.supportsCashuWallet();

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'views.Settings.NostrWalletConnect.ConnectionSettings'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}
                        >
                            {loading && <LoadingIndicator size={30} />}
                        </View>
                    }
                    navigation={navigation}
                />

                {error ? (
                    <ErrorMessage message={error} dismissable />
                ) : (
                    <ScrollView
                        style={{
                            flex: 1,
                            paddingHorizontal: 15,
                            marginTop: 5
                        }}
                    >
                        {supportsCashu ? (
                            <View style={{ marginTop: 20 }}>
                                <View style={{ flexDirection: 'row' }}>
                                    <View
                                        style={{
                                            flex: 1,
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: themeColor('text'),
                                                fontSize: 17
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.NostrWalletConnect.switchToCashuWallet'
                                            )}
                                        </Text>
                                    </View>
                                    <View
                                        style={{
                                            alignSelf: 'center',
                                            marginLeft: 5
                                        }}
                                    >
                                        <Switch
                                            value={enableCashu}
                                            onValueChange={
                                                this.toggleCashuWallet
                                            }
                                            disabled={
                                                SettingsStore.settingsUpdateInProgress ||
                                                loading
                                            }
                                        />
                                    </View>
                                </View>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontSize: 14,
                                        marginTop: 8,
                                        lineHeight: 20
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.NostrWalletConnect.cashuWalletDescription'
                                    )}
                                </Text>
                            </View>
                        ) : (
                            <View
                                style={{
                                    marginTop: 20,
                                    alignItems: 'center',
                                    paddingHorizontal: 20
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontSize: 16,
                                        textAlign: 'center',
                                        lineHeight: 24
                                    }}
                                >
                                    {!supportsCashu
                                        ? localeString(
                                              'views.Settings.NostrWalletConnect.cashuNotSupported'
                                          )
                                        : localeString(
                                              'views.Settings.NostrWalletConnect.noSettingsAvailable'
                                          )}
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                )}
            </Screen>
        );
    }
}
