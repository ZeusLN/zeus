import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import SettingsStore, { THEME_KEYS } from './../../stores/SettingsStore';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

interface ThemeProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface ThemeStore {
    selectedTheme: string;
}

@inject('SettingsStore')
@observer
export default class Theme extends React.Component<ThemeProps, ThemeStore> {
    state = {
        selectedTheme: ''
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            selectedTheme: settings.theme
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
        const { navigation, selectedNode, SettingsStore } = this.props;
        const { selectedTheme } = this.state;
        const { setSettings, getSettings }: any = SettingsStore;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
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
                <View>
                    <Header
                        leftComponent={<BackButton />}
                        centerComponent={{
                            text: localeString('views.Settings.Theme.title'),
                            style: { color: themeColor('text') }
                        }}
                        backgroundColor={themeColor('secondary')}
                    />
                    <FlatList
                        data={THEME_KEYS}
                        renderItem={({ item, index }) => (
                            <ListItem
                                title={item.key}
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: themeColor('background')
                                }}
                                onPress={async () => {
                                    await setSettings(
                                        JSON.stringify({
                                            nodes: settings.nodes,
                                            selectedNode: settings.selectedNode,
                                            onChainAddress:
                                                settings.onChainAddress,
                                            fiat: settings.fiat,
                                            passphrase: settings.passphrase,
                                            locale: settings.locale,
                                            theme: item.value,
                                            privacy: settings.privacy
                                        })
                                    ).then(() => {
                                        getSettings();
                                        navigation.navigate('Settings', {
                                            refresh: true
                                        });
                                    });
                                }}
                                titleStyle={{
                                    color:
                                        selectedTheme === item.value
                                            ? themeColor('highlight')
                                            : themeColor('text')
                                }}
                                subtitleStyle={{
                                    color: themeColor('secondaryText')
                                }}
                            />
                        )}
                        refreshing={loading}
                        keyExtractor={(item, index) => `${item.host}-${index}`}
                        ItemSeparatorComponent={this.renderSeparator}
                        onEndReachedThreshold={50}
                    />
                </View>
            </View>
        );
    }
}
