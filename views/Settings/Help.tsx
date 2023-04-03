import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';

import Header from '../../components/Header';
import Screen from '../../components/Screen';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

interface HelpProps {
    navigation: any;
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
            label: localeString('views.Settings.Help.docs'),
            url: 'https://docs.zeusln.app'
        },
        {
            label: localeString('views.Settings.Help.github'),
            url: 'https://github.com/ZeusLN/zeus/issues'
        },
        {
            label: localeString('views.Settings.Help.telegram'),
            url: 'https://t.me/ZeusLN'
        },
        {
            label: localeString('views.Settings.Help.twitter'),
            url: 'https://twitter.com/ZeusLN'
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
                        fontFamily: 'Lato-Regular'
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
                        onPress={() => UrlUtils.goToUrl(item.url)}
                    >
                        <ListItem.Content>
                            <ListItem.Title
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'Lato-Regular'
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
