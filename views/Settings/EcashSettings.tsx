import * as React from 'react';
import { Text, View, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Pill from '../../components/Pill';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';

import CashuStore from '../../stores/CashuStore';
import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

interface EcashSettingsProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    SettingsStore: SettingsStore;
}

interface EcashSettingsState {
    loading: boolean;
    enableCashu: boolean;
}

@inject('CashuStore', 'SettingsStore')
@observer
export default class EcashSettings extends React.Component<
    EcashSettingsProps,
    EcashSettingsState
> {
    state = {
        loading: false,
        enableCashu: false
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            enableCashu:
                settings?.ecash?.enableCashu !== null
                    ? settings.ecash.enableCashu
                    : false
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
        const { navigation, CashuStore, SettingsStore } = this.props;
        const { loading, enableCashu } = this.state;
        const { settings, updateSettings }: any = SettingsStore;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.Ecash.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}
                        >
                            {loading && <LoadingIndicator size={30} />}
                        </View>
                    }
                    navigation={navigation}
                />
                <ScrollView
                    style={{
                        flex: 1,
                        paddingHorizontal: 15,
                        marginTop: 5
                    }}
                >
                    <Pill
                        title={localeString(
                            'general.experimental'
                        ).toUpperCase()}
                        textColor={themeColor('warning')}
                        borderColor={themeColor('warning')}
                        width={'100%'}
                    />
                    <View style={{ flexDirection: 'row', marginTop: 20 }}>
                        <View
                            style={{
                                flex: 1,
                                justifyContent: 'center'
                            }}
                        >
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 17
                                }}
                            >
                                {localeString(
                                    'views.Settings.Ecash.enableEcash'
                                )}
                            </Text>
                        </View>
                        <View
                            style={{
                                alignSelf: 'center',
                                marginLeft: 5
                            }}
                        >
                            <Switch
                                value={enableCashu}
                                onValueChange={async () => {
                                    this.setState({
                                        enableCashu: !enableCashu,
                                        loading: true
                                    });
                                    await updateSettings({
                                        ecash: {
                                            ...settings.ecash,
                                            enableCashu: !enableCashu
                                        }
                                    });
                                    if (!enableCashu) {
                                        await CashuStore.initializeWallets();
                                    }
                                    this.setState({
                                        loading: false
                                    });
                                }}
                                disabled={
                                    SettingsStore.settingsUpdateInProgress ||
                                    loading
                                }
                            />
                        </View>
                    </View>
                    <View
                        style={{
                            marginTop: 20,
                            marginBottom: 10
                        }}
                    >
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontSize: 16
                            }}
                        >
                            {localeString(
                                'views.Settings.Ecash.enableEcash.subtitle1'
                            )}
                        </Text>
                    </View>
                    <View
                        style={{
                            marginTop: 10,
                            marginBottom: 10
                        }}
                    >
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontSize: 16
                            }}
                        >
                            {localeString(
                                'views.Settings.Ecash.enableEcash.subtitle2'
                            )}
                        </Text>
                    </View>
                    <View
                        style={{
                            marginTop: 10,
                            marginBottom: 10
                        }}
                    >
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontSize: 16
                            }}
                        >
                            {localeString(
                                'views.Settings.Ecash.enableEcash.subtitle3'
                            )}
                        </Text>
                    </View>
                    <View style={{ marginTop: 25 }}>
                        <Button
                            title={localeString(
                                'views.Settings.Ecash.enableEcash.learnMore'
                            )}
                            onPress={() => {
                                UrlUtils.goToUrl('https://cashu.space');
                            }}
                        />
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}
