import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';

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

    const BackButton = () => (
        <Icon
            name="arrow-back"
            onPress={() => navigation.goBack()}
            color={themeColor('text')}
            underlayColor="transparent"
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
                leftComponent={<BackButton />}
                centerComponent={{
                    text: localeString('views.Sponsors.title'),
                    style: {
                        color: themeColor('text'),
                        fontFamily: 'Lato-Regular'
                    }
                }}
                backgroundColor="transparent"
                containerStyle={{
                    borderBottomWidth: 0
                }}
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

export default Sponsors;
