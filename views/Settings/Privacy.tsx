import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import SettingsStore, { BLOCK_EXPLORER_KEYS } from '../../stores/SettingsStore';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import DropdownSetting from '../../components/DropdownSetting';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';

interface PrivacyProps {
    navigation: StackNavigationProp<any, any>;
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
        enableMempoolRates: false
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            defaultBlockExplorer:
                (settings.privacy && settings.privacy.defaultBlockExplorer) ||
                'mempool.space',
            customBlockExplorer:
                (settings.privacy && settings.privacy.customBlockExplorer) ||
                '',
            clipboard:
                (settings.privacy && settings.privacy.clipboard) || false,
            lurkerMode:
                (settings.privacy && settings.privacy.lurkerMode) || false,
            enableMempoolRates:
                (settings.privacy && settings.privacy.enableMempoolRates) ||
                false
        });
    }

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
            enableMempoolRates
        } = this.state;
        const { updateSettings }: any = SettingsStore;

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
                                    defaultBlockExplorer: value,
                                    customBlockExplorer,
                                    clipboard,
                                    lurkerMode,
                                    enableMempoolRates
                                }
                            });
                        }}
                        values={BLOCK_EXPLORER_KEYS}
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
                                onChangeText={async (text: string) => {
                                    this.setState({
                                        customBlockExplorer: text
                                    });

                                    await updateSettings({
                                        privacy: {
                                            defaultBlockExplorer,
                                            customBlockExplorer: text,
                                            clipboard,
                                            lurkerMode,
                                            enableMempoolRates
                                        }
                                    });
                                }}
                            />
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
                                onValueChange={async () => {
                                    this.setState({
                                        clipboard: !clipboard
                                    });
                                    await updateSettings({
                                        privacy: {
                                            defaultBlockExplorer,
                                            customBlockExplorer,
                                            clipboard: !clipboard,
                                            lurkerMode,
                                            enableMempoolRates
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
                                onValueChange={async () => {
                                    this.setState({
                                        lurkerMode: !lurkerMode
                                    });
                                    await updateSettings({
                                        privacy: {
                                            defaultBlockExplorer,
                                            customBlockExplorer,
                                            clipboard,
                                            lurkerMode: !lurkerMode,
                                            enableMempoolRates
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
                                onValueChange={async () => {
                                    this.setState({
                                        enableMempoolRates: !enableMempoolRates
                                    });
                                    await updateSettings({
                                        privacy: {
                                            defaultBlockExplorer,
                                            customBlockExplorer,
                                            clipboard,
                                            lurkerMode,
                                            enableMempoolRates:
                                                !enableMempoolRates
                                        }
                                    });
                                }}
                            />
                        </View>
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}
