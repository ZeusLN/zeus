import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';
import UrlUtils from './../../utils/UrlUtils';

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

    const BackButton = () => (
        <Icon
            name="arrow-back"
            onPress={() => navigation.goBack()}
            color={themeColor('text')}
            underlayColor="transparent"
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
        <View
            style={{
                flex: 1,
                backgroundColor: themeColor('background')
            }}
        >
            <Header
                leftComponent={<BackButton />}
                centerComponent={{
                    text: localeString('general.help'),
                    style: {
                        color: themeColor('text'),
                        fontFamily: 'Lato-Regular'
                    }
                }}
                backgroundColor={themeColor('background')}
                containerStyle={{
                    borderBottomWidth: 0
                }}
            />
            <FlatList
                data={HELP_ITEMS}
                renderItem={({ item }) => (
                    <ListItem
                        containerStyle={{
                            borderBottomWidth: 0,
                            backgroundColor: themeColor('background')
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
        </View>
    );
}

export default Help;
