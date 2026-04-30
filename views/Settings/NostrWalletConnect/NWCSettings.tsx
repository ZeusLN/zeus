import React from 'react';
import { View, ScrollView, Text, Platform } from 'react-native';
import { Icon } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import Switch from '../../../components/Switch';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';

import SettingsStore from '../../../stores/SettingsStore';
import NostrWalletConnectStore from '../../../stores/NostrWalletConnectStore';
import ModalStore from '../../../stores/ModalStore';
import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';
import BackendUtils from '../../../utils/BackendUtils';
import { restartNeeded } from '../../../utils/RestartUtils';

interface NWCSettingsProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    NostrWalletConnectStore: NostrWalletConnectStore;
    ModalStore: ModalStore;
}

interface NWCSettingsState {
    loading: boolean;
    error: string | null;
    enableCashu: boolean;
    persistentNWCServiceEnabled: boolean;
}

@inject('SettingsStore', 'NostrWalletConnectStore', 'ModalStore')
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
            persistentNWCServiceEnabled: false
        };
    }

    async componentDidMount() {
        const { NostrWalletConnectStore } = this.props;

        this.setState({
            enableCashu: NostrWalletConnectStore.cashuEnabled,
            persistentNWCServiceEnabled:
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
        const current = this.state.persistentNWCServiceEnabled;

        this.setState({ loading: true, error: null });
        try {
            await NostrWalletConnectStore.setPersistentNWCServiceEnabled(
                !current
            );
            this.setState({
                persistentNWCServiceEnabled: !current
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

    showPersistentNWCBackgroundInfo = () => {
        const { ModalStore } = this.props;
        const isIos = Platform.OS === 'ios';
        ModalStore.toggleInfoModal({
            title: localeString(
                'views.Settings.NostrWalletConnect.persistentNWCServiceInfoTitle'
            ),
            text: [
                localeString(
                    isIos
                        ? 'views.Settings.NostrWalletConnect.persistentNWCServiceInfoIntroIOS'
                        : 'views.Settings.NostrWalletConnect.persistentNWCServiceInfoIntroAndroid'
                ),
                localeString(
                    'views.Settings.NostrWalletConnect.persistentNWCServiceInfoBattery'
                ),
                localeString(
                    'views.Settings.NostrWalletConnect.persistentNWCServiceInfoWorkload'
                ),
                localeString(
                    'views.Settings.NostrWalletConnect.persistentNWCServiceInfoRestart'
                )
            ]
        });
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const { loading, error, enableCashu, persistentNWCServiceEnabled } =
            this.state;
        const { settings } = SettingsStore;

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
                            {loading && (
                                <View style={{ marginRight: 10 }}>
                                    <LoadingIndicator size={30} />
                                </View>
                            )}
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
                        {BackendUtils.supportsCashuWallet() &&
                            settings.ecash.enableCashu && (
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
                                                alignSelf: 'center'
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
                        <View style={{ marginTop: 20 }}>
                            <View style={{ flexDirection: 'row' }}>
                                <View
                                    style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'flex-start'
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            fontSize: 17,
                                            flexShrink: 1
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.NostrWalletConnect.persistentNWCService'
                                        )}
                                    </Text>
                                    <Icon
                                        name="info"
                                        onPress={
                                            this.showPersistentNWCBackgroundInfo
                                        }
                                        color={themeColor('text')}
                                        underlayColor="transparent"
                                        size={24}
                                        containerStyle={{ marginLeft: 8 }}
                                    />
                                </View>
                                <View
                                    style={{
                                        alignSelf: 'center'
                                    }}
                                >
                                    <Switch
                                        value={persistentNWCServiceEnabled}
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
                                    Platform.OS === 'ios'
                                        ? 'views.Settings.NostrWalletConnect.persistentNWCServiceDescriptionIOS'
                                        : 'views.Settings.NostrWalletConnect.persistentNWCServiceDescriptionAndroid'
                                )}
                            </Text>
                        </View>
                    </ScrollView>
                )}
            </Screen>
        );
    }
}
