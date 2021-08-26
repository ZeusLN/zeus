import * as React from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    View,
    TouchableOpacity,
    TouchableWithoutFeedback
} from 'react-native';
import { Icon, Header } from 'react-native-elements';
import Spinner from '../images/SVG/spinning-circles.svg';
import { themeColor } from '../utils/ThemeUtils';
import FeeStore from './../stores/FeeStore';
import { inject, observer } from 'mobx-react';
import { localeString } from '../utils/LocaleUtils';
import Refresh from '../images/SVG/Refresh.svg';

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
    UNSAFE_componentWillMount() {
        const { FeeStore } = this.props;
        FeeStore.getOnchainFeesviaMempool();
    }

    constructor(props: any) {
        super(props);
        this.state = {
            customFee: '',
            selectedFee: '',
            fee: ''
        };
    }

    render() {
        const { navigation } = this.props;
        const { FeeStore } = this.props;
        const {
            recommendedFees,
            loading,
            error,
            getOnchainFeesviaMempool
        } = FeeStore;
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
            <View style={styles.mainContainer}>
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
                    <View style={{ top: '40%', left: '45%' }}>
                        <Spinner />
                    </View>
                )}
                {recommendedFees['fastestFee'] && !loading && (
                    <View style={styles.container}>
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
                                        this.state.selectedFee === 'fastestFee'
                                            ? '#FFD93F'
                                            : '#A7A9AC',
                                    borderWidth:
                                        this.state.selectedFee === 'fastestFee'
                                            ? 2
                                            : 1
                                }}
                            >
                                <Text style={styles.feeTitle}>
                                    {localeString('views.EditFee.fastestFee')}
                                </Text>
                                <Text style={styles.feeText}>
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
                                        this.state.selectedFee === 'halfHourFee'
                                            ? '#FFD93F'
                                            : '#A7A9AC',
                                    borderWidth:
                                        this.state.selectedFee === 'halfHourFee'
                                            ? 2
                                            : 1
                                }}
                            >
                                <Text style={styles.feeTitle}>
                                    {localeString('views.EditFee.halfHourFee')}
                                </Text>
                                <Text style={styles.feeText}>
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
                                        this.state.selectedFee === 'hourFee'
                                            ? '#FFD93F'
                                            : '#A7A9AC',
                                    borderWidth:
                                        this.state.selectedFee === 'hourFee'
                                            ? 2
                                            : 1
                                }}
                            >
                                <Text style={styles.feeTitle}>
                                    {localeString('views.EditFee.hourFee')}
                                </Text>
                                <Text style={styles.feeText}>
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
                                        this.state.selectedFee === 'minimumFee'
                                            ? '#FFD93F'
                                            : '#A7A9AC',
                                    borderWidth:
                                        this.state.selectedFee === 'minimumFee'
                                            ? 2
                                            : 1
                                }}
                            >
                                <Text style={styles.feeTitle}>
                                    {localeString('views.EditFee.minimumFee')}
                                </Text>
                                <Text style={styles.feeText}>
                                    {recommendedFees['minimumFee']}
                                </Text>
                            </View>
                        </TouchableWithoutFeedback>

                        <View>
                            <Text style={styles.custom}>
                                {localeString('views.EditFee.custom')}
                            </Text>
                        </View>
                        <TextInput
                            style={{
                                ...styles.feeBoxes,
                                top: 30,
                                borderColor:
                                    this.state.selectedFee === 'custom'
                                        ? '#FFD93F'
                                        : '#A7A9AC',
                                borderWidth:
                                    this.state.selectedFee === 'custom' ? 2 : 1,
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

                        <TouchableOpacity
                            style={styles.confirmButton}
                            onPress={() => {
                                this.props.navigation.state.params.onNavigateBack(
                                    this.state.fee
                                );
                                this.props.navigation.goBack();
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 18,
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                    top: 8
                                }}
                            >
                                {localeString(
                                    'views.EditFee.confirmFee'
                                ).toUpperCase()}
                            </Text>
                        </TouchableOpacity>
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
    mainContainer: {
        flex: 1,
        backgroundColor: themeColor('background')
    },
    container: {
        flex: 1,
        backgroundColor: themeColor('background'),
        alignItems: 'center',
        justifyContent: 'space-around'
    },
    feeBoxes: {
        height: 65,
        width: 350,
        top: 30,
        borderRadius: 4
    },
    feeTitle: {
        color: '#fff',
        fontSize: 18,
        left: 10,
        top: 20
    },
    feeText: {
        color: themeColor('text'),
        fontSize: 18,
        left: '90%',
        top: -4
    },
    custom: {
        color: '#A7A9AC',
        fontSize: 20,
        top: 55,
        left: '-36%'
    },
    confirmButton: {
        width: 350,
        height: 40,
        backgroundColor: 'yellow',
        bottom: -18,
        borderRadius: 4
    }
});
