import * as React from 'react';
import { StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { ButtonGroup } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../components/Button';
import Header from '../components/Header';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import {
    SuccessMessage,
    ErrorMessage
} from '../components/SuccessErrorMessage';
import Switch from '../components/Switch';
import Text from '../components/Text';
import TextInput from '../components/TextInput';

import FeeStore from '../stores/FeeStore';
import SettingsStore from '../stores/SettingsStore';

import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';

interface BumpFeeProps {
    navigation: StackNavigationProp<any, any>;
    FeeStore: FeeStore;
    SettingsStore: SettingsStore;
    route: Route<
        'BumpFee',
        {
            outpoint: string;
            channel: boolean;
        }
    >;
}

interface BumpFeeState {
    outpoint: string;
    target_conf: string;
    sat_per_vbyte: string;
    immediate: boolean;
    target_type: number;
    budget: string;
}

@inject('FeeStore', 'SettingsStore')
@observer
export default class BumpFee extends React.PureComponent<
    BumpFeeProps,
    BumpFeeState
> {
    constructor(props: any) {
        super(props);
        const outpoint = this.props.route.params?.outpoint ?? '';
        this.state = {
            outpoint,
            target_conf: '1',
            sat_per_vbyte: '1',
            immediate: false,
            target_type: 0,
            budget: ''
        };
    }

    UNSAFE_componentWillMount() {
        this.props.FeeStore.resetFees();
    }

    handleOnNavigateBack = (sat_per_vbyte: string) => {
        this.setState({
            sat_per_vbyte
        });
    };

    render() {
        const { FeeStore, SettingsStore, navigation, route } = this.props;
        const {
            outpoint,
            target_conf,
            sat_per_vbyte,
            immediate,
            target_type,
            budget
        } = this.state;

        const {
            bumpFeeOpeningChannel,
            bumpFeeSuccess,
            bumpFeeError,
            bumpFeeErrorMsg,
            loading
        } = FeeStore;
        const { settings } = SettingsStore;
        const { privacy } = settings;
        const enableMempoolRates = privacy && privacy.enableMempoolRates;

        const isChannel = route.params?.channel;

        const feeRateButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        target_type === 0
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('views.OpenChannel.satsPerVbyte')}
            </Text>
        );

        const targetConfButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        target_type === 1
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('views.BumpFee.targetConfs')}
            </Text>
        );

        const buttons: any[] = [
            { element: feeRateButton },
            { element: targetConfButton }
        ];

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: isChannel
                            ? localeString('views.BumpFee.titleAlt')
                            : localeString('views.BumpFee.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View
                    style={{
                        top: 5,
                        padding: 15
                    }}
                >
                    {loading && <LoadingIndicator />}

                    {bumpFeeSuccess && (
                        <SuccessMessage
                            message={localeString('views.BumpFee.success')}
                        />
                    )}
                    {bumpFeeError && (
                        <ErrorMessage
                            message={
                                bumpFeeErrorMsg ||
                                localeString('views.BumpFee.error')
                            }
                        />
                    )}

                    <Text
                        style={{
                            ...styles.text,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {localeString('general.outpoint')}
                    </Text>
                    <TextInput
                        placeholder={'4a5e1e...eda33b:0'}
                        value={outpoint}
                        onChangeText={(text: string) =>
                            this.setState({
                                outpoint: text
                            })
                        }
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <ButtonGroup
                        onPress={(target_type: number) => {
                            this.setState({ target_type });
                        }}
                        selectedIndex={target_type}
                        buttons={buttons}
                        selectedButtonStyle={{
                            backgroundColor: themeColor('highlight'),
                            borderRadius: 12
                        }}
                        containerStyle={{
                            backgroundColor: themeColor('secondary'),
                            borderRadius: 12,
                            borderColor: themeColor('secondary'),
                            marginBottom: 15
                        }}
                        innerBorderStyle={{
                            color: themeColor('secondary')
                        }}
                    />

                    {target_type === 0 && (
                        <>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('views.OpenChannel.satsPerVbyte')}
                            </Text>
                            {enableMempoolRates ? (
                                <TouchableWithoutFeedback
                                    onPress={() =>
                                        navigation.navigate('EditFee', {
                                            onNavigateBack:
                                                this.handleOnNavigateBack
                                        })
                                    }
                                >
                                    <View
                                        style={{
                                            ...styles.editFeeBox,
                                            borderColor:
                                                'rgba(255, 217, 63, .6)',
                                            borderWidth: 3
                                        }}
                                    >
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor('text'),
                                                fontSize: 18
                                            }}
                                        >
                                            {sat_per_vbyte}
                                        </Text>
                                    </View>
                                </TouchableWithoutFeedback>
                            ) : (
                                <View style={styles.targetForm}>
                                    <TextInput
                                        keyboardType="numeric"
                                        placeholder={'2'}
                                        value={sat_per_vbyte}
                                        onChangeText={(text: string) =>
                                            this.setState({
                                                sat_per_vbyte: text
                                            })
                                        }
                                    />
                                </View>
                            )}
                        </>
                    )}

                    {target_type === 1 && (
                        <>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('views.BumpFee.targetConfs')}
                            </Text>
                            <View style={styles.targetForm}>
                                <TextInput
                                    keyboardType="numeric"
                                    placeholder={'1'}
                                    value={target_conf}
                                    onChangeText={(text: string) =>
                                        this.setState({
                                            target_conf: text
                                        })
                                    }
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </View>
                        </>
                    )}

                    <Text
                        style={{
                            ...styles.text,
                            color: themeColor('secondaryText')
                        }}
                        infoModalText={[
                            localeString('views.BumpFee.budget.explainer1'),
                            localeString('views.BumpFee.budget.explainer2')
                        ]}
                    >
                        {`${localeString(
                            'views.BumpFee.budget'
                        )} (${localeString('general.optional')})`}
                    </Text>
                    <TextInput
                        value={budget}
                        onChangeText={(text: string) => {
                            if (!isNaN(Number(text))) {
                                this.setState({
                                    budget: text
                                });
                            }
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="numeric"
                    />

                    <View style={{ marginTop: 20, marginBottom: 10 }}>
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('secondaryText')
                            }}
                            infoModalText={localeString(
                                'views.BumpFee.immediate.explainer'
                            )}
                        >
                            {localeString('general.immediate')}
                        </Text>
                        <View
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                justifyContent: 'flex-end',
                                top: 5
                            }}
                        >
                            <Switch
                                value={immediate}
                                onValueChange={() => {
                                    this.setState({
                                        immediate: !immediate
                                    });
                                }}
                            />
                        </View>
                    </View>

                    <View style={{ marginTop: 20 }}>
                        <Button
                            title={
                                isChannel
                                    ? localeString('views.BumpFee.titleAlt')
                                    : localeString('views.BumpFee.title')
                            }
                            onPress={() =>
                                bumpFeeOpeningChannel(
                                    target_type === 0
                                        ? {
                                              outpoint,
                                              sat_per_vbyte,
                                              immediate,
                                              budget
                                          }
                                        : {
                                              outpoint,
                                              target_conf,
                                              immediate,
                                              budget
                                          }
                                )
                            }
                            noUppercase
                        />
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    button: {
        paddingTop: 15,
        paddingBottom: 10
    },
    editFeeBox: {
        height: 65,
        padding: 15,
        marginTop: 15,
        borderRadius: 4,
        borderColor: '#FFD93F',
        borderWidth: 2,
        marginBottom: 20
    },
    targetForm: { marginTop: 10, paddingBottom: 10 }
});
