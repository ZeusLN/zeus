import * as React from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    ActivityIndicator,
    View,
    TouchableOpacity,
    TouchableWithoutFeedback
} from 'react-native';
import { Icon, Header } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import Button from '../components/Button';
import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';
import Refresh from '../images/SVG/Refresh.svg';
import FeeStore from './../stores/FeeStore';

interface NodeInfoProps {
    FeeStore: FeeStore;
    navigation: any;
}

interface SendState {
    customFee: string;
    selectedFee: string;
    fee: string;
}

@inject('FeeStore')
@observer
export default class EditFee extends React.Component<NodeInfoProps, SendState> {
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
        const { navigation, FeeStore } = this.props;
        const { selectedFee } = this.state;
        const { recommendedFees, loading, error, getOnchainFeesviaMempool } =
            FeeStore;
        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Send')}
                color="#fff"
                underlayColor="transparent"
            />
        );
        const ReloadButton = () => (
            <TouchableOpacity onPress={() => getOnchainFeesviaMempool()}>
                <Refresh stroke={themeColor('text')} />
            </TouchableOpacity>
        );
        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    centerComponent={{
                        text: 'Edit network fee',
                        style: { color: themeColor('text'), fontSize: 18 }
                    }}
                    backgroundColor={themeColor('background')}
                    leftComponent={<BackButton />}
                    rightComponent={<ReloadButton />}
                />
                {loading && !error && (
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <ActivityIndicator size="large" color="#0000ff" />
                    </View>
                )}
                {recommendedFees['fastestFee'] && !loading && (
                    <View
                        style={{
                            flex: 1,
                            backgroundColor: themeColor('background'),
                            alignItems: 'center',
                            justifyContent: 'space-around'
                        }}
                    >
                        <TouchableWithoutFeedback
                            onPress={() =>
                                this.setState({
                                    selectedFee: 'fastestFee',
                                    fee: recommendedFees[
                                        'fastestFee'
                                    ].toString()
                                })
                            }
                        >
                            <View
                                style={{
                                    ...styles.feeBoxes,
                                    borderColor:
                                        selectedFee === 'fastestFee'
                                            ? 'rgba(255, 217, 63, .6)'
                                            : '#A7A9AC',
                                    borderWidth:
                                        selectedFee === 'fastestFee' ? 3 : 1
                                }}
                            >
                                <Text style={styles.feeTitle}>
                                    {localeString('views.EditFee.fastestFee')}
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
                            onPress={() =>
                                this.setState({
                                    selectedFee: 'halfHourFee',
                                    fee: recommendedFees[
                                        'halfHourFee'
                                    ].toString()
                                })
                            }
                        >
                            <View
                                style={{
                                    ...styles.feeBoxes,
                                    borderColor:
                                        selectedFee === 'halfHourFee'
                                            ? 'rgba(255, 217, 63, .6)'
                                            : '#A7A9AC',
                                    borderWidth:
                                        selectedFee === 'halfHourFee' ? 3 : 1
                                }}
                            >
                                <Text style={styles.feeTitle}>
                                    {localeString('views.EditFee.halfHourFee')}
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
                            onPress={() =>
                                this.setState({
                                    selectedFee: 'hourFee',
                                    fee: recommendedFees['hourFee'].toString()
                                })
                            }
                        >
                            <View
                                style={{
                                    ...styles.feeBoxes,
                                    borderColor:
                                        selectedFee === 'hourFee'
                                            ? 'rgba(255, 217, 63, .6)'
                                            : '#A7A9AC',
                                    borderWidth:
                                        selectedFee === 'hourFee' ? 3 : 1
                                }}
                            >
                                <Text style={styles.feeTitle}>
                                    {localeString('views.EditFee.hourFee')}
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
                            onPress={() =>
                                this.setState({
                                    selectedFee: 'minimumFee',
                                    fee: recommendedFees[
                                        'minimumFee'
                                    ].toString()
                                })
                            }
                        >
                            <View
                                style={{
                                    ...styles.feeBoxes,
                                    borderColor:
                                        selectedFee === 'minimumFee'
                                            ? 'rgba(255, 217, 63, .6)'
                                            : '#A7A9AC',
                                    borderWidth:
                                        selectedFee === 'minimumFee' ? 3 : 1
                                }}
                            >
                                <Text style={styles.feeTitle}>
                                    {localeString('views.EditFee.minimumFee')}
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

                        <View>
                            <Text style={styles.custom}>
                                {localeString('views.EditFee.custom')}
                            </Text>
                        </View>
                        <TouchableWithoutFeedback>
                            <TextInput
                                style={{
                                    ...styles.feeBoxes,
                                    top: 25,
                                    marginTop: 25,
                                    borderColor:
                                        selectedFee === 'custom'
                                            ? 'rgba(255, 217, 63, .6)'
                                            : '#A7A9AC',
                                    borderWidth:
                                        selectedFee === 'custom' ? 3 : 1,
                                    color: '#FFFFFF',
                                    fontSize: 18
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
                                title={localeString('views.EditFee.confirmFee')}
                                onPress={() => {
                                    this.props.navigation.state.params.onNavigateBack(
                                        this.state.fee
                                    );
                                    this.props.navigation.goBack();
                                }}
                            />
                        </View>
                    </View>
                )}
                {error && !loading && (
                    <Text
                        style={{
                            fontSize: 30,
                            color: 'red',
                            textAlign: 'center',
                            top: '40%'
                        }}
                    >
                        {localeString('views.EditFee.error')}
                    </Text>
                )}
            </View>
        );
    }
}
const styles = StyleSheet.create({
    feeBoxes: {
        height: 65,
        width: 350,
        top: 15,
        bottom: 15,
        borderRadius: 4
    },
    feeTitle: {
        color: '#fff',
        fontSize: 18,
        left: 10,
        top: 20
    },
    feeText: {
        fontSize: 18,
        left: '90%',
        top: -4
    },
    custom: {
        color: '#A7A9AC',
        fontSize: 20,
        left: '-35%',
        top: 55
    },
    confirmButton: {
        width: 350
    }
});
