import * as React from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Keyboard
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../components/Button';
import Header from '../components/Header';
import LightningIndicator from '../components/LightningIndicator';
import Screen from '../components/Screen';

import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';

import MempoolSpace from '../assets/images/affiliates/Mempool.svg';
import Refresh from '../assets/images/SVG/Sync.svg';
import ErrorIcon from '../assets/images/SVG/ErrorIcon.svg';

import FeeStore from './../stores/FeeStore';
import SettingsStore from './../stores/SettingsStore';

interface EditFeeProps {
    FeeStore: FeeStore;
    SettingsStore: SettingsStore;
    navigation: StackNavigationProp<any, any>;
    displayOnly?: boolean;
    route: Route<
        'EditFee',
        {
            fee: any;
            displayOnly: boolean;
            onNavigateBack: (fee: any) => {};
        }
    >;
}

interface EditFeeState {
    customFee: string;
    selectedFee: string;
    fee: string;
}

@inject('FeeStore', 'SettingsStore')
@observer
export default class EditFee extends React.Component<
    EditFeeProps,
    EditFeeState
> {
    constructor(props: any) {
        super(props);
        this.state = {
            customFee: '',
            selectedFee: '',
            fee: ''
        };
    }

    async UNSAFE_componentWillMount() {
        const { FeeStore, SettingsStore, route } = this.props;
        const fee = route.params?.fee;
        const { settings } = SettingsStore;
        const fees: any = await FeeStore.getOnchainFeesviaMempool();

        const preferredMempoolRate =
            settings?.payments?.preferredMempoolRate || 'fastestFee';
        if (fee && fees?.[preferredMempoolRate] === fee) {
            this.setState({
                selectedFee: preferredMempoolRate,
                fee
            });
        }
    }

    render() {
        const { selectedFee, fee, customFee } = this.state;
        const { navigation, FeeStore, route } = this.props;
        const displayOnly = route.params?.displayOnly;
        const { recommendedFees, loading, error, getOnchainFeesviaMempool } =
            FeeStore;

        const ReloadButton = () => (
            <TouchableOpacity onPress={() => getOnchainFeesviaMempool()}>
                <Refresh
                    fill={themeColor('text')}
                    height={30}
                    width={41}
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
        );

        const keyboardVerticalOffset = Platform.OS === 'ios' ? 40 : 0;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: displayOnly
                            ? localeString('views.EditFee.titleDisplayOnly')
                            : localeString('views.EditFee.title'),
                        style: { color: themeColor('text') }
                    }}
                    rightComponent={ReloadButton()}
                    navigation={navigation}
                />
                <View
                    style={{
                        alignItems: 'center',
                        width: '100%',
                        paddingTop: 15,
                        paddingBottom: 15,
                        backgroundColor: themeColor('background'),
                        zIndex: 1
                    }}
                >
                    <MempoolSpace width={140} height={55} />
                </View>
                <KeyboardAvoidingView
                    behavior="position"
                    keyboardVerticalOffset={keyboardVerticalOffset}
                >
                    <ScrollView
                        style={{ paddingTop: 10, alignSelf: 'center' }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {loading && (
                            <View style={{ flex: 1, justifyContent: 'center' }}>
                                <LightningIndicator size={200} />
                            </View>
                        )}
                        {recommendedFees['fastestFee'] && !loading && (
                            <View
                                style={{
                                    justifyContent: 'space-around'
                                }}
                            >
                                <TouchableWithoutFeedback
                                    onPress={() => {
                                        this.setState({
                                            selectedFee: 'fastestFee',
                                            fee: recommendedFees[
                                                'fastestFee'
                                            ].toString()
                                        });
                                        Keyboard.dismiss();
                                    }}
                                >
                                    <View
                                        style={{
                                            ...styles.feeBox,
                                            borderColor:
                                                !displayOnly &&
                                                selectedFee === 'fastestFee'
                                                    ? themeColor('highlight')
                                                    : '#A7A9AC'
                                        }}
                                    >
                                        <Text
                                            style={{
                                                ...styles.feeTitle,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.EditFee.fastestFee'
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                ...styles.feeText,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {recommendedFees['fastestFee']}
                                        </Text>
                                    </View>
                                </TouchableWithoutFeedback>
                                <TouchableWithoutFeedback
                                    onPress={() => {
                                        this.setState({
                                            selectedFee: 'halfHourFee',
                                            fee: recommendedFees[
                                                'halfHourFee'
                                            ].toString()
                                        });
                                        Keyboard.dismiss();
                                    }}
                                >
                                    <View
                                        style={{
                                            ...styles.feeBox,
                                            borderColor:
                                                !displayOnly &&
                                                selectedFee === 'halfHourFee'
                                                    ? themeColor('highlight')
                                                    : '#A7A9AC'
                                        }}
                                    >
                                        <Text
                                            style={{
                                                ...styles.feeTitle,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.EditFee.halfHourFee'
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                ...styles.feeText,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {recommendedFees['halfHourFee']}
                                        </Text>
                                    </View>
                                </TouchableWithoutFeedback>
                                <TouchableWithoutFeedback
                                    onPress={() => {
                                        this.setState({
                                            selectedFee: 'hourFee',
                                            fee: recommendedFees[
                                                'hourFee'
                                            ].toString()
                                        });
                                        Keyboard.dismiss();
                                    }}
                                >
                                    <View
                                        style={{
                                            ...styles.feeBox,
                                            borderColor:
                                                !displayOnly &&
                                                selectedFee === 'hourFee'
                                                    ? themeColor('highlight')
                                                    : '#A7A9AC'
                                        }}
                                    >
                                        <Text
                                            style={{
                                                ...styles.feeTitle,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.EditFee.hourFee'
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                ...styles.feeText,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {recommendedFees['hourFee']}
                                        </Text>
                                    </View>
                                </TouchableWithoutFeedback>
                                <TouchableWithoutFeedback
                                    onPress={() => {
                                        this.setState({
                                            selectedFee: 'minimumFee',
                                            fee: recommendedFees[
                                                'minimumFee'
                                            ].toString()
                                        });
                                        Keyboard.dismiss();
                                    }}
                                >
                                    <View
                                        style={{
                                            ...styles.feeBox,
                                            borderColor:
                                                !displayOnly &&
                                                selectedFee === 'minimumFee'
                                                    ? themeColor('highlight')
                                                    : '#A7A9AC'
                                        }}
                                    >
                                        <Text
                                            style={{
                                                ...styles.feeTitle,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.EditFee.minimumFee'
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                ...styles.feeText,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {recommendedFees['minimumFee']}
                                        </Text>
                                    </View>
                                </TouchableWithoutFeedback>
                            </View>
                        )}
                        {error && !loading && (
                            <View
                                style={{
                                    alignItems: 'center'
                                }}
                            >
                                <ErrorIcon
                                    style={{
                                        alignItems: 'center',
                                        width: '20%',
                                        aspectRatio: 1,
                                        marginTop: 50
                                    }}
                                />
                                <Text
                                    style={{
                                        top: 20,
                                        fontSize: 20,
                                        color: themeColor('warning'),
                                        marginBottom: 49
                                    }}
                                >
                                    {localeString('views.EditFee.error')}
                                </Text>
                            </View>
                        )}
                        {!displayOnly && !loading && (
                            <View>
                                <Text
                                    style={{
                                        fontSize: 18,
                                        top: 48,
                                        left: 15,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString('general.custom')}
                                </Text>
                                <TouchableWithoutFeedback>
                                    <TextInput
                                        style={{
                                            ...styles.feeBox,
                                            textAlign: 'right',
                                            paddingRight: 15,
                                            borderColor:
                                                selectedFee === 'custom'
                                                    ? themeColor('highlight')
                                                    : '#A7A9AC',
                                            color: themeColor('text'),
                                            fontSize: 18,
                                            height: 52
                                        }}
                                        keyboardType="numeric"
                                        value={this.state.customFee}
                                        onChangeText={(text: string) => {
                                            text = text
                                                .replace(/[^0-9]*/g, '')
                                                .replace(/^0+/, '');
                                            this.setState({
                                                customFee: text,
                                                fee: text,
                                                selectedFee: 'custom'
                                            });
                                        }}
                                        onFocus={() =>
                                            this.setState({
                                                selectedFee: 'custom'
                                            })
                                        }
                                    />
                                </TouchableWithoutFeedback>

                                <View style={styles.confirmButton}>
                                    <Button
                                        title={localeString(
                                            'views.EditFee.confirmFee'
                                        )}
                                        onPress={() => {
                                            FeeStore.setTempFee(
                                                selectedFee === 'custom'
                                                    ? customFee
                                                    : fee
                                            );
                                            navigation.goBack();
                                        }}
                                        disabled={
                                            !fee ||
                                            (selectedFee === 'custom' &&
                                                !customFee)
                                        }
                                    />
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </Screen>
        );
    }
}
const styles = StyleSheet.create({
    feeBox: {
        width: 350,
        borderWidth: 3,
        borderRadius: 4,
        marginTop: 10,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingLeft: 15,
        paddingRight: 15,
        paddingTop: 10,
        paddingBottom: 10
    },
    feeTitle: {
        fontSize: 18
    },
    feeText: {
        fontSize: 18
    },
    confirmButton: {
        marginTop: 20,
        width: 350
    }
});
