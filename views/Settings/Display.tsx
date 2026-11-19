import * as React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import ClockIcon from '../../assets/images/SVG/Clock.svg';
import ForwardIcon from '../../assets/images/SVG/Caret Right-3.svg';

import SettingsStore, { DEFAULT_VIEW_KEYS } from '../../stores/SettingsStore';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Text from '../../components/Text';
import DropdownSetting from '../../components/DropdownSetting';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';

import { themeLabel } from './ThemePicker';

interface DisplayProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface DisplayState {
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
        defaultView: 'Keypad',
        displayNickname: false,
        bigKeypadButtons: false,
        showAllDecimalPlaces: false,
        removeDecimalSpaces: false,
        showMillisatoshiAmounts: false,
        selectNodeOnStartup: false
    };

    async componentDidMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
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
            showAllDecimalPlaces,
            removeDecimalSpaces,
            showMillisatoshiAmounts,
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
                    <TouchableOpacity
                        style={{
                            flexDirection: 'row',
                            marginTop: 10,
                            marginBottom: 20,
                            alignItems: 'center'
                        }}
                        onPress={() => navigation.navigate('ThemePicker')}
                        accessibilityRole="button"
                    >
                        <Text
                            style={{
                                flex: 1,
                                color: themeColor('secondaryText'),
                                fontSize: 17,
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {localeString('views.Settings.Theme.title')}
                        </Text>
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontSize: 17,
                                fontFamily: 'PPNeueMontreal-Book',
                                marginRight: 10
                            }}
                        >
                            {themeLabel(SettingsStore.settings.display?.theme)}
                        </Text>
                        <ForwardIcon stroke={themeColor('secondaryText')} />
                    </TouchableOpacity>

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

                    <TouchableOpacity
                        style={{
                            flexDirection: 'row',
                            marginTop: 20,
                            alignItems: 'center'
                        }}
                        onPress={() => navigation.navigate('DateTime')}
                    >
                        <View
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}
                        >
                            <ClockIcon
                                color={themeColor('secondaryText')}
                                width={24}
                                height={24}
                                style={{ marginRight: 10 }}
                            />
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 17,
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString('views.Settings.DateTime.title')}
                            </Text>
                        </View>
                        <ForwardIcon stroke={themeColor('secondaryText')} />
                    </TouchableOpacity>
                </ScrollView>
            </Screen>
        );
    }
}
