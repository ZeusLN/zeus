import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';

import Header from '../../components/Header';
import Screen from '../../components/Screen';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface SponsorsProps {
    navigation: any;
}

function Sponsors(props: SponsorsProps) {
    const { navigation } = props;

    const renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    const ABOUT_ITEMS = [
        { label: localeString('views.Olympians.title'), path: 'Olympians' },
        { label: localeString('views.Gods.title'), path: 'Gods' },
        { label: localeString('views.Mortals.title'), path: 'Mortals' }
    ];

    return (
        <Screen>
            <Header
                leftComponent="Back"
                centerComponent={{
                    text: localeString('views.Sponsors.title'),
                    style: {
                        color: themeColor('text'),
                        fontFamily: 'Lato-Regular'
                    }
                }}
                navigation={navigation}
            />
            <FlatList
                data={ABOUT_ITEMS}
                renderItem={({ item }) => (
                    <ListItem
                        containerStyle={{
                            borderBottomWidth: 0,
                            backgroundColor: 'theme'
                        }}
                        onPress={() => navigation.navigate(item.path)}
                        hasTVPreferredFocus={false}
                        tvParallaxProperties={{}}
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
                            tvParallaxProperties={{}}
                        />
                    </ListItem>
                )}
                keyExtractor={(item, index) => `${item.label}-${index}`}
                ItemSeparatorComponent={renderSeparator}
            />
        </Screen>
    );
}

export default Sponsors;
