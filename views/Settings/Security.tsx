import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';
import stores from '../../stores/Stores';

interface SecurityProps {
    navigation: any;
}

function Security(props: SecurityProps) {
    const { navigation } = props;
    const { settings } = stores.settingsStore;

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
        },
        {
            label: localeString('views.Settings.SetDuressPassword.title'),
            screen: 'SetDuressPassword'
        }
        // { label: 'Verify TLS Certificate', url: 'https://twitter.com/ZeusLN' }
    ];

    const renderItem = ({ item }) => {
        // Only render SetDuressPassword list item if a passphrase is set
        if (!settings.passphrase && item.screen === 'SetDuressPassword') {
            return <></>;
        } else {
            return (
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
                                color: themeColor('secondaryText'),
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
            );
        }
    };

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
                data={SECURITY_ITEMS}
                renderItem={renderItem}
                keyExtractor={(item, index) => `${item.label}-${index}`}
                ItemSeparatorComponent={renderSeparator}
            />
        </View>
    );
}

export default Security;
