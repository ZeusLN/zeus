import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Icon, ListItem } from '@rneui/themed';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Header from '../../components/Header';
import Screen from '../../components/Screen';

import { settingsStore } from '../../stores/Stores';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

interface HelpProps {
    navigation: NativeStackNavigationProp<any, any>;
}

function Help(props: HelpProps) {
    const { navigation } = props;

    const renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    // Only surfaced on local wallets, where the FAQ covers the node running on
    // the device. Remote node users get the general docs entry above it.
    const localWalletFaqUrl = UrlUtils.getLocalWalletFaqUrl(
        settingsStore.implementation
    );

    const HELP_ITEMS: Array<{
        label: string;
        url?: string;
        email?: string;
        path?: string;
    }> = [
        {
            label: localeString('views.Settings.Help.docs').replace(
                'Zeus',
                'ZEUS'
            ),
            url: 'https://docs.zeusln.app'
        },
        ...(localWalletFaqUrl
            ? [
                  {
                      label: localeString('views.Settings.Help.faq'),
                      url: localWalletFaqUrl
                  }
              ]
            : []),
        {
            label: localeString('views.Settings.Help.github'),
            url: 'https://github.com/ZeusLN/zeus/issues'
        },
        {
            // Email support routes through Diagnostics so the user is prompted
            // to attach version/logs/settings before composing the email.
            label: localeString('views.Settings.Help.email'),
            path: 'Diagnostics'
        }
    ];

    return (
        <Screen>
            <Header
                leftComponent="Back"
                centerComponent={{
                    text: localeString('general.help'),
                    style: {
                        color: themeColor('text'),
                        fontFamily: 'PPNeueMontreal-Book'
                    }
                }}
                navigation={navigation}
            />
            <FlatList
                data={HELP_ITEMS}
                renderItem={({ item }) => (
                    <ListItem
                        containerStyle={{
                            borderBottomWidth: 0,
                            backgroundColor: 'transparent'
                        }}
                        onPress={() => {
                            if (item.path) navigation.navigate(item.path);
                            if (item.email) {
                                UrlUtils.goToEmailAddress(item.email);
                            }
                            if (item.url) UrlUtils.goToUrl(item.url);
                        }}
                    >
                        <ListItem.Content>
                            <ListItem.Title
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {item.label}
                            </ListItem.Title>
                        </ListItem.Content>
                        <Icon
                            name="keyboard-arrow-right"
                            color={themeColor('secondaryText')}
                        />
                    </ListItem>
                )}
                keyExtractor={(item, index) => `${item.label}-${index}`}
                ItemSeparatorComponent={renderSeparator}
            />
        </Screen>
    );
}

export default Help;
