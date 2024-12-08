import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import SystemNavigationBar from 'react-native-system-navigation-bar';

import SettingsStore, {
    DEFAULT_VIEW_KEYS,
    THEME_KEYS
} from '../../stores/SettingsStore';
import { localeString } from '../../utils/LocaleUtils';
import { isLightTheme, themeColor } from '../../utils/ThemeUtils';

import Text from '../../components/Text';
import DropdownSetting from '../../components/DropdownSetting';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';

interface DisplayProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface DisplayState {
    theme: string;
    defaultView: string;
    displayNickname: boolean;
    bigKeypadButtons: boolean;
    showAllDecimalPlaces: boolean;
    removeDecimalSpaces: boolean;
    showMillisatoshiAmounts: boolean;
    selectNodeOnStartup: boolean;
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
        showAllDecimalPlaces: false,
        removeDecimalSpaces: false,
        showMillisatoshiAmounts: false,
        selectNodeOnStartup: false
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
                false,
            removeDecimalSpaces:
                (settings.display && settings.display.removeDecimalSpaces) ||
                false,
            showMillisatoshiAmounts:
                (settings.display &&
                    settings.display.showMillisatoshiAmounts) ||
                false,
            selectNodeOnStartup: settings.selectNodeOnStartup || false
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
            showAllDecimalPlaces,
            removeDecimalSpaces,
            showMillisatoshiAmounts,
            selectNodeOnStartup
        } = this.state;
        const { updateSettings }: any = SettingsStore;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.Display.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={{ flex: 1, paddingHorizontal: 15, marginTop: 5 }}
                    keyboardShouldPersistTaps="handled"
                >
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
                                    showAllDecimalPlaces,
                                    removeDecimalSpaces,
                                    showMillisatoshiAmounts
                                }
                            });
                            SystemNavigationBar.setNavigationColor(
                                themeColor('background'),
                                isLightTheme() ? 'dark' : 'light'
                            );
                            SystemNavigationBar.setNavigationBarDividerColor(
                                themeColor('secondary')
                            );
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
                                    showAllDecimalPlaces,
                                    removeDecimalSpaces,
                                    showMillisatoshiAmounts
                                }
                            });
                        }}
                        values={DEFAULT_VIEW_KEYS}
                    />

                    <View style={{ flexDirection: 'row', marginTop: 20 }}>
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 17,
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString(
                                    'views.Settings.Display.displayNickname'
                                )}
                            </Text>
                        </View>
                        <View style={{ alignSelf: 'center', marginLeft: 5 }}>
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
                                            showAllDecimalPlaces,
                                            removeDecimalSpaces,
                                            showMillisatoshiAmounts
                                        }
                                    });
                                }}
                            />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', marginTop: 20 }}>
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 17,
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString(
                                    'views.Settings.Display.bigKeypadButtons'
                                )}
                            </Text>
                        </View>
                        <View style={{ alignSelf: 'center', marginLeft: 5 }}>
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
                                            showAllDecimalPlaces,
                                            removeDecimalSpaces,
                                            showMillisatoshiAmounts
                                        }
                                    });
                                }}
                            />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', marginTop: 20 }}>
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 17,
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString(
                                    'views.Settings.Display.showAllDecimalPlaces'
                                )}
                            </Text>
                        </View>
                        <View style={{ alignSelf: 'center', marginLeft: 5 }}>
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
                                                !showAllDecimalPlaces,
                                            removeDecimalSpaces,
                                            showMillisatoshiAmounts
                                        }
                                    });
                                }}
                            />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', marginTop: 20 }}>
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 17,
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString(
                                    'views.Settings.Display.removeDecimalSpaces'
                                )}
                            </Text>
                        </View>
                        <View style={{ alignSelf: 'center', marginLeft: 5 }}>
                            <Switch
                                value={removeDecimalSpaces}
                                onValueChange={async () => {
                                    this.setState({
                                        removeDecimalSpaces:
                                            !removeDecimalSpaces
                                    });
                                    await updateSettings({
                                        display: {
                                            defaultView,
                                            theme,
                                            displayNickname,
                                            bigKeypadButtons,
                                            showAllDecimalPlaces,
                                            removeDecimalSpaces:
                                                !removeDecimalSpaces,
                                            showMillisatoshiAmounts
                                        }
                                    });
                                }}
                            />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', marginTop: 20 }}>
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 17,
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString(
                                    'views.Settings.Display.showMillisatoshiAmounts'
                                )}
                            </Text>
                        </View>
                        <View style={{ alignSelf: 'center', marginLeft: 5 }}>
                            <Switch
                                value={showMillisatoshiAmounts}
                                onValueChange={async () => {
                                    this.setState({
                                        showMillisatoshiAmounts:
                                            !showMillisatoshiAmounts
                                    });
                                    await updateSettings({
                                        display: {
                                            defaultView,
                                            theme,
                                            displayNickname,
                                            bigKeypadButtons,
                                            showAllDecimalPlaces,
                                            removeDecimalSpaces,
                                            showMillisatoshiAmounts:
                                                !showMillisatoshiAmounts
                                        }
                                    });
                                }}
                            />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', marginTop: 20 }}>
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 17,
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString(
                                    'views.Settings.Display.selectNodeOnStartup'
                                )}
                            </Text>
                        </View>
                        <View style={{ alignSelf: 'center', marginLeft: 5 }}>
                            <Switch
                                value={selectNodeOnStartup}
                                onValueChange={async () => {
                                    this.setState({
                                        selectNodeOnStartup:
                                            !selectNodeOnStartup
                                    });
                                    await updateSettings({
                                        selectNodeOnStartup:
                                            !selectNodeOnStartup
                                    });
                                }}
                            />
                        </View>
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}
