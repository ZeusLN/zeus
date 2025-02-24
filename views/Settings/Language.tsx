import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Icon, ListItem, SearchBar } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Header from '../../components/Header';
import Screen from '../../components/Screen';

import SettingsStore, { LOCALE_KEYS } from '../../stores/SettingsStore';

import { localeString, bridgeJavaStrings } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface LanguageProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface LanguageState {
    selectedLocale: string | any;
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
            item.value.toLowerCase().includes(value.toLowerCase())
        );
        this.setState({
            search: value,
            locales: result
        });
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const { locales, selectedLocale, search } = this.state;
        const { updateSettings }: any = SettingsStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('views.Settings.Language.title'),
                            style: { color: themeColor('text') }
                        }}
                        navigation={navigation}
                    />
                    <SearchBar
                        placeholder={localeString('general.search')}
                        // @ts-ignore:next-line
                        onChangeText={this.updateSearch}
                        value={search}
                        inputStyle={{
                            color: themeColor('text')
                        }}
                        placeholderTextColor={themeColor('secondaryText')}
                        containerStyle={{
                            backgroundColor: 'transparent',
                            borderTopWidth: 0,
                            borderBottomWidth: 0
                        }}
                        inputContainerStyle={{
                            borderRadius: 15,
                            backgroundColor: themeColor('secondary')
                        }}
                        // @ts-ignore:next-line
                        searchIcon={{
                            importantForAccessibility: 'no-hide-descendants',
                            accessibilityElementsHidden: true
                        }}
                    />
                    <FlatList
                        data={locales}
                        renderItem={({ item }) => (
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: 'transparent'
                                }}
                                onPress={async () => {
                                    await updateSettings({
                                        locale: item.key
                                    }).then(() => {
                                        bridgeJavaStrings(item.key);
                                        navigation.goBack();
                                    });
                                }}
                            >
                                <ListItem.Content>
                                    <ListItem.Title
                                        style={{
                                            color:
                                                selectedLocale === item.key ||
                                                (!selectedLocale &&
                                                    item.key === 'en')
                                                    ? themeColor('highlight')
                                                    : themeColor('text')
                                        }}
                                    >
                                        {item.value}
                                    </ListItem.Title>
                                </ListItem.Content>
                                {(selectedLocale === item.key ||
                                    (!selectedLocale && item.key === 'en')) && (
                                    <View>
                                        <Icon
                                            name="check"
                                            color={themeColor('highlight')}
                                            style={{ textAlign: 'right' }}
                                        />
                                    </View>
                                )}
                            </ListItem>
                        )}
                        keyExtractor={(_, index) => index.toString()}
                        ItemSeparatorComponent={this.renderSeparator}
                    />
                </View>
            </Screen>
        );
    }
}
