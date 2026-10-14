import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import SettingsStore, {
    DATE_FORMAT_KEYS,
    TIME_FORMAT_KEYS
} from '../../stores/SettingsStore';
import DateTimeUtils from '../../utils/DateTimeUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Text from '../../components/Text';
import DropdownSetting from '../../components/DropdownSetting';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';

interface DateTimeProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface DateTimeState {
    dateFormat: string;
    timeFormat: string;
    showSeconds: boolean;
}

@inject('SettingsStore')
@observer
export default class DateTime extends React.Component<
    DateTimeProps,
    DateTimeState
> {
    state = {
        dateFormat: 'default',
        timeFormat: '24h',
        showSeconds: false
    };

    async componentDidMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            dateFormat: settings.display?.dateFormat || 'default',
            timeFormat: settings.display?.timeFormat || '24h',
            showSeconds: settings.display?.showSeconds || false
        });
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { dateFormat, timeFormat, showSeconds } = this.state;
        const { updateSettingsGroup } = SettingsStore;
        // DateTimeUtils reads the display settings from the store, so this
        // observer re-renders the preview when a setting changes
        const now = new Date();

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.DateTime.title'),
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
                        title={localeString(
                            'views.Settings.DateTime.dateFormat'
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
                            'views.Settings.DateTime.timeFormat'
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
                                    'views.Settings.DateTime.showSeconds'
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

                    <View style={{ marginTop: 30 }}>
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontSize: 17,
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {localeString('views.Settings.DateTime.preview')}
                        </Text>
                        <KeyValue
                            keyValue={localeString(
                                'views.Settings.DateTime.previewList'
                            )}
                            value={DateTimeUtils.formatDateTimeShort(now)}
                            disableCopy
                        />
                        <KeyValue
                            keyValue={localeString(
                                'views.Settings.DateTime.previewDetails'
                            )}
                            value={DateTimeUtils.formatDateTime(now)}
                            disableCopy
                        />
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}
