import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';
import SettingsStore from './../../stores/SettingsStore';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';
import { inject, observer } from 'mobx-react';

import { LOCALE_KEYS } from './../../stores/SettingsStore';

interface LanguageProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface LanguageStore {
    selectLocale: string;
}

@inject('SettingsStore')
@observer
export default class Language extends React.Component<
    LanguageProps,
    LanguageStore
> {
    state = {
        selectedLocale: ''
    };

    async componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            selectedLocale: settings.locale
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
        const { selectedLocale } = this.state;
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
                            text: 'Language', // TODO
                            style: { color: themeColor('text') }
                        }}
                        backgroundColor={themeColor('secondary')}
                    />
                    <FlatList
                        data={LOCALE_KEYS}
                        renderItem={({ item, index }) => (
                            <ListItem
                                title={item.value}
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: themeColor('background')
                                }}
                                onPress={async () => {
                                    await setSettings(
                                        JSON.stringify({
                                            nodes: settings.nodes,
                                            theme: settings.theme,
                                            selectedNode: settings.selectedNode,
                                            onChainAddress:
                                                settings.onChainAddress,
                                            fiat: settings.fiat,
                                            lurkerMode: settings.lurkerMode,
                                            passphrase: settings.passphrase,
                                            locale: item.value
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
                                        selectedLocale === item.value
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
