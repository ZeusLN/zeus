import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    TouchableOpacity,
    TouchableWithoutFeedback
} from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from '../components/Button';
import Header from '../components/Header';
import LightningIndicator from '../components/LightningIndicator';
import Screen from '../components/Screen';

import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';

import MempoolSpace from '../assets/images/affiliates/Mempool.svg';
import Refresh from '../assets/images/SVG/Refresh.svg';
import ErrorIcon from '../assets/images/SVG/ErrorIcon.svg';

import FeeStore from './../stores/FeeStore';
import { FeeType } from '../enums';

interface EditFeeProps {
    FeeStore: FeeStore;
    navigation: any;
    displayOnly?: boolean;
}

interface EditFeeState {
    customFee: string;
    selectedFee: string;
    fee: string;
}

@inject('FeeStore')
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

    UNSAFE_componentWillMount() {
        const { FeeStore } = this.props;
        FeeStore.getOnchainFeesviaMempool();
    }

    render() {
        const { selectedFee } = this.state;
        const { navigation, FeeStore } = this.props;
        const displayOnly = navigation.getParam('displayOnly', null);
        const { recommendedFees, loading, error, getOnchainFeesviaMempool } =
            FeeStore;

        const ReloadButton = () => (
            <TouchableOpacity onPress={() => getOnchainFeesviaMempool()}>
                <Refresh stroke={themeColor('text')} />
            </TouchableOpacity>
        );

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
                    rightComponent={ReloadButton}
                    navigation={navigation}
                />
                <View
                    style={{
                        alignItems: 'center',
                        width: '100%',
                        paddingTop: 15,
                        paddingBottom: 15
                    }}
                >
                    <MempoolSpace width={140} height={55} />
                </View>
                <ScrollView style={{ paddingTop: 10, alignSelf: 'center' }}>
                    {loading && !error && (
                        <View style={{ flex: 1, justifyContent: 'center' }}>
                            <LightningIndicator />
                        </View>
                    )}
                    {recommendedFees[FeeType.FastestFee] && !loading && (
                        <View
                            style={{
                                justifyContent: 'space-around'
                            }}
                        >
                            <TouchableWithoutFeedback
                                onPress={() =>
                                    this.setState({
                                        selectedFee: FeeType.FastestFee,
                                        fee: recommendedFees[
                                            FeeType.FastestFee
                                        ].toString()
                                    })
                                }
                            >
                                <View
                                    style={{
                                        ...styles.feeBox,
                                        borderColor:
                                            !displayOnly &&
                                            selectedFee === FeeType.FastestFee
                                                ? themeColor('highlight')
                                                : '#A7A9AC',
                                        borderWidth: 3
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
                                        {recommendedFees[FeeType.FastestFee]}
                                    </Text>
                                </View>
                            </TouchableWithoutFeedback>
                            <TouchableWithoutFeedback
                                onPress={() =>
                                    this.setState({
                                        selectedFee: FeeType.HalfHourFee,
                                        fee: recommendedFees[
                                            FeeType.HalfHourFee
                                        ].toString()
                                    })
                                }
                            >
                                <View
                                    style={{
                                        ...styles.feeBox,
                                        borderColor:
                                            !displayOnly &&
                                            selectedFee === FeeType.HalfHourFee
                                                ? themeColor('highlight')
                                                : '#A7A9AC',
                                        borderWidth: 3
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
                                        {recommendedFees[FeeType.HalfHourFee]}
                                    </Text>
                                </View>
                            </TouchableWithoutFeedback>

                            <TouchableWithoutFeedback
                                onPress={() =>
                                    this.setState({
                                        selectedFee: FeeType.HourFee,
                                        fee: recommendedFees[
                                            FeeType.HourFee
                                        ].toString()
                                    })
                                }
                            >
                                <View
                                    style={{
                                        ...styles.feeBox,
                                        borderColor:
                                            !displayOnly &&
                                            selectedFee === FeeType.HourFee
                                                ? themeColor('highlight')
                                                : '#A7A9AC',
                                        borderWidth: 3
                                    }}
                                >
                                    <Text
                                        style={{
                                            ...styles.feeTitle,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString('views.EditFee.hourFee')}
                                    </Text>
                                    <Text
                                        style={{
                                            ...styles.feeText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {recommendedFees[FeeType.HourFee]}
                                    </Text>
                                </View>
                            </TouchableWithoutFeedback>
                            <TouchableWithoutFeedback
                                onPress={() =>
                                    this.setState({
                                        selectedFee: FeeType.MinimumFee,
                                        fee: recommendedFees[
                                            FeeType.MinimumFee
                                        ].toString()
                                    })
                                }
                            >
                                <View
                                    style={{
                                        ...styles.feeBox,
                                        borderColor:
                                            !displayOnly &&
                                            selectedFee === FeeType.MinimumFee
                                                ? themeColor('highlight')
                                                : '#A7A9AC',
                                        borderWidth: 3
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
                                        {recommendedFees[FeeType.MinimumFee]}
                                    </Text>
                                </View>
                            </TouchableWithoutFeedback>

                            {!displayOnly && (
                                <>
                                    <Text
                                        style={{
                                            ...styles.custom,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString('views.EditFee.custom')}
                                    </Text>
                                    <TouchableWithoutFeedback>
                                        <TextInput
                                            style={{
                                                ...styles.feeBox,
                                                textAlign: 'right',
                                                paddingRight: 15,
                                                borderColor:
                                                    selectedFee === 'custom'
                                                        ? themeColor(
                                                              'highlight'
                                                          )
                                                        : '#A7A9AC',
                                                borderWidth: 3,
                                                color: themeColor('text'),
                                                fontSize: 18,
                                                height: 52
                                            }}
                                            keyboardType="numeric"
                                            defaultValue={this.state.customFee}
                                            onChangeText={(text: string) =>
                                                this.setState({
                                                    customFee: text,
                                                    fee: text,
                                                    selectedFee: 'custom'
                                                })
                                            }
                                        ></TextInput>
                                    </TouchableWithoutFeedback>

                                    <View style={styles.confirmButton}>
                                        <Button
                                            title={localeString(
                                                'views.EditFee.confirmFee'
                                            )}
                                            onPress={() => {
                                                this.props.navigation.state.params.onNavigateBack(
                                                    this.state.fee
                                                );
                                                this.props.navigation.goBack();
                                            }}
                                        />
                                    </View>
                                </>
                            )}
                        </View>
                    )}
                    {error && !loading && (
                        <View
                            style={{
                                flex: 1,
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: 500
                            }}
                        >
                            <ErrorIcon />
                            <Text
                                style={{
                                    top: 20,
                                    fontSize: 30,
                                    color: '#E14C4C'
                                }}
                            >
                                {localeString('views.EditFee.error')}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}
const styles = StyleSheet.create({
    feeBox: {
        width: 350,
        borderRadius: 4,
        marginTop: 10,
        marginBottom: 10
    },
    feeTitle: {
        fontSize: 18,
        left: 10,
        top: 10
    },
    feeText: {
        top: -12,
        fontSize: 18,
        textAlign: 'right',
        paddingRight: 15
    },
    custom: {
        color: '#A7A9AC',
        fontSize: 18,
        top: 48,
        left: 15
    },
    confirmButton: {
        marginTop: 20,
        width: 350
    }
});
