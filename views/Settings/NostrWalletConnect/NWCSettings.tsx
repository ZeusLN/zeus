import React from 'react';
import {
    View,
    ScrollView,
    Text,
    Platform,
    TouchableOpacity,
    ActivityIndicator
} from 'react-native';
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
import IOSAudioKeepAliveUtils, {
    AudioTrack
} from '../../../utils/IOSAudioKeepAliveUtils';

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
    lud16Enabled: boolean;
    // iOS background audio track picker
    availableTracks: AudioTrack[];
    selectedTrackIndex: number;
    previewingIndex: number | null;
    previewStartedSession: boolean;
    previewLoading: boolean;
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
            persistentNWCServiceEnabled: false,
            lud16Enabled: true,
            availableTracks: [],
            selectedTrackIndex: 0,
            previewingIndex: null,
            previewStartedSession: false,
            previewLoading: false
        };
    }

    async componentDidMount() {
        const { NostrWalletConnectStore } = this.props;

        await NostrWalletConnectStore.loadLud16Enabled();

        this.setState({
            enableCashu: NostrWalletConnectStore.cashuEnabled,
            persistentNWCServiceEnabled:
                NostrWalletConnectStore.persistentNWCServiceEnabled,
            lud16Enabled: NostrWalletConnectStore.lud16Enabled
        });

        if (Platform.OS === 'ios' && IOSAudioKeepAliveUtils.isAvailable()) {
            this.loadAudioTracks();
        }
    }

    componentWillUnmount() {
        if (
            this.state.previewStartedSession ||
            this.state.previewingIndex !== null
        ) {
            this.stopSettingsPreview(this.state.selectedTrackIndex, true);
        }
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
            this.setState({
                error: localeString(
                    'views.Settings.NostrWalletConnect.error.failedToUpdateNwcSetting'
                )
            });
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
            this.setState({ persistentNWCServiceEnabled: !current });
            restartNeeded();
        } catch (error) {
            console.error('Failed to toggle persistent NWC service:', error);
            this.setState({
                error: localeString(
                    'views.Settings.NostrWalletConnect.error.failedToUpdateNwcSetting'
                )
            });
        } finally {
            this.setState({ loading: false });
        }
    };

    toggleLud16Enabled = async () => {
        const { NostrWalletConnectStore } = this.props;
        const current = this.state.lud16Enabled;

        this.setState({ loading: true, error: null });
        try {
            await NostrWalletConnectStore.setLud16Enabled(!current);
            this.setState({ lud16Enabled: !current });
        } catch (error) {
            console.error('Failed to toggle include LUD-16 in NWC URL:', error);
            this.setState({
                error: localeString(
                    'views.Settings.NostrWalletConnect.error.failedToUpdateNwcSetting'
                )
            });
        } finally {
            this.setState({ loading: false });
        }
    };

    showPersistentNWCBackgroundInfo = () => {
        const { ModalStore } = this.props;
        ModalStore.toggleInfoModal({
            title: localeString(
                'views.Settings.NostrWalletConnect.persistentNWCServiceInfoTitle'
            ),
            text: [
                localeString(
                    'views.Settings.NostrWalletConnect.persistentNWCServiceInfoIntroAndroid'
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

    loadAudioTracks = async () => {
        const [tracks, status] = await Promise.all([
            IOSAudioKeepAliveUtils.getAvailableTracks(),
            IOSAudioKeepAliveUtils.getStatus()
        ]);
        if (tracks) {
            this.setState({
                availableTracks: tracks,
                selectedTrackIndex: status?.currentTrackIndex ?? 0
            });
        }
    };
    stopSettingsPreview = async (
        persistTrackIndex: number,
        skipStateUpdate: boolean = false
    ) => {
        const { NostrWalletConnectStore } = this.props;
        const { previewStartedSession } = this.state;
        const status = await IOSAudioKeepAliveUtils.getStatus();
        const liveNwc = NostrWalletConnectStore.iosAudioKeepAliveActive;

        if (previewStartedSession) {
            await IOSAudioKeepAliveUtils.stop();
            await IOSAudioKeepAliveUtils.setTrack(persistTrackIndex);
        } else if (liveNwc && status?.playerPlaying) {
            await IOSAudioKeepAliveUtils.setMuted(true);
        } else if (status?.isActive && status?.playerPlaying) {
            await IOSAudioKeepAliveUtils.stop();
            await IOSAudioKeepAliveUtils.setTrack(persistTrackIndex);
        }

        if (!skipStateUpdate) {
            this.setState({
                previewingIndex: null,
                previewStartedSession: false,
                selectedTrackIndex: persistTrackIndex
            });
        }
    };

    selectTrack = async (index: number) => {
        const { previewingIndex } = this.state;

        if (previewingIndex !== null && index !== previewingIndex) {
            await this.stopSettingsPreview(index);
            return;
        }

        this.setState({ selectedTrackIndex: index });

        const { NostrWalletConnectStore } = this.props;
        const sessionActive =
            this.state.previewingIndex !== null ||
            NostrWalletConnectStore.iosAudioKeepAliveActive;

        if (!sessionActive) {
            await IOSAudioKeepAliveUtils.setTrack(index);
        }
    };

    togglePreview = async (index: number) => {
        const { previewingIndex, previewStartedSession, selectedTrackIndex } =
            this.state;
        const { NostrWalletConnectStore } = this.props;

        // Stop button – always silence playback (native loops until stopped).
        if (previewingIndex === index) {
            await this.stopSettingsPreview(selectedTrackIndex);
            return;
        }

        this.setState({ previewLoading: true, previewingIndex: index });

        // Settings preview: stop any previous session before starting the new
        // looping track so only one plays at a time.
        if (previewStartedSession) {
            await IOSAudioKeepAliveUtils.stop();
            const status = await IOSAudioKeepAliveUtils.start();
            if (!status?.isActive) {
                this.setState({
                    previewingIndex: null,
                    previewLoading: false,
                    previewStartedSession: false
                });
                return;
            }
            await IOSAudioKeepAliveUtils.setMuted(false);
            await IOSAudioKeepAliveUtils.setTrack(index);
            this.setState({
                previewingIndex: index,
                selectedTrackIndex: index,
                previewStartedSession: true,
                previewLoading: false
            });
            return;
        }

        if (NostrWalletConnectStore.iosAudioKeepAliveActive) {
            await IOSAudioKeepAliveUtils.setMuted(false);
            await IOSAudioKeepAliveUtils.setTrack(index);
            this.setState({
                previewingIndex: index,
                selectedTrackIndex: index,
                previewLoading: false
            });
            return;
        }

        const status = await IOSAudioKeepAliveUtils.start();
        if (!status?.isActive) {
            this.setState({
                previewingIndex: null,
                previewLoading: false
            });
            return;
        }
        await IOSAudioKeepAliveUtils.setMuted(false);
        await IOSAudioKeepAliveUtils.setTrack(index);
        this.setState({
            previewingIndex: index,
            selectedTrackIndex: index,
            previewStartedSession: true,
            previewLoading: false
        });
    };

    renderAudioTrackPicker() {
        const {
            availableTracks,
            selectedTrackIndex,
            previewingIndex,
            previewLoading
        } = this.state;

        if (!IOSAudioKeepAliveUtils.isAvailable()) return null;

        const textColor = themeColor('text');
        const secondaryText = themeColor('secondaryText');
        const highlight = themeColor('highlight');
        const separator = themeColor('separator');

        return (
            <View style={{ marginTop: 28 }}>
                <Text
                    style={{
                        color: textColor,
                        fontSize: 17,
                        fontFamily: 'PPNeueMontreal-Book'
                    }}
                >
                    {localeString(
                        'views.Settings.NostrWalletConnect.backgroundAudio'
                    )}
                </Text>
                <Text
                    style={{
                        color: secondaryText,
                        fontSize: 14,
                        marginTop: 8,
                        lineHeight: 20,
                        fontFamily: 'PPNeueMontreal-Book'
                    }}
                >
                    {localeString(
                        'views.Settings.NostrWalletConnect.backgroundAudioDescription'
                    )}
                </Text>

                <View style={{ marginTop: 16 }}>
                    {availableTracks.map((track) => {
                        const isSelected = selectedTrackIndex === track.index;
                        const isPreviewing = previewingIndex === track.index;

                        return (
                            <View
                                key={track.index}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 13,
                                    borderBottomWidth: 1,
                                    borderBottomColor: separator
                                }}
                            >
                                <TouchableOpacity
                                    onPress={() =>
                                        this.togglePreview(track.index)
                                    }
                                    hitSlop={8}
                                    style={{
                                        marginRight: 14,
                                        width: 28,
                                        height: 28,
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {previewLoading &&
                                    previewingIndex === track.index ? (
                                        <ActivityIndicator
                                            size="small"
                                            color={highlight}
                                        />
                                    ) : (
                                        <Icon
                                            name={
                                                isPreviewing
                                                    ? 'stop-circle'
                                                    : 'play-circle'
                                            }
                                            type="material"
                                            color={
                                                isPreviewing
                                                    ? highlight
                                                    : secondaryText
                                            }
                                            size={28}
                                        />
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() =>
                                        this.selectTrack(track.index)
                                    }
                                    activeOpacity={0.7}
                                    style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        alignItems: 'center'
                                    }}
                                >
                                    <Text
                                        style={{
                                            flex: 1,
                                            color: isSelected
                                                ? highlight
                                                : textColor,
                                            fontSize: 16,
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        {track.name}
                                    </Text>
                                    {isSelected && (
                                        <Icon
                                            name="check"
                                            type="material"
                                            color={highlight}
                                            size={20}
                                        />
                                    )}
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>
            </View>
        );
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            loading,
            error,
            enableCashu,
            persistentNWCServiceEnabled,
            lud16Enabled
        } = this.state;
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

                        {settings.lightningAddress?.enabled && (
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
                                                'views.Settings.NostrWalletConnect.nwcIncludeLud16InUrl'
                                            )}
                                        </Text>
                                    </View>
                                    <View
                                        style={{
                                            alignSelf: 'center'
                                        }}
                                    >
                                        <Switch
                                            value={lud16Enabled}
                                            onValueChange={
                                                this.toggleLud16Enabled
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
                                        'views.Settings.NostrWalletConnect.nwcIncludeLud16InUrlDescription'
                                    )}
                                </Text>
                            </View>
                        )}
                        {Platform.OS === 'android' && (
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
                                                this
                                                    .showPersistentNWCBackgroundInfo
                                            }
                                            color={themeColor('text')}
                                            underlayColor="transparent"
                                            size={24}
                                            containerStyle={{ marginLeft: 8 }}
                                        />
                                    </View>
                                    <View style={{ alignSelf: 'center' }}>
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
                                        'views.Settings.NostrWalletConnect.persistentNWCServiceDescriptionAndroid'
                                    )}
                                </Text>
                            </View>
                        )}

                        {/* iOS-only: background audio track picker */}
                        {Platform.OS === 'ios' && this.renderAudioTrackPicker()}

                        <View style={{ height: 30 }} />
                    </ScrollView>
                )}
            </Screen>
        );
    }
}
