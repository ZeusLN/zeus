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
    feeLimit: number;
    feePercentage: number;
}

@inject('SettingsStore')
@observer
export default class PaymentsSettings extends React.Component<
    PaymentsSettingsProps,
    PaymentsSettingsState
> {
    state = {
        feeLimitMethod: '',
        feeLimit: 0,
        feePercentage: 0,
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();
        console.log(settings);

        this.setState({
            feeLimitMethod: settings.payments.defaultFeeMethod,
            feeLimit: settings.payments.defaultFeeFixed,
            feePercentage: settings.payments.defaultFeePercentage
            // defaultBlockExplorer:
            //     (settings.privacy && settings.privacy.defaultBlockExplorer) ||
            //     'mempool.space',
            // customBlockExplorer:
            //     (settings.privacy && settings.privacy.customBlockExplorer) ||
            //     '',
            // clipboard: settings.privacy && settings.privacy.clipboard,
            // lurkerMode: settings.privacy && settings.privacy.lurkerMode,
            // enableMempoolRates:
            //     settings.privacy && settings.privacy.enableMempoolRates
        });
    }

    handleSave = async () => {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();
        console.log(settings.payments);
        // await updateSettings
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
        const { feeLimit } = this.state;
        const { loading }: any = SettingsStore;

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
                                color: themeColor('secondaryText'),
                                fontFamily: 'Lato-Regular',
                                paddingTop: 5
                            }}
                        >
                            {localeString(
                                'views.Settings.Payments.defaultFeeLimit'
                            )}
                        </Text>
                        <TextInput
                            keyboardType="numeric"
                            value={feeLimit}
                            onChangeText={(text: string) =>
                                this.setState({
                                    feeLimit: text
                                })
                            }
                            style={{
                                color: themeColor('text')
                            }}
                            placeholderTextColor="gray"
                        />
                        <View
                            style={{
                                paddingTop: 480,
                                paddingBottom: 15,
                                paddingLeft: 5,
                                paddingRight: 5
                        }}>
                            <Button
                                title="Save"
                                icon={{
                                    name: 'save',
                                    size: 1,
                                    color: 'white'
                                }}
                                onPress={() => {
                                    this.handleSave();
                                }}
                            />
                        </View>
                    </View>
                )}
            </View>
        );
    }
}
