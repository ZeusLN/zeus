import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import SettingsStore, {
    DEFAULT_VIEW_KEYS,
    THEME_KEYS
} from './../../stores/SettingsStore';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import DropdownSetting from './../../components/DropdownSetting';
import Screen from './../../components/Screen';
import Switch from './../../components/Switch';

interface DisplayProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface DisplayState {
    theme: string;
    defaultView: string;
    displayNickname: boolean;
    bigKeypadButtons: boolean;
    showAllDecimalPlaces: boolean;
}

@inject('SettingsStore')
@observer
export default class Display extends React.Component<
    DisplayProps,
    DisplayState
> {
    state = {
        theme: 'Dark',
        defaultView: 'Keypad',
        displayNickname: false,
        bigKeypadButtons: false,
        showAllDecimalPlaces: false
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            theme: (settings.display && settings.display.theme) || 'Dark',
            defaultView:
                (settings.display && settings.display.defaultView) || 'Keypad',
            displayNickname:
                (settings.display && settings.display.displayNickname) || false,
            bigKeypadButtons:
                (settings.display && settings.display.bigKeypadButtons) ||
                false,
            showAllDecimalPlaces:
                (settings.display && settings.display.showAllDecimalPlaces) ||
                false
        });
    }

    renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            defaultView,
            displayNickname,
            bigKeypadButtons,
            theme,
            showAllDecimalPlaces
        } = this.state;
        const { updateSettings }: any = SettingsStore;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() =>
                    navigation.navigate('Settings', {
                        refresh: true
                    })
                }
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <Screen>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Settings.Display.title'),
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
                <ScrollView style={{ flex: 1, padding: 15 }}>
                    <DropdownSetting
                        title={localeString('views.Settings.Theme.title')}
                        selectedValue={theme}
                        onValueChange={async (value: string) => {
                            this.setState({
                                theme: value
                            });
                            await updateSettings({
                                display: {
                                    theme: value,
                                    displayNickname,
                                    bigKeypadButtons,
                                    defaultView,
                                    showAllDecimalPlaces
                                }
                            });
                        }}
                        values={THEME_KEYS}
                    />

                    <DropdownSetting
                        title={localeString(
                            'views.Settings.Display.defaultView'
                        )}
                        selectedValue={defaultView}
                        onValueChange={async (value: string) => {
                            this.setState({
                                defaultView: value
                            });
                            await updateSettings({
                                display: {
                                    defaultView: value,
                                    displayNickname,
                                    bigKeypadButtons,
                                    theme,
                                    showAllDecimalPlaces
                                }
                            });
                        }}
                        values={DEFAULT_VIEW_KEYS}
                    />

                    <ListItem
                        containerStyle={{
                            borderBottomWidth: 0,
                            backgroundColor: 'transparent'
                        }}
                    >
                        <ListItem.Title
                            style={{
                                color: themeColor('secondaryText'),
                                fontFamily: 'Lato-Regular',
                                left: -10
                            }}
                        >
                            {localeString(
                                'views.Settings.Display.displayNickname'
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
                                value={displayNickname}
                                onValueChange={async () => {
                                    this.setState({
                                        displayNickname: !displayNickname
                                    });
                                    await updateSettings({
                                        display: {
                                            defaultView,
                                            theme,
                                            bigKeypadButtons,
                                            displayNickname: !displayNickname,
                                            showAllDecimalPlaces
                                        }
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
                                color: themeColor('secondaryText'),
                                fontFamily: 'Lato-Regular',
                                left: -10
                            }}
                        >
                            {localeString(
                                'views.Settings.Display.bigKeypadButtons'
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
                                value={bigKeypadButtons}
                                onValueChange={async () => {
                                    this.setState({
                                        bigKeypadButtons: !bigKeypadButtons
                                    });
                                    await updateSettings({
                                        display: {
                                            defaultView,
                                            theme,
                                            displayNickname,
                                            bigKeypadButtons: !bigKeypadButtons,
                                            showAllDecimalPlaces
                                        }
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
                                color: themeColor('secondaryText'),
                                fontFamily: 'Lato-Regular',
                                left: -10
                            }}
                        >
                            {localeString(
                                'views.Settings.Display.showAllDecimalPlaces'
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
                                value={showAllDecimalPlaces}
                                onValueChange={async () => {
                                    this.setState({
                                        showAllDecimalPlaces:
                                            !showAllDecimalPlaces
                                    });
                                    await updateSettings({
                                        display: {
                                            defaultView,
                                            theme,
                                            displayNickname,
                                            bigKeypadButtons,
                                            showAllDecimalPlaces:
                                                !showAllDecimalPlaces
                                        }
                                    });
                                }}
                            />
                        </View>
                    </ListItem>
                </ScrollView>
            </Screen>
        );
    }
}
