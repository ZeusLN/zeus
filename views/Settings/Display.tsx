import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SystemNavigationBar from 'react-native-system-navigation-bar';

import SettingsStore, {
    DATE_FORMAT_KEYS,
    DEFAULT_VIEW_KEYS,
    THEME_KEYS,
    TIME_FORMAT_KEYS
} from '../../stores/SettingsStore';
import { localeString } from '../../utils/LocaleUtils';
import { isLightTheme, themeColor } from '../../utils/ThemeUtils';

import Text from '../../components/Text';
import DropdownSetting from '../../components/DropdownSetting';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';

interface DisplayProps {
    navigation: NativeStackNavigationProp<any, any>;
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
    dateFormat: string;
    timeFormat: string;
    showSeconds: boolean;
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
        dateFormat: 'default',
        timeFormat: '24h',
        showSeconds: false,
        selectNodeOnStartup: false
    };

    async componentDidMount() {
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
            dateFormat: settings.display?.dateFormat || 'default',
            timeFormat: settings.display?.timeFormat || '24h',
            showSeconds: settings.display?.showSeconds || false,
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
            dateFormat,
            timeFormat,
            showSeconds,
            selectNodeOnStartup
        } = this.state;
        const { updateSettings, updateSettingsGroup } = SettingsStore;

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
                        disabled={SettingsStore.settingsUpdateInProgress}
                        onValueChange={async (value: string) => {
                            this.setState({
                                theme: value
                            });
                            await updateSettingsGroup('display', {
                                theme: value
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
                            await updateSettingsGroup('display', {
                                defaultView: value
                            });
                        }}
                        values={DEFAULT_VIEW_KEYS}
                    />

                    <DropdownSetting
                        title={localeString(
                            'views.Settings.Display.dateFormat'
                        )}
                        selectedValue={dateFormat}
                        onValueChange={async (value: string) => {
                            this.setState({ dateFormat: value });
                            await updateSettingsGroup('display', {
                                dateFormat: value
                            });
                        }}
                        values={DATE_FORMAT_KEYS}
                    />

                    <DropdownSetting
                        title={localeString(
                            'views.Settings.Display.timeFormat'
                        )}
                        selectedValue={timeFormat}
                        onValueChange={async (value: string) => {
                            this.setState({ timeFormat: value });
                            await updateSettingsGroup('display', {
                                timeFormat: value
                            });
                        }}
                        values={TIME_FORMAT_KEYS}
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
                                    'views.Settings.Display.showSeconds'
                                )}
                            </Text>
                        </View>
                        <View style={{ alignSelf: 'center', marginLeft: 5 }}>
                            <Switch
                                value={showSeconds}
                                onValueChange={async (value: boolean) => {
                                    this.setState({ showSeconds: value });
                                    await updateSettingsGroup('display', {
                                        showSeconds: value
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
                                    'views.Settings.Display.displayNickname'
                                )}
                            </Text>
                        </View>
                        <View style={{ alignSelf: 'center', marginLeft: 5 }}>
                            <Switch
                                value={displayNickname}
                                onValueChange={async (value: boolean) => {
                                    this.setState({ displayNickname: value });
                                    await updateSettingsGroup('display', {
                                        displayNickname: value
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
                                onValueChange={async (value: boolean) => {
                                    this.setState({ bigKeypadButtons: value });
                                    await updateSettingsGroup('display', {
                                        bigKeypadButtons: value
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
                                onValueChange={async (value: boolean) => {
                                    this.setState({
                                        showAllDecimalPlaces: value
                                    });
                                    await updateSettingsGroup('display', {
                                        showAllDecimalPlaces: value
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
                                onValueChange={async (value: boolean) => {
                                    this.setState({
                                        removeDecimalSpaces: value
                                    });
                                    await updateSettingsGroup('display', {
                                        removeDecimalSpaces: value
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
                                onValueChange={async (value: boolean) => {
                                    this.setState({
                                        showMillisatoshiAmounts: value
                                    });
                                    await updateSettingsGroup('display', {
                                        showMillisatoshiAmounts: value
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
                                onValueChange={async (value: boolean) => {
                                    this.setState({
                                        selectNodeOnStartup: value
                                    });
                                    await updateSettings({
                                        selectNodeOnStartup: value
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
