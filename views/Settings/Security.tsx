import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';

import stores from '../../stores/Stores';

import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

interface SecurityProps {
    navigation: any;
}

function Security(props: SecurityProps) {
    const { navigation } = props;
    const { settings } = stores.settingsStore;

    let displaySecurityItems = [];
    const possibleSecurityItems = [
        {
            label: localeString('views.Settings.SetPassword.title'),
            screen: 'SetPassword'
        },
        {
            label: localeString('views.Settings.SetDuressPassword.title'),
            screen: 'SetDuressPassword'
        },
        {
            label: localeString('views.Settings.SetPin.title'),
            screen: 'SetPin'
        },
        {
            label: localeString('views.Settings.Security.deletePIN'),
            action: 'DeletePin'
        },
        {
            label: localeString('views.Settings.SetDuressPin.title'),
            screen: 'SetDuressPin'
        },
        {
            label: localeString('views.Settings.Security.deleteDuressPIN'),
            action: 'DeleteDuressPin'
        }
        // { label: 'Verify TLS Certificate', url: 'https://twitter.com/ZeusLN' }
    ];

    // Three cases:
    // 1) If no passphrase or pin is set, allow user to set passphrase or pin
    // 2) If passphrase is set, allow user to set passphrase or duress passphrase
    // 3) If pin is set, allow user to set pin or duress pin
    if (!settings.passphrase && !settings.pin) {
        displaySecurityItems = [
            possibleSecurityItems[0],
            possibleSecurityItems[2]
        ];
    } else if (settings.passphrase) {
        displaySecurityItems = [
            possibleSecurityItems[0],
            possibleSecurityItems[1]
        ];
    } else if (settings.pin) {
        displaySecurityItems = [
            possibleSecurityItems[2],
            possibleSecurityItems[3],
            possibleSecurityItems[4]
        ];
        if (settings.duressPin) {
            displaySecurityItems.push(possibleSecurityItems[5]);
        }
    }

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

    const navigateSecurity = (item: any) => {
        if (!(settings.passphrase || settings.pin)) {
            navigation.navigate(item.screen);
        } else if (item.action === 'DeletePin') {
            navigation.navigate('Lockscreen', {
                deletePin: true
            });
        } else if (item.action === 'DeleteDuressPin') {
            navigation.navigate('Lockscreen', {
                deleteDuressPin: true
            });
        } else {
            // if we already have a pin/password set, make user authenticate in order to change
            navigation.navigate('Lockscreen', {
                modifySecurityScreen: item.screen
            });
        }
    };

    const renderItem = ({ item }) => {
        return (
            <ListItem
                containerStyle={{
                    borderBottomWidth: 0,
                    backgroundColor: themeColor('background')
                }}
                onPress={() => navigateSecurity(item)}
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
                data={displaySecurityItems}
                renderItem={renderItem}
                keyExtractor={(item, index) => `${item.label}-${index}`}
                ItemSeparatorComponent={renderSeparator}
            />
        </View>
    );
}

export default Security;
