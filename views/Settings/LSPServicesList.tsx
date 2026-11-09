import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Icon, ListItem } from '@rneui/themed';

import Header from '../../components/Header';
import Screen from '../../components/Screen';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface LSPServicesListProps {
    navigation: any;
}

function LSPServicesList(props: LSPServicesListProps) {
    const { navigation } = props;

    const renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    const LSP_ITEMS = [
        {
            label: localeString('view.Settings.LSPServicesList.flow2'),
            nav: 'LSPSettings'
        },
        {
            label: localeString('view.Settings.LSPServicesList.lsps1'),
            nav: 'LSPS1Settings'
        }
    ];

    return (
        <Screen>
            <Header
                leftComponent="Back"
                centerComponent={{
                    text: localeString('view.Settings.LSPServicesList.title'),
                    style: {
                        color: themeColor('text'),
                        fontFamily: 'PPNeueMontreal-Book'
                    }
                }}
                navigation={navigation}
            />
            <FlatList
                data={LSP_ITEMS}
                renderItem={({ item }) => (
                    <ListItem
                        containerStyle={{
                            borderBottomWidth: 0,
                            backgroundColor: 'transparent'
                        }}
                        onPress={() => {
                            navigation.navigate(item.nav);
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

export default LSPServicesList;
