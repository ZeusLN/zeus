import * as React from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import SettingsStore, { DEFAULT_VIEW_KEYS } from './../../stores/SettingsStore';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import DropdownSetting from './../../components/DropdownSetting';
import LoadingIndicator from './../../components/LoadingIndicator';

interface DisplayProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface DisplayState {
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
        defaultView: 'Keypad',
        displayNickname: false
    };

    componentDidMount() {
        // triggers when loaded from navigation or back action
        this.props.navigation.addListener('didFocus', () => {
            this.props.SettingsStore.getSettings();
        });
    }

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            defaultView:
                (settings.display && settings.display.defaultView) || 'Keypad',
            displayNickname:
                settings.display && settings.display.displayNickname
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
        const { defaultView, displayNickname } = this.state;
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
                        <ListItem
                            containerStyle={{
                                borderBottomWidth: 0,
                                backgroundColor: themeColor('background')
                            }}
                            onPress={() => navigation.navigate('Theme')}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'Lato-Regular'
                                    }}
                                >
                                    {localeString('views.Settings.Theme.title')}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('secondaryText')}
                            />
                        </ListItem>

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
                                        displayNickname
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
                                            privacy: {
                                                defaultView,
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
