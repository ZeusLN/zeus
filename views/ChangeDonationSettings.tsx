import React from 'react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { inject, observer } from 'mobx-react';

import Header from '../components/Header';
import Screen from '../components/Screen';
import Switch from '../components/Switch';

import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';

import NodeInfoStore from '../stores/NodeInfoStore';
import SettingsStore from '../stores/SettingsStore';

interface ChangeDonationSettingsProps {
    navigation: StackNavigationProp<any, any>;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
}

interface ChangeDonationSettingsState {
    enableDonations: boolean;
    donationPercentage: number;
}

@inject('NodeInfoStore', 'SettingsStore')
@observer
export default class ChangeDonationSettings extends React.Component<
    ChangeDonationSettingsProps,
    ChangeDonationSettingsState
> {
    state = {
        enableDonations: false,
        donationPercentage: 5
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            enableDonations: settings?.payments?.enableDonations || false,
            donationPercentage:
                settings?.payments?.defaultDonationPercentage || 5
        });
    }

    render() {
        const { enableDonations, donationPercentage } = this.state;

        const { SettingsStore, NodeInfoStore, navigation } = this.props;
        const { nodeInfo } = NodeInfoStore;
        const { isMainNet } = nodeInfo;

        const { updateSettings, settings } = SettingsStore;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: 'Change donation settings',
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View
                    style={{
                        paddingHorizontal: 15,
                        marginTop: 5
                    }}
                >
                    {isMainNet && (
                        <View
                            style={{
                                flexDirection: 'row',
                                marginTop: 16,
                                marginBottom: 16,
                                alignItems: 'center'
                            }}
                        >
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: themeColor('secondaryText'),
                                    flex: 1
                                }}
                            >
                                {localeString(
                                    'views.PaymentRequest.enableDonations'
                                )}
                            </Text>
                            <View>
                                <Switch
                                    value={enableDonations}
                                    onValueChange={async () => {
                                        this.setState({
                                            enableDonations: !enableDonations
                                        });
                                        await updateSettings({
                                            payments: {
                                                ...settings.payments,
                                                enableDonations:
                                                    !enableDonations
                                            }
                                        });
                                    }}
                                />
                            </View>
                        </View>
                    )}

                    {enableDonations && isMainNet && (
                        <>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between'
                                }}
                            >
                                <Text
                                    style={{
                                        fontFamily: 'PPNeueMontreal-Book',
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.Payments.defaultDonationPercentage'
                                    )}
                                </Text>
                                <Text
                                    style={{ color: themeColor('highlight') }}
                                >
                                    {donationPercentage.toString()}%
                                </Text>
                            </View>
                            <View>
                                <Slider
                                    style={{
                                        width: '100%',
                                        height: 40,
                                        marginTop: 10
                                    }}
                                    minimumValue={0}
                                    maximumValue={100}
                                    step={1}
                                    value={donationPercentage}
                                    onValueChange={(value: number) => {
                                        this.setState({
                                            donationPercentage: value
                                        });
                                    }}
                                    onSlidingComplete={async (
                                        value: number
                                    ) => {
                                        await updateSettings({
                                            payments: {
                                                ...settings.payments,
                                                defaultDonationPercentage: value
                                            }
                                        });
                                    }}
                                    minimumTrackTintColor={themeColor(
                                        'highlight'
                                    )}
                                    maximumTrackTintColor={themeColor(
                                        'secondaryText'
                                    )}
                                />
                            </View>
                        </>
                    )}
                </View>
            </Screen>
        );
    }
}
