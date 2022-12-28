import { inject, observer } from 'mobx-react';
import * as React from 'react';
import { FlatList, View, ScrollView, Switch } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';

import SettingsStore from '../../stores/SettingsStore';

import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

interface SecurityProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface SecurityState {
    scramblePin: boolean;
    loginBackground: boolean;
    displaySecurityItems: Array<any>;
    pinExists: boolean;
    passphraseExists: boolean;
}

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
];

@inject('SettingsStore')
@observer
export default class Security extends React.Component<
    SecurityProps,
    SecurityState
> {
    state = {
        scramblePin: true,
        loginBackground: false,
        displaySecurityItems: [],
        pinExists: false,
        passphraseExists: false
    };

    async componentDidMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            scramblePin: settings.scramblePin ?? true,
            loginBackground: settings.loginBackground ?? false
        });

        if (settings.pin) {
            this.setState({
                pinExists: true
            });
        }

        if (settings.passphrase) {
            this.setState({
                passphraseExists: true
            });
        }

        // Three cases:
        // 1) If no passphrase or pin is set, allow user to set passphrase or pin
        // 2) If passphrase is set, allow user to set passphrase or duress passphrase
        // 3) If pin is set, allow user to set pin or duress pin
        if (!settings.passphrase && !settings.pin) {
            this.setState({
                displaySecurityItems: [
                    possibleSecurityItems[0],
                    possibleSecurityItems[2]
                ]
            });
        } else if (settings.passphrase) {
            this.setState({
                displaySecurityItems: [
                    possibleSecurityItems[0],
                    possibleSecurityItems[1]
                ]
            });
        } else if (settings.pin) {
            const minPinItems = [
                possibleSecurityItems[2],
                possibleSecurityItems[3],
                possibleSecurityItems[4]
            ];
            if (settings.duressPin) {
                minPinItems.push(possibleSecurityItems[5]);
            }
            this.setState({
                displaySecurityItems: minPinItems
            });
        }
    }

    renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    navigateSecurity = (item: any) => {
        const { navigation, SettingsStore } = this.props;
        const { settings }: any = SettingsStore;

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

    renderItem = ({ item }) => {
        return (
            <ListItem
                containerStyle={{
                    borderBottomWidth: 0,
                    backgroundColor: themeColor('background')
                }}
                onPress={() => this.navigateSecurity(item)}
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

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            scramblePin,
            displaySecurityItems,
            pinExists,
            passphraseExists,
            loginBackground
        } = this.state;
        const { updateSettings } = SettingsStore;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <ScrollView
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
                    renderItem={this.renderItem}
                    keyExtractor={(item, index) => `${item.label}-${index}`}
                    ItemSeparatorComponent={this.renderSeparator}
                />
                {pinExists && (
                    <ListItem
                        containerStyle={{
                            backgroundColor: themeColor('background')
                        }}
                    >
                        <ListItem.Content>
                            <ListItem.Title
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'Lato-Regular'
                                }}
                            >
                                {localeString(
                                    'views.Settings.Security.scramblePIN'
                                )}
                            </ListItem.Title>
                        </ListItem.Content>
                        <Switch
                            value={scramblePin}
                            onValueChange={async () => {
                                this.setState({
                                    scramblePin: !scramblePin
                                });
                                updateSettings({ scramblePin: !scramblePin });
                            }}
                            trackColor={{
                                false: '#767577',
                                true: themeColor('highlight')
                            }}
                            style={{
                                alignSelf: 'flex-end'
                            }}
                        />
                    </ListItem>
                )}
                {(pinExists || passphraseExists) && (
                    <ListItem
                        containerStyle={{
                            backgroundColor: themeColor('background')
                        }}
                    >
                        <ListItem.Content>
                            <ListItem.Title
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'Lato-Regular'
                                }}
                            >
                                {localeString(
                                    'views.Settings.Security.loginBackground'
                                )}
                            </ListItem.Title>
                        </ListItem.Content>
                        <Switch
                            value={loginBackground}
                            onValueChange={async () => {
                                this.setState({
                                    loginBackground: !loginBackground
                                });
                                updateSettings({
                                    loginBackground: !loginBackground
                                });
                            }}
                            trackColor={{
                                false: '#767577',
                                true: themeColor('highlight')
                            }}
                            style={{
                                alignSelf: 'flex-end'
                            }}
                        />
                    </ListItem>
                )}
            </ScrollView>
        );
    }
}
