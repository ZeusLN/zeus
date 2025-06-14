import * as React from 'react';
import { Text, View, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import AmountInput from '../../components/AmountInput';

import Pill from '../../components/Pill';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';

import CashuStore from '../../stores/CashuStore';
import ChannelsStore from '../../stores/ChannelsStore';
import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

interface EcashSettingsProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    ChannelsStore: ChannelsStore;
    SettingsStore: SettingsStore;
}

interface EcashSettingsState {
    loading: boolean;
    enableCashu: boolean;
    automaticallySweep: boolean;
    sweepThresholdSats: string;
}

@inject('CashuStore', 'ChannelsStore', 'SettingsStore')
@observer
export default class EcashSettings extends React.Component<
    EcashSettingsProps,
    EcashSettingsState
> {
    constructor(props: EcashSettingsProps) {
        super(props);
        this.props.SettingsStore.resetSelectedForceFiat();
    }
    state = {
        loading: false,
        enableCashu: false,
        automaticallySweep: false,
        sweepThresholdSats: '0'
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            enableCashu:
                settings?.ecash?.enableCashu !== null &&
                settings?.ecash?.enableCashu !== undefined
                    ? settings.ecash.enableCashu
                    : false,
            automaticallySweep:
                settings?.ecash?.automaticallySweep !== null &&
                settings?.ecash?.automaticallySweep !== undefined
                    ? settings.ecash.automaticallySweep
                    : false,
            sweepThresholdSats: settings?.ecash?.sweepThresholdSats
                ? settings.ecash.sweepThresholdSats.toString()
                : '10000'
        });
    }

    handleThresholdChange = async (
        amount: string,
        satAmount: string | number
    ) => {
        const threshold =
            typeof satAmount === 'number' ? satAmount : parseInt(satAmount, 10);
        const finalThreshold =
            isNaN(threshold) || threshold < 0 ? 0 : threshold;

        this.setState({ sweepThresholdSats: amount, loading: true });

        await this.props.SettingsStore.updateSettings({
            ecash: {
                ...this.props.SettingsStore.settings.ecash,
                sweepThresholdSats: finalThreshold
            }
        });

        // Update state with the cleaned threshold value after saving
        this.setState({
            sweepThresholdSats: finalThreshold.toString(),
            loading: false
        });
    };

    render() {
        const { navigation, CashuStore, ChannelsStore, SettingsStore } =
            this.props;
        const { loading, enableCashu, automaticallySweep, sweepThresholdSats } =
            this.state;
        const { settings, updateSettings }: any = SettingsStore;
        const hasOpenChannels = ChannelsStore.channels.length > 0;

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
                                    color: themeColor('text'),
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
                                UrlUtils.goToUrl(
                                    'https://docs.zeusln.app/cashu'
                                );
                            }}
                        />
                    </View>
                    <View style={{ marginTop: 25 }}>
                        <Button
                            title={localeString(
                                'views.Settings.Ecash.cashuTroubleshooting'
                            )}
                            onPress={() => {
                                UrlUtils.goToUrl(
                                    'https://docs.zeusln.app/cashu#i-get-an-error-saying-outputs-have-already-been-signed-before-or-already-spent-what-should-i-do'
                                );
                            }}
                            icon={{
                                name: 'help-buoy-outline',
                                type: 'ionicon',
                                size: 25
                            }}
                            secondary
                        />
                    </View>

                    {hasOpenChannels && enableCashu && (
                        <View style={{ marginTop: 20 }}>
                            <View
                                style={{ flexDirection: 'row', marginTop: 20 }}
                            >
                                <View
                                    style={{
                                        flex: 1,
                                        justifyContent: 'center'
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            fontSize: 17
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.Ecash.automaticallySweep'
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
                                        value={automaticallySweep}
                                        onValueChange={async () => {
                                            this.setState({
                                                loading: true
                                            });
                                            await updateSettings({
                                                ecash: {
                                                    ...settings.ecash,
                                                    automaticallySweep:
                                                        !automaticallySweep
                                                }
                                            });
                                            this.setState({
                                                automaticallySweep:
                                                    !automaticallySweep,
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
                            {automaticallySweep && (
                                <>
                                    <Text
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontSize: 17,
                                            marginTop: 10
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.Ecash.sweepThresholdSatsTitle'
                                        )}
                                    </Text>
                                    <AmountInput
                                        navigation={navigation}
                                        amount={sweepThresholdSats}
                                        onAmountChange={
                                            this.handleThresholdChange
                                        }
                                        forceUnit="sats"
                                        hideConversion={true}
                                        hideUnitChangeButton={true}
                                    />
                                    <Text
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontSize: 16,
                                            marginBottom: 15
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.Ecash.sweepThresholdSatsTitle.description'
                                        )}
                                    </Text>
                                </>
                            )}
                        </View>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}
