import * as React from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import SettingsStore, {
    DEFAULT_VIEW_KEYS,
    THEME_KEYS
} from './../../stores/SettingsStore';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import DropdownSetting from './../../components/DropdownSetting';
import LoadingIndicator from './../../components/LoadingIndicator';

interface DisplayProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface DisplayState {
    theme: string;
    defaultView: string;
    displayNickname: boolean;
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
        displayNickname: false
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
                (settings.display && settings.display.displayNickname) || false
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
        const { defaultView, displayNickname, theme } = this.state;
        const { updateSettings, loading }: any = SettingsStore;

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
            <View
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Settings.Display.title'),
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
                {loading ? (
                    <LoadingIndicator />
                ) : (
                    <ScrollView
                        style={{ flex: 1, paddingLeft: 10, paddingTop: 15 }}
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
                                        defaultView
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
                                        theme
                                    }
                                });
                            }}
                            values={DEFAULT_VIEW_KEYS}
                        />

                        <ListItem
                            containerStyle={{
                                borderBottomWidth: 0,
                                backgroundColor: themeColor('background')
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
                                                displayNickname:
                                                    !displayNickname
                                            }
                                        });
                                    }}
                                    trackColor={{
                                        false: '#767577',
                                        true: themeColor('highlight')
                                    }}
                                />
                            </View>
                        </ListItem>
                    </ScrollView>
                )}
            </View>
        );
    }
}
