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

    const SOCIAL_ITEMS = [
        {
            label: localeString('nostr.nostr'),
            url: 'https://nostr.band/npub1xnf02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpr5'
        },
        {
            label: localeString('views.Settings.Help.telegram'),
            url: 'https://t.me/ZeusLN'
        },
        {
            label: localeString('views.Settings.SocialMedia.twitter'),
            url: 'https://twitter.com/ZeusLN'
        }
    ];

    return (
        <Screen>
            <Header
                leftComponent="Back"
                centerComponent={{
                    text: localeString('views.Settings.SocialMedia.title'),
                    style: {
                        color: themeColor('text'),
                        fontFamily: 'PPNeueMontreal-Book'
                    }
                }}
                navigation={navigation}
            />
            <FlatList
                data={SOCIAL_ITEMS}
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
