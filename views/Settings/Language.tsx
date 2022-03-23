import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Header, Icon, ListItem, SearchBar } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import SettingsStore, { LOCALE_KEYS } from './../../stores/SettingsStore';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

interface LanguageProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface LanguageState {
    selectedLocale: string;
    search: string;
    locales: any;
}

@inject('SettingsStore')
@observer
export default class Language extends React.Component<
    LanguageProps,
    LanguageState
> {
    state = {
        selectedLocale: '',
        search: '',
        locales: LOCALE_KEYS
    };

    async UNSAFE_componentWillMount() {
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

    updateSearch = (value: string) => {
        const result = LOCALE_KEYS.filter((item: any) =>
            item.key.includes(value)
        );
        this.setState({
            search: value,
            locales: result
        });
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const { locales, selectedLocale, search } = this.state;
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
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent={<BackButton />}
                        centerComponent={{
                            text: localeString('views.Settings.Language.title'),
                            style: { color: themeColor('text') }
                        }}
                        backgroundColor={themeColor('background')}
                        containerStyle={{
                            borderBottomWidth: 0
                        }}
                    />
                    <SearchBar
                        placeholder={localeString('general.search')}
                        onChangeText={this.updateSearch}
                        value={search}
                        inputStyle={{
                            color: themeColor('text')
                        }}
                        placeholderTextColor={themeColor('secondaryText')}
                        containerStyle={{
                            backgroundColor: themeColor('background'),
                            borderTopWidth: 0,
                            borderBottomWidth: 0
                        }}
                        inputContainerStyle={{
                            borderRadius: 15,
                            backgroundColor: themeColor('secondary')
                        }}
                    />
                    <FlatList
                        data={locales}
                        renderItem={({ item }) => (
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: themeColor('background')
                                }}
                                onPress={async () => {
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
                                                      duressPassphrase:
                                                          settings.duressPassphrase,
                                                      pin: settings.pin,
                                                      duressPin:
                                                          settings.duressPin,
                                                      authenticationAttempts:
                                                          settings.authenticationAttempts,
                                                      locale: item.value,
                                                      privacy: settings.privacy
                                                  }
                                                : { locale: item.value }
                                        )
                                    ).then(() => {
                                        navigation.goBack();
                                    });
                                }}
                            >
                                <ListItem.Content>
                                    <ListItem.Title
                                        style={{
                                            color:
                                                selectedLocale === item.value ||
                                                (!selectedLocale &&
                                                    item.value === 'English')
                                                    ? themeColor('highlight')
                                                    : themeColor('text')
                                        }}
                                    >
                                        {item.value}
                                    </ListItem.Title>
                                </ListItem.Content>
                                {(selectedLocale === item.value ||
                                    (!selectedLocale &&
                                        item.value === 'English')) && (
                                    <View style={{ textAlign: 'right' }}>
                                        <Icon
                                            name="check"
                                            color={themeColor('highlight')}
                                        />
                                    </View>
                                )}
                            </ListItem>
                        )}
                        keyExtractor={(item, index) => `${item.host}-${index}`}
                        ItemSeparatorComponent={this.renderSeparator}
                    />
                </View>
            </View>
        );
    }
}
