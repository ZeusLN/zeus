import * as React from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';
import SettingsStore from './../../stores/SettingsStore';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';
import { inject, observer } from 'mobx-react';

import { CURRENCY_KEYS } from './../../stores/SettingsStore';

interface CurrencyProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface CurrencyStore {
    selectLocale: string;
}

@inject('SettingsStore')
@observer
export default class Currency extends React.Component<
    CurrencyProps,
    CurrencyStore
> {
    state = {
        selectedCurrency: ''
    };

    async componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            selectedCurrency: settings.fiat
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
        const { selectedCurrency } = this.state;
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
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: 'Currency', // TODO
                        style: { color: themeColor('text') }
                    }}
                    backgroundColor={themeColor('secondary')}
                />
                <ScrollView>
                    <FlatList
                        data={CURRENCY_KEYS}
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
                                            fiat: item.value,
                                            lurkerMode: settings.lurkerMode,
                                            passphrase: settings.passphrase,
                                            locale: settings.locale
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
                                        selectedCurrency === item.value ||
                                        (!selectedCurrency &&
                                            item.value === 'Disabled')
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
                </ScrollView>
            </View>
        );
    }
}
