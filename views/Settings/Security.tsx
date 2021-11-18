import * as React from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';
import UrlUtils from './../../utils/UrlUtils';

interface SecurityProps {
    navigation: any;
}

function Security(props: SecurityProps) {
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

    const SECURITY_ITEMS = [
        {
            label: localeString('views.Settings.SetPassword.title'),
            screen: 'SetPassword'
        }
        // { label: 'Verify TLS Certificate', url: 'https://twitter.com/ZeusLN' }
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
                    text: localeString('views.Settings.Security.title'),
                    style: { color: themeColor('text') }
                }}
                backgroundColor={themeColor('secondary')}
            />
            <FlatList
                data={SECURITY_ITEMS}
                renderItem={({ item, index }) => (
                    <ListItem
                        containerStyle={{
                            borderBottomWidth: 0,
                            backgroundColor: themeColor('background')
                        }}
                        onPress={() => navigation.navigate(item.screen)}
                    >
                        <ListItem.Content>
                            <ListItem.Title
                                style={{
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {item.label}
                            </ListItem.Title>
                        </ListItem.Content>
                        <Text style={{ textAlign: 'right' }}>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('secondaryText')}
                            />
                        </Text>
                    </ListItem>
                )}
                keyExtractor={(item, index) => `${item.label}-${index}`}
                ItemSeparatorComponent={renderSeparator}
            />
        </View>
    );
}

export default Security;
