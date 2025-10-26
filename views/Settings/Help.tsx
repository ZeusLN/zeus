import * as React from 'react';
import { FlatList, Linking, View } from 'react-native';
import { Icon, ListItem } from '@rneui/themed';
import { StackNavigationProp } from '@react-navigation/stack';

import Header from '../../components/Header';
import Screen from '../../components/Screen';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

interface HelpProps {
    navigation: StackNavigationProp<any, any>;
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

    const HELP_ITEMS = [
        {
            label: localeString('views.Settings.Help.docs').replace(
                'Zeus',
                'ZEUS'
            ),
            url: 'https://docs.zeusln.app'
        },
        {
            label: localeString('views.Settings.Help.github'),
            url: 'https://github.com/ZeusLN/zeus/issues'
        },
        {
            label: localeString('views.Settings.Help.email'),
            email: 'support@zeusln.com'
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
                            if (item.email) {
                                const url = `mailto:${item.email}`;
                                Linking.canOpenURL(url).then(
                                    (supported: boolean) => {
                                        if (supported) {
                                            Linking.openURL(url);
                                        }
                                    }
                                );
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
