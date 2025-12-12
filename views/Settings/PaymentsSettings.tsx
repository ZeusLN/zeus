import * as React from 'react';
import { View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import Slider from '@react-native-community/slider';

import DropdownSetting from '../../components/DropdownSetting';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';

import SettingsStore, { MEMPOOL_RATES_KEYS } from '../../stores/SettingsStore';
import NodeInfoStore from '../../stores/NodeInfoStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import AmountInput from '../../components/AmountInput';

interface PaymentsSettingsProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    NodeInfoStore: NodeInfoStore;
}

interface PaymentsSettingsState {
    feeLimitMethod: string;
    feeLimit: string;
    feePercentage: string;
    timeoutSeconds: string;
    enableMempoolRates: boolean;
    preferredMempoolRate: string;
    slideToPayThreshold: string;
    enableDonations: boolean;
    donationPercentage: number;
    mounted?: boolean;
}

@inject('SettingsStore', 'NodeInfoStore')
@observer
export default class PaymentsSettings extends React.Component<
    PaymentsSettingsProps,
    PaymentsSettingsState
> {
    state = {
        feeLimitMethod: 'fixed',
        feeLimit: '1000',
        feePercentage: '5.0',
        timeoutSeconds: '60',
        enableMempoolRates: false,
        preferredMempoolRate: 'fastestFee',
        slideToPayThreshold: '10000',
        enableDonations: false,
        donationPercentage: 5,
        mounted: false
    };

    async componentDidMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            feeLimitMethod: settings?.payments?.defaultFeeMethod || 'fixed',
            feeLimit: settings?.payments?.defaultFeeFixed || '1000',
            feePercentage: settings?.payments?.defaultFeePercentage || '5.0',
            enableMempoolRates: settings?.privacy?.enableMempoolRates || false,
            timeoutSeconds: settings?.payments?.timeoutSeconds || '60',
            preferredMempoolRate:
                settings?.payments?.preferredMempoolRate || 'fastestFee',
            slideToPayThreshold:
                settings?.payments?.slideToPayThreshold?.toString() || '10000',
            enableDonations: settings?.payments?.enableDonations || false,
            donationPercentage:
                settings?.payments?.defaultDonationPercentage || 5,
            mounted: true
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
        const { navigation } = this.props;
        const {
            feeLimit,
            feePercentage,
            enableMempoolRates,
            timeoutSeconds,
            preferredMempoolRate,
            slideToPayThreshold,
            enableDonations,
            donationPercentage
        } = this.state;
        const { SettingsStore, NodeInfoStore } = this.props;
        const { nodeInfo } = NodeInfoStore;
        const { isMainNet } = nodeInfo;

        const { updateSettings, settings, implementation } = SettingsStore;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.Payments.title'),
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
                    {BackendUtils.isLNDBased() && (
                        <View style={{ marginBottom: 20 }}>
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {`${localeString(
                                    'general.lightning'
                                )} - ${localeString(
                                    'views.Settings.Payments.defaultFeeLimit'
                                )}`}
                            </Text>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    width: '95%'
                                }}
                            >
                                <TextInput
                                    style={{
                                        width: '50%'
                                    }}
                                    keyboardType="numeric"
                                    value={feeLimit}
                                    onChangeText={async (text: string) => {
                                        this.setState({
                                            feeLimit: text
                                        });
                                        await updateSettings({
                                            payments: {
                                                ...settings.payments,
                                                defaultFeeMethod: 'fixed',
                                                defaultFeeFixed: text
                                            }
                                        });
                                    }}
                                    onPressIn={() =>
                                        this.setState({
                                            feeLimitMethod: 'fixed'
                                        })
                                    }
                                />
                                <Text
                                    style={{
                                        fontFamily: 'PPNeueMontreal-Book',
                                        paddingTop: 5,
                                        color: themeColor('text'),
                                        top: 28,
                                        right: 35
                                    }}
                                >
                                    {localeString('general.sats')}
                                </Text>
                                <TextInput
                                    style={{
                                        width: '50%',
                                        right: 5
                                    }}
                                    keyboardType="numeric"
                                    value={feePercentage}
                                    onChangeText={async (text: string) => {
                                        this.setState({
                                            feePercentage: text
                                        });
                                        await updateSettings({
                                            payments: {
                                                ...settings.payments,
                                                defaultFeeMethod: 'percent',
                                                defaultFeePercentage: text
                                            }
                                        });
                                    }}
                                    onPressIn={() =>
                                        this.setState({
                                            feeLimitMethod: 'percent'
                                        })
                                    }
                                />
                                <Text
                                    style={{
                                        fontFamily: 'PPNeueMontreal-Book',
                                        paddingTop: 5,
                                        color: themeColor('text'),
                                        top: 28,
                                        right: 25
                                    }}
                                >
                                    {'%'}
                                </Text>
                            </View>
                            <Text style={{ color: themeColor('text') }}>
                                {localeString(
                                    'views.Settings.Payments.feeLimitMethodExplainer'
                                )}
                            </Text>
                        </View>
                    )}

                    {implementation === 'cln-rest' && (
                        <View>
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {`${localeString(
                                    'general.lightning'
                                )} - ${localeString(
                                    'views.Settings.Payments.defaultFeeLimit'
                                )}`}
                            </Text>
                            <View
                                style={{
                                    flex: 1,
                                    flexWrap: 'wrap',
                                    flexDirection: 'row',
                                    justifyContent: 'flex-end'
                                }}
                            ></View>
                            <View
                                style={{
                                    flexDirection: 'row'
                                }}
                            >
                                <TextInput
                                    keyboardType="numeric"
                                    value={feePercentage}
                                    onChangeText={async (text: string) => {
                                        this.setState({
                                            feePercentage: text
                                        });
                                        await updateSettings({
                                            payments: {
                                                ...settings.payments,
                                                defaultFeeMethod: 'percent',
                                                defaultFeePercentage: text
                                            }
                                        });
                                    }}
                                    onPressIn={() =>
                                        this.setState({
                                            feeLimitMethod: 'percent'
                                        })
                                    }
                                />
                                <Text
                                    style={{
                                        fontFamily: 'PPNeueMontreal-Book',
                                        paddingTop: 5,
                                        color: themeColor('text'),
                                        top: 28,
                                        right: 28
                                    }}
                                >
                                    {'%'}
                                </Text>
                            </View>
                        </View>
                    )}

                    <AmountInput
                        amount={slideToPayThreshold.toString()}
                        title={
                            localeString('general.lightning') +
                            ' - ' +
                            localeString(
                                'views.Settings.Payments.slideToPayThreshold'
                            )
                        }
                        onAmountChange={async (amount, _) => {
                            this.setState({
                                slideToPayThreshold: amount
                            });
                            const amountNumber = Number(amount);
                            // ensure settings are loading and everything is mounted
                            // before we attempt to update settings
                            // solves ZEUS-2802
                            if (
                                this.state.mounted &&
                                !Number.isNaN(amountNumber)
                            ) {
                                await updateSettings({
                                    payments: {
                                        ...settings.payments,
                                        slideToPayThreshold: Number(amount)
                                    }
                                });
                            }
                        }}
                        hideConversion={true}
                        hideUnitChangeButton={true}
                        forceUnit="sats"
                    />

                    {(BackendUtils.isLNDBased() ||
                        implementation === 'cln-rest') && (
                        <>
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    paddingTop: 5,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {`${localeString(
                                    'general.lightning'
                                )} - ${localeString(
                                    'views.Settings.Payments.timeoutSeconds'
                                )}`}
                            </Text>
                            <TextInput
                                keyboardType="numeric"
                                value={timeoutSeconds}
                                onChangeText={async (text: string) => {
                                    this.setState({
                                        timeoutSeconds: text
                                    });
                                    await updateSettings({
                                        payments: {
                                            ...settings.payments,
                                            timeoutSeconds: text
                                        }
                                    });
                                }}
                            />
                        </>
                    )}
                    <View
                        style={{
                            flexDirection: 'row',
                            marginTop: 16
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
                                'views.Settings.Privacy.enableMempoolRates'
                            )}
                        </Text>
                        <View style={{ alignSelf: 'center', marginLeft: 5 }}>
                            <Switch
                                value={enableMempoolRates}
                                onValueChange={async () => {
                                    this.setState({
                                        enableMempoolRates: !enableMempoolRates
                                    });
                                    await updateSettings({
                                        privacy: {
                                            ...settings.privacy,
                                            enableMempoolRates:
                                                !enableMempoolRates
                                        }
                                    });
                                }}
                            />
                        </View>
                    </View>
                    <View style={{ marginTop: 12 }}>
                        <DropdownSetting
                            title={localeString(
                                'views.Settings.Payments.preferredMempoolRate'
                            )}
                            selectedValue={preferredMempoolRate}
                            onValueChange={async (value: string) => {
                                this.setState({
                                    preferredMempoolRate: value
                                });
                                await updateSettings({
                                    payments: {
                                        ...settings.payments,
                                        preferredMempoolRate: value
                                    }
                                });
                            }}
                            values={MEMPOOL_RATES_KEYS}
                            disabled={!enableMempoolRates}
                        />
                    </View>
                    {isMainNet && (
                        <View
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                marginTop: 16,
                                marginBottom: 16
                            }}
                        >
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: themeColor('secondaryText'),
                                    flex: 1
                                }}
                                infoModalText={localeString(
                                    'views.PaymentRequest.donationInfo'
                                )}
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
                                    {`${donationPercentage.toString()}%`}
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
