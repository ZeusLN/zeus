import * as React from 'react';
import { Text, View } from 'react-native';
import { ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Screen from '../../components/Screen';
import Header from '../../components/Header';
import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import Switch from '../../components/Switch';

interface LightningAddressSettingsProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface LightningAddressSettingsState {
    automaticallyAccept: boolean | undefined;
    verifyAllPaymentsWithNostr: boolean | undefined;
}

@inject('SettingsStore')
@observer
export default class LightningAddressSettings extends React.Component<
    LightningAddressSettingsProps,
    LightningAddressSettingsState
> {
    state = {
        automaticallyAccept: true,
        verifyAllPaymentsWithNostr: false
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        this.setState({
            automaticallyAccept: settings.automaticallyAccept,
            verifyAllPaymentsWithNostr: settings.verifyAllPaymentsWithNostr
        });
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { automaticallyAccept, verifyAllPaymentsWithNostr } = this.state;
        const { updateSettings }: any = SettingsStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.LightningAddressSettings.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular'
                            }
                        }}
                        navigation={navigation}
                    />
                    <View style={{ margin: 5 }}>
                        <ListItem
                            containerStyle={{
                                borderBottomWidth: 0,
                                backgroundColor: 'transparent'
                            }}
                        >
                            <ListItem.Title
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'Lato-Regular'
                                }}
                            >
                                {localeString(
                                    'views.Settings.LightningAddressSettings.automaticallyAccept'
                                )}
                            </ListItem.Title>
                            <View
                                style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    justifyContent: 'flex-end'
                                }}
                            >
                                <Switch
                                    value={automaticallyAccept}
                                    onValueChange={async () => {
                                        this.setState({
                                            automaticallyAccept:
                                                !automaticallyAccept
                                        });
                                        await updateSettings({
                                            automaticallyAccept:
                                                !automaticallyAccept
                                        });
                                    }}
                                />
                            </View>
                        </ListItem>
                        <ListItem
                            containerStyle={{
                                borderBottomWidth: 0,
                                backgroundColor: 'transparent'
                            }}
                        >
                            <ListItem.Title
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'Lato-Regular'
                                }}
                            >
                                {localeString(
                                    'views.Settings.LightningAddressSettings.verifyAllPaymentsWithNostr'
                                )}
                            </ListItem.Title>
                            <View
                                style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    justifyContent: 'flex-end'
                                }}
                            >
                                <Switch
                                    value={verifyAllPaymentsWithNostr}
                                    onValueChange={async () => {
                                        this.setState({
                                            verifyAllPaymentsWithNostr:
                                                !verifyAllPaymentsWithNostr
                                        });
                                        await updateSettings({
                                            verifyAllPaymentsWithNostr:
                                                !verifyAllPaymentsWithNostr
                                        });
                                    }}
                                />
                            </View>
                        </ListItem>
                        <View
                            style={{
                                margin: 10
                            }}
                        >
                            <Text
                                style={{
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString(
                                    'views.Settings.LightningAddressSettings.verifyAllPaymentsWithNostr.subtitle1'
                                )}
                            </Text>
                        </View>
                        <View
                            style={{
                                margin: 10
                            }}
                        >
                            <Text
                                style={{
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString(
                                    'views.Settings.LightningAddressSettings.verifyAllPaymentsWithNostr.subtitle2'
                                )}
                            </Text>
                        </View>
                    </View>
                </View>
            </Screen>
        );
    }
}
