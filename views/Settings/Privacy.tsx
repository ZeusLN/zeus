import * as React from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import SettingsStore, {
    BLOCK_EXPLORER_KEYS
} from './../../stores/SettingsStore';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';
import DropdownSetting from './../../components/DropdownSetting';
import TextInput from './../../components/TextInput';

interface PrivacyProps {
    navigation: any;
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
            clipboard: settings.privacy && settings.privacy.clipboard,
            lurkerMode: settings.privacy && settings.privacy.lurkerMode,
            enableMempoolRates:
                settings.privacy && settings.privacy.enableMempoolRates
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
        const { setSettings, getSettings }: any = SettingsStore;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() =>
                    navigation.navigate('Settings', {
                        refresh: true
                    })
                }
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Settings.Privacy.title'),
                        style: { color: themeColor('text') }
                    }}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <ScrollView
                    style={{ flex: 1, paddingLeft: 10, paddingTop: 15 }}
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
                            const settings = await getSettings();
                            await setSettings(
                                JSON.stringify(
                                    settings
                                        ? {
                                              nodes: settings.nodes,
                                              theme: settings.theme,
                                              selectedNode:
                                                  settings.selectedNode,
                                              fiat: settings.fiat,
                                              passphrase: settings.passphrase,
                                              locale: settings.locale,
                                              privacy: {
                                                  defaultBlockExplorer: value,
                                                  customBlockExplorer,
                                                  clipboard,
                                                  lurkerMode,
                                                  enableMempoolRates
                                              }
                                          }
                                        : {
                                              privacy: {
                                                  defaultBlockExplorer: value,
                                                  customBlockExplorer,
                                                  clipboard,
                                                  lurkerMode,
                                                  enableMempoolRates
                                              }
                                          }
                                )
                            );
                        }}
                        values={BLOCK_EXPLORER_KEYS}
                    />

                    {defaultBlockExplorer === 'Custom' && (
                        <>
                            <Text
                                style={{ color: themeColor('secondaryText') }}
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

                                    const settings = await getSettings();
                                    await setSettings(
                                        JSON.stringify(
                                            settings
                                                ? {
                                                      nodes: settings.nodes,
                                                      theme: settings.theme,
                                                      selectedNode:
                                                          settings.selectedNode,
                                                      fiat: settings.fiat,
                                                      passphrase:
                                                          settings.passphrase,
                                                      locale: settings.locale,
                                                      privacy: {
                                                          defaultBlockExplorer,
                                                          customBlockExplorer:
                                                              text,
                                                          clipboard,
                                                          lurkerMode,
                                                          enableMempoolRates
                                                      }
                                                  }
                                                : {
                                                      privacy: {
                                                          defaultBlockExplorer,
                                                          customBlockExplorer:
                                                              text,
                                                          clipboard,
                                                          lurkerMode,
                                                          enableMempoolRates
                                                      }
                                                  }
                                        )
                                    );
                                }}
                            />
                        </>
                    )}

                    <ListItem
                        containerStyle={{
                            borderBottomWidth: 0,
                            backgroundColor: themeColor('background')
                        }}
                    >
                        <ListItem.Title
                            style={{
                                color: themeColor('secondaryText'),
                                left: -10
                            }}
                        >
                            {localeString('views.Settings.Privacy.clipboard')}
                        </ListItem.Title>
                        <View
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                justifyContent: 'flex-end'
                            }}
                        >
                            <Switch
                                value={clipboard}
                                onValueChange={async () => {
                                    this.setState({
                                        clipboard: !clipboard
                                    });
                                    const settings = await getSettings();
                                    await setSettings(
                                        JSON.stringify(
                                            settings
                                                ? {
                                                      nodes: settings.nodes,
                                                      theme: settings.theme,
                                                      selectedNode:
                                                          settings.selectedNode,
                                                      fiat: settings.fiat,
                                                      passphrase:
                                                          settings.passphrase,
                                                      locale: settings.locale,
                                                      privacy: {
                                                          defaultBlockExplorer,
                                                          customBlockExplorer,
                                                          clipboard: !clipboard,
                                                          lurkerMode,
                                                          enableMempoolRates
                                                      }
                                                  }
                                                : {
                                                      privacy: {
                                                          defaultBlockExplorer,
                                                          customBlockExplorer,
                                                          clipboard: !clipboard,
                                                          lurkerMode,
                                                          enableMempoolRates
                                                      }
                                                  }
                                        )
                                    );
                                }}
                                trackColor={{
                                    false: '#767577',
                                    true: themeColor('highlight')
                                }}
                            />
                        </View>
                    </ListItem>
                    <ListItem
                        containerStyle={{
                            borderBottomWidth: 0,
                            backgroundColor: themeColor('background')
                        }}
                    >
                        <ListItem.Title
                            style={{
                                color: themeColor('secondaryText'),
                                left: -10
                            }}
                        >
                            {localeString('views.Settings.Privacy.lurkerMode')}
                        </ListItem.Title>
                        <View
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                justifyContent: 'flex-end'
                            }}
                        >
                            <Switch
                                value={lurkerMode}
                                onValueChange={async () => {
                                    this.setState({
                                        lurkerMode: !lurkerMode
                                    });
                                    const settings = await getSettings();
                                    await setSettings(
                                        JSON.stringify(
                                            settings
                                                ? {
                                                      nodes: settings.nodes,
                                                      theme: settings.theme,
                                                      selectedNode:
                                                          settings.selectedNode,
                                                      fiat: settings.fiat,
                                                      passphrase:
                                                          settings.passphrase,
                                                      locale: settings.locale,
                                                      privacy: {
                                                          defaultBlockExplorer,
                                                          customBlockExplorer,
                                                          clipboard,
                                                          lurkerMode:
                                                              !lurkerMode,
                                                          enableMempoolRates
                                                      }
                                                  }
                                                : {
                                                      privacy: {
                                                          defaultBlockExplorer,
                                                          customBlockExplorer,
                                                          clipboard,
                                                          lurkerMode:
                                                              !lurkerMode,
                                                          enableMempoolRates
                                                      }
                                                  }
                                        )
                                    );
                                }}
                                trackColor={{
                                    false: '#767577',
                                    true: themeColor('highlight')
                                }}
                            />
                        </View>
                    </ListItem>
                    <ListItem
                        containerStyle={{
                            borderBottomWidth: 0,
                            backgroundColor: themeColor('background')
                        }}
                    >
                        <ListItem.Title
                            style={{
                                color: themeColor('secondaryText'),
                                left: -10
                            }}
                        >
                            {localeString(
                                'views.Settings.Privacy.enableMempoolRates'
                            )}
                        </ListItem.Title>
                        <View
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                justifyContent: 'flex-end'
                            }}
                        >
                            <Switch
                                value={enableMempoolRates}
                                onValueChange={async () => {
                                    this.setState({
                                        enableMempoolRates: !enableMempoolRates
                                    });
                                    const settings = await getSettings();
                                    await setSettings(
                                        JSON.stringify(
                                            settings
                                                ? {
                                                      nodes: settings.nodes,
                                                      theme: settings.theme,
                                                      selectedNode:
                                                          settings.selectedNode,
                                                      fiat: settings.fiat,
                                                      passphrase:
                                                          settings.passphrase,
                                                      locale: settings.locale,
                                                      privacy: {
                                                          defaultBlockExplorer,
                                                          customBlockExplorer,
                                                          clipboard,
                                                          lurkerMode,
                                                          enableMempoolRates:
                                                              !enableMempoolRates
                                                      }
                                                  }
                                                : {
                                                      privacy: {
                                                          defaultBlockExplorer,
                                                          customBlockExplorer,
                                                          clipboard,
                                                          lurkerMode,
                                                          enableMempoolRates:
                                                              !enableMempoolRates
                                                      }
                                                  }
                                        )
                                    );
                                }}
                                trackColor={{
                                    false: '#767577',
                                    true: themeColor('highlight')
                                }}
                            />
                        </View>
                    </ListItem>
                </ScrollView>
            </View>
        );
    }
}
