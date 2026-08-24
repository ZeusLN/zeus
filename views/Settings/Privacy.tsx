import * as React from 'react';
import { Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import StealthIcon from '../../assets/images/SVG/Hidden.svg';
import ForwardIcon from '../../assets/images/SVG/Caret Right-3.svg';

import SettingsStore, {
    BLOCK_EXPLORER_KEYS,
    DEFAULT_MEMPOOL_INSTANCE,
    MEMPOOL_INSTANCE_KEYS
} from '../../stores/SettingsStore';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

import DropdownSetting from '../../components/DropdownSetting';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';

interface PrivacyProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface PrivacyState {
    selectedPrivacy: string;
    search: string;
    defaultBlockExplorer: string;
    customBlockExplorer: string;
    clipboard: boolean;
    lurkerMode: boolean;
    enableMempoolRates: boolean;
    mempoolInstance: string;
    customMempoolInstance: string;
    enableBranta: boolean;
}

@inject('SettingsStore')
@observer
export default class Privacy extends React.Component<
    PrivacyProps,
    PrivacyState
> {
    state = {
        selectedPrivacy: '',
        search: '',
        defaultBlockExplorer: 'mempool.space',
        customBlockExplorer: '',
        clipboard: false,
        lurkerMode: false,
        enableMempoolRates: false,
        mempoolInstance: DEFAULT_MEMPOOL_INSTANCE,
        customMempoolInstance: '',
        enableBranta: true
    };

    async componentDidMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        // Values saved before these fields required a scheme are stored as
        // bare hosts, which every consumer already resolves as https. Show
        // the effective URL rather than flagging a working setting as
        // invalid; storage is left alone until the user edits the field.
        this.setState({
            defaultBlockExplorer:
                (settings.privacy && settings.privacy.defaultBlockExplorer) ||
                'mempool.space',
            customBlockExplorer: UrlUtils.withScheme(
                (settings.privacy && settings.privacy.customBlockExplorer) || ''
            ),
            clipboard:
                (settings.privacy && settings.privacy.clipboard) || false,
            lurkerMode:
                (settings.privacy && settings.privacy.lurkerMode) || false,
            enableMempoolRates:
                (settings.privacy && settings.privacy.enableMempoolRates) ||
                false,
            mempoolInstance:
                (settings.privacy && settings.privacy.mempoolInstance) ||
                DEFAULT_MEMPOOL_INSTANCE,
            customMempoolInstance: UrlUtils.withScheme(
                (settings.privacy && settings.privacy.customMempoolInstance) ||
                    ''
            ),
            enableBranta: settings.branta?.enabled !== false
        });
    }

    componentWillUnmount() {
        // 'Custom' with no saved URL makes every consumer fall back to the
        // default preset, so leaving it selected would misrepresent the
        // instance actually in use. Revert the dropdown on the way out.
        const { SettingsStore } = this.props;
        const { settings, updateSettings }: any = SettingsStore;
        const privacy = settings.privacy || {};
        const updates: any = {};

        if (
            privacy.defaultBlockExplorer === 'Custom' &&
            !(privacy.customBlockExplorer || '').trim()
        ) {
            updates.defaultBlockExplorer = 'mempool.space';
        }
        if (
            privacy.mempoolInstance === 'Custom' &&
            !(privacy.customMempoolInstance || '').trim()
        ) {
            updates.mempoolInstance = DEFAULT_MEMPOOL_INSTANCE;
        }

        if (Object.keys(updates).length > 0) {
            updateSettings({ privacy: { ...privacy, ...updates } });
        }
    }

    // Both fields require a full http(s) URL, matching the other custom
    // server settings. The block explorer's optional '#mempool.space'
    // convention hint parses as a URL fragment, and is only honored by
    // goToBlockExplorer when a scheme is present anyway.
    isValidCustomUrl = (text: string): boolean => {
        const trimmed = text.trim();
        return trimmed === '' || UrlUtils.isValidUrl(trimmed);
    };

    renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            defaultBlockExplorer,
            customBlockExplorer,
            clipboard,
            lurkerMode,
            enableMempoolRates,
            mempoolInstance,
            customMempoolInstance,
            enableBranta
        } = this.state;
        const { settings, updateSettings }: any = SettingsStore;

        const customBlockExplorerError =
            !this.isValidCustomUrl(customBlockExplorer);
        const customMempoolInstanceError = !this.isValidCustomUrl(
            customMempoolInstance
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.Privacy.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={{ flex: 1, paddingHorizontal: 15, marginTop: 5 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <DropdownSetting
                        title={localeString(
                            'views.Settings.Privacy.blockExplorer'
                        )}
                        selectedValue={defaultBlockExplorer}
                        onValueChange={async (value: string) => {
                            this.setState({
                                defaultBlockExplorer: value
                            });
                            await updateSettings({
                                privacy: {
                                    ...settings.privacy,
                                    defaultBlockExplorer: value
                                }
                            });
                        }}
                        values={BLOCK_EXPLORER_KEYS}
                        disabled={SettingsStore.settingsUpdateInProgress}
                    />

                    {defaultBlockExplorer === 'Custom' && (
                        <>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString(
                                    'views.Settings.Privacy.customBlockExplorer'
                                )}
                            </Text>
                            <TextInput
                                value={customBlockExplorer}
                                placeholder="https://explorer.mynode.local"
                                error={customBlockExplorerError}
                                autoCapitalize="none"
                                autoCorrect={false}
                                onChangeText={async (text: string) => {
                                    this.setState({
                                        customBlockExplorer: text
                                    });

                                    if (!this.isValidCustomUrl(text)) return;

                                    await updateSettings({
                                        privacy: {
                                            ...settings.privacy,
                                            customBlockExplorer: text
                                        }
                                    });
                                }}
                            />
                            {customBlockExplorerError && (
                                <Text
                                    style={{
                                        color: themeColor('error'),
                                        fontFamily: 'PPNeueMontreal-Book',
                                        fontSize: 12,
                                        marginTop: 4
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.Privacy.invalidCustomUrl'
                                    )}
                                </Text>
                            )}
                        </>
                    )}

                    <View
                        style={{
                            flexDirection: 'row',
                            marginTop: 20
                        }}
                    >
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 17,
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                                infoModalText={localeString(
                                    'views.Settings.Privacy.clipboard.explainer'
                                ).replace('Zeus', 'ZEUS')}
                            >
                                {localeString(
                                    'views.Settings.Privacy.clipboard'
                                )}
                            </Text>
                        </View>
                        <View style={{ alignSelf: 'center', marginLeft: 5 }}>
                            <Switch
                                value={clipboard}
                                disabled={
                                    SettingsStore.settingsUpdateInProgress
                                }
                                onValueChange={async () => {
                                    this.setState({
                                        clipboard: !clipboard
                                    });
                                    await updateSettings({
                                        privacy: {
                                            ...settings.privacy,
                                            clipboard: !clipboard
                                        }
                                    });
                                }}
                            />
                        </View>
                    </View>
                    <View
                        style={{
                            flexDirection: 'row',
                            marginTop: 20
                        }}
                    >
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 17,
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                                infoModalText={[
                                    localeString(
                                        'views.Settings.Privacy.lurkerMode.explainer1'
                                    ),
                                    localeString(
                                        'views.Settings.Privacy.lurkerMode.explainer3'
                                    ),
                                    localeString(
                                        'views.Settings.Privacy.lurkerMode.explainer2'
                                    )
                                ]}
                            >
                                {localeString(
                                    'views.Settings.Privacy.lurkerMode'
                                )}
                            </Text>
                        </View>
                        <View style={{ alignSelf: 'center', marginLeft: 5 }}>
                            <Switch
                                value={lurkerMode}
                                disabled={
                                    SettingsStore.settingsUpdateInProgress
                                }
                                onValueChange={async () => {
                                    this.setState({
                                        lurkerMode: !lurkerMode
                                    });
                                    await updateSettings({
                                        privacy: {
                                            ...settings.privacy,
                                            lurkerMode: !lurkerMode
                                        }
                                    });
                                }}
                            />
                        </View>
                    </View>
                    <View
                        style={{
                            flexDirection: 'row',
                            marginTop: 20
                        }}
                    >
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 17,
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString(
                                    'views.Settings.Privacy.enableMempoolRates'
                                )}
                            </Text>
                        </View>
                        <View style={{ alignSelf: 'center', marginLeft: 5 }}>
                            <Switch
                                value={enableMempoolRates}
                                disabled={
                                    SettingsStore.settingsUpdateInProgress
                                }
                                onValueChange={async () => {
                                    this.setState({
                                        enableMempoolRates: !enableMempoolRates
                                    });
                                    await updateSettings({
                                        privacy: {
                                            ...settings.privacy,
                                            enableMempoolRates:
                                                !enableMempoolRates
                                        }
                                    });
                                }}
                            />
                        </View>
                    </View>
                    <View
                        style={{
                            flexDirection: 'row',
                            marginTop: 20
                        }}
                    >
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 17,
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                                infoModalText={localeString(
                                    'views.Settings.Privacy.enableBranta.explainer'
                                )}
                            >
                                {localeString(
                                    'views.Settings.Privacy.enableBranta'
                                )}
                            </Text>
                        </View>
                        <View style={{ alignSelf: 'center', marginLeft: 5 }}>
                            <Switch
                                value={enableBranta}
                                disabled={
                                    SettingsStore.settingsUpdateInProgress
                                }
                                onValueChange={async () => {
                                    this.setState({
                                        enableBranta: !enableBranta
                                    });
                                    await updateSettings({
                                        branta: {
                                            enabled: !enableBranta
                                        }
                                    });
                                }}
                            />
                        </View>
                    </View>

                    <View style={{ marginTop: 20 }}>
                        <DropdownSetting
                            title={localeString(
                                'views.Settings.Privacy.mempoolInstance'
                            )}
                            infoModalText={[
                                localeString(
                                    'views.Settings.Privacy.mempoolInstance.explainer1'
                                ),
                                localeString(
                                    'views.Settings.Privacy.mempoolInstance.explainer2'
                                )
                            ]}
                            selectedValue={mempoolInstance}
                            onValueChange={async (value: string) => {
                                this.setState({
                                    mempoolInstance: value
                                });
                                await updateSettings({
                                    privacy: {
                                        ...settings.privacy,
                                        mempoolInstance: value
                                    }
                                });
                            }}
                            values={MEMPOOL_INSTANCE_KEYS}
                            disabled={SettingsStore.settingsUpdateInProgress}
                        />

                        {mempoolInstance === 'Custom' && (
                            <>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString('general.custom')}
                                </Text>
                                <TextInput
                                    value={customMempoolInstance}
                                    placeholder="https://mempool.mynode.local"
                                    error={customMempoolInstanceError}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    onChangeText={async (text: string) => {
                                        this.setState({
                                            customMempoolInstance: text
                                        });

                                        if (!this.isValidCustomUrl(text))
                                            return;

                                        await updateSettings({
                                            privacy: {
                                                ...settings.privacy,
                                                customMempoolInstance: text
                                            }
                                        });
                                    }}
                                />
                                {customMempoolInstanceError && (
                                    <Text
                                        style={{
                                            color: themeColor('error'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 12,
                                            marginTop: 4
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.Privacy.invalidCustomUrl'
                                        )}
                                    </Text>
                                )}
                            </>
                        )}
                    </View>

                    {Platform.OS === 'android' && (
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                marginTop: 20,
                                alignItems: 'center'
                            }}
                            onPress={() => navigation.navigate('StealthMode')}
                        >
                            <View
                                style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center'
                                }}
                            >
                                <StealthIcon
                                    fill={themeColor('text')}
                                    width={24}
                                    height={24}
                                    style={{ marginRight: 10 }}
                                />
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontSize: 17,
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.StealthMode.title'
                                    )}
                                </Text>
                            </View>
                            <ForwardIcon stroke={themeColor('secondaryText')} />
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}
