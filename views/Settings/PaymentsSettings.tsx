import * as React from 'react';
import { Text, View } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import SettingsStore from '../../stores/SettingsStore';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import LoadingIndicator from '../../components/LoadingIndicator';
import TextInput from '../../components/TextInput';
import Button from '../../components/Button';

interface PaymentsSettingsProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface PaymentsSettingsState {
    feeLimitMethod: string;
    feeLimit: string;
    feePercentage: string;
}

@inject('SettingsStore')
@observer
export default class PaymentsSettings extends React.Component<
    PaymentsSettingsProps,
    PaymentsSettingsState
> {
    state = {
        feeLimitMethod: 'fixed',
        feeLimit: '100',
        feePercentage: '0.5'
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            feeLimitMethod: settings.payments.defaultFeeMethod || 'fixed',
            feeLimit: settings.payments.defaultFeeFixed || '100',
            feePercentage: settings.payments.defaultFeePercentage || '0.5'
        });
    }

    handleSave = async () => {
        const { feeLimitMethod, feeLimit, feePercentage } = this.state;
        const { SettingsStore } = this.props;
        const { updateSettings, settings } = SettingsStore;
        await updateSettings({
            payments: {
                defaultFeeMethod: feeLimitMethod,
                defaultFeePercentage: feePercentage,
                defaultFeeFixed: feeLimit
            }
        });
        console.log(settings.payments);
    };

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
        const { feeLimit, feeLimitMethod, feePercentage } = this.state;
        const { loading }: any = SettingsStore;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => {
                    this.handleSave();
                    navigation.navigate('Settings', {
                        refresh: true
                    });
                }}
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
                        text: localeString('views.Settings.Payments.title'),
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
                    <View
                        style={{
                            padding: 20
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: 'Lato-Regular',
                                paddingTop: 5,
                                color: themeColor('text')
                            }}
                        >
                            {`${localeString(
                                'views.Settings.Payments.defaultFeeLimit'
                            )}`}
                        </Text>
                        <View
                            style={{
                                flex: 1,
                                flexWrap: 'wrap',
                                flexDirection: 'row',
                                justifyContent: 'flex-end',
                                opacity: feeLimitMethod == 'percent' ? 1 : 0.25
                            }}
                        ></View>
                        <View
                            style={{
                                flexDirection: 'row',
                                width: '95%'
                            }}
                        >
                            <TextInput
                                style={{
                                    width: '50%',
                                    opacity:
                                        feeLimitMethod == 'fixed' ? 1 : 0.25
                                }}
                                keyboardType="numeric"
                                value={feeLimit}
                                onChangeText={(text: string) =>
                                    this.setState({
                                        feeLimit: text
                                    })
                                }
                                onPressIn={() =>
                                    this.setState({
                                        feeLimitMethod: 'fixed'
                                    })
                                }
                            />
                            <Text
                                style={{
                                    fontFamily: 'Lato-Regular',
                                    paddingTop: 5,
                                    color: themeColor('text'),
                                    top: 28,
                                    right: 30,
                                    opacity:
                                        feeLimitMethod == 'fixed' ? 1 : 0.25
                                }}
                            >
                                {`${localeString('general.sats')}`}
                            </Text>
                            <TextInput
                                style={{
                                    width: '50%',
                                    opacity:
                                        feeLimitMethod == 'percent' ? 1 : 0.25
                                }}
                                keyboardType="numeric"
                                value={feePercentage}
                                onChangeText={(text: string) =>
                                    this.setState({
                                        feePercentage: text
                                    })
                                }
                                onPressIn={() =>
                                    this.setState({
                                        feeLimitMethod: 'percent'
                                    })
                                }
                            />
                            <Text
                                style={{
                                    fontFamily: 'Lato-Regular',
                                    paddingTop: 5,
                                    color: themeColor('text'),
                                    top: 28,
                                    right: 18,
                                    opacity:
                                        feeLimitMethod == 'percent' ? 1 : 0.25
                                }}
                            >
                                {'%'}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        );
    }
}
