import React from 'react';
import { View, ScrollView, Text, Platform } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

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
import { restartNeeded } from '../../../utils/RestartUtils';

interface NWCSettingsProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    NostrWalletConnectStore: NostrWalletConnectStore;
}

interface NWCSettingsState {
    loading: boolean;
    error: string | null;
    enableCashu: boolean;
    persistentNWCService: boolean;
}

@inject('SettingsStore', 'NostrWalletConnectStore')
@observer
export default class NWCSettings extends React.Component<
    NWCSettingsProps,
    NWCSettingsState
> {
    constructor(props: NWCSettingsProps) {
        super(props);
        this.state = {
            loading: false,
            error: null,
            enableCashu: false,
            persistentNWCService: false
        };
    }

    async UNSAFE_componentWillMount() {
        const { NostrWalletConnectStore } = this.props;

        this.setState({
            enableCashu: NostrWalletConnectStore.cashuEnabled,
            persistentNWCService:
                NostrWalletConnectStore.persistentNWCServiceEnabled
        });
    }

    toggleCashuWallet = async () => {
        const { NostrWalletConnectStore } = this.props;
        const currentEnableCashu = this.state.enableCashu;

        this.setState({ loading: true, error: null });
        try {
            await NostrWalletConnectStore.setCashuEnabled(!currentEnableCashu);
            this.setState({ enableCashu: !currentEnableCashu });
        } catch (error) {
            console.error('Failed to toggle Cashu wallet:', error);
            this.setState({ error: 'Failed to update settings' });
        } finally {
            this.setState({ loading: false });
        }
    };

    togglePersistentNWCService = async () => {
        const { NostrWalletConnectStore } = this.props;
        const currentPersistentNWCService = this.state.persistentNWCService;

        this.setState({ loading: true, error: null });
        try {
            await NostrWalletConnectStore.setPersistentNWCServiceEnabled(
                !currentPersistentNWCService
            );
            this.setState({
                persistentNWCService: !currentPersistentNWCService
            });
            restartNeeded();
        } catch (error) {
            console.error('Failed to toggle persistent NWC service:', error);
            this.setState({
                error: 'Failed to update persistent service setting'
            });
        } finally {
            this.setState({ loading: false });
        }
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const { loading, error, enableCashu, persistentNWCService } =
            this.state;
        const supportsCashu = BackendUtils.supportsCashuWallet();

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'views.Settings.NostrWalletConnect.nwcSettings'
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
                        {Platform.OS === 'android' && (
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
                                                'views.Settings.NostrWalletConnect.persistentNWCService'
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
                                            value={persistentNWCService}
                                            onValueChange={
                                                this.togglePersistentNWCService
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
                                        'views.Settings.NostrWalletConnect.persistentNWCServiceDescription'
                                    )}
                                </Text>
                            </View>
                        )}

                        {BackendUtils.supportsCashuWallet() && supportsCashu && (
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
                        )}
                    </ScrollView>
                )}
            </Screen>
        );
    }
}
