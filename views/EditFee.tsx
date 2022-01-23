import * as React from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    TouchableOpacity,
    TouchableWithoutFeedback
} from 'react-native';
import { Icon, Header } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Button from '../components/Button';
import LoadingIndicator from '../components/LoadingIndicator';

import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';

import Refresh from '../images/SVG/Refresh.svg';
import ErrorIcon from '../images/SVG/ErrorIcon.svg';

import FeeStore from './../stores/FeeStore';

const MempoolSpace = require('../images/mempool-space-logo.png');

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
                onPress={() => navigation.goBack()}
                color={themeColor('text')}
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
                        style: { color: themeColor('text') }
                    }}
                    backgroundColor={themeColor('background')}
                    leftComponent={<BackButton />}
                    rightComponent={<ReloadButton />}
                />
                <ScrollView style={{ paddingTop: 10, paddingLeft: 20 }}>
                    <Image
                        source={MempoolSpace}
                        style={{
                            alignSelf: 'center',
                            margin: 20,
                            height: 35,
                            width: 140
                        }}
                    />
                    {loading && !error && (
                        <View style={{ flex: 1, justifyContent: 'center' }}>
                            <LoadingIndicator />
                        </View>
                    )}
                    {recommendedFees['fastestFee'] && !loading && (
                        <View
                            style={{
                                backgroundColor: themeColor('background'),
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
                                        ...styles.feeBox,
                                        borderColor:
                                            selectedFee === 'fastestFee'
                                                ? 'rgba(255, 217, 63, .6)'
                                                : '#A7A9AC',
                                        borderWidth: 3,
                                        color: themeColor('text')
                                    }}
                                >
                                    <Text style={styles.feeTitle}>
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
                                        ...styles.feeBox,
                                        borderColor:
                                            selectedFee === 'halfHourFee'
                                                ? 'rgba(255, 217, 63, .6)'
                                                : '#A7A9AC',
                                        borderWidth: 3,
                                        color: themeColor('text')
                                    }}
                                >
                                    <Text style={styles.feeTitle}>
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
                                onPress={() =>
                                    this.setState({
                                        selectedFee: 'hourFee',
                                        fee: recommendedFees[
                                            'hourFee'
                                        ].toString()
                                    })
                                }
                            >
                                <View
                                    style={{
                                        ...styles.feeBox,
                                        borderColor:
                                            selectedFee === 'hourFee'
                                                ? 'rgba(255, 217, 63, .6)'
                                                : '#A7A9AC',
                                        borderWidth: 3,
                                        color: themeColor('text')
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
                                        ...styles.feeBox,
                                        borderColor:
                                            selectedFee === 'minimumFee'
                                                ? 'rgba(255, 217, 63, .6)'
                                                : '#A7A9AC',
                                        borderWidth: 3,
                                        color: themeColor('text')
                                    }}
                                >
                                    <Text style={styles.feeTitle}>
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

                            <Text style={styles.custom}>
                                {localeString('views.EditFee.custom')}
                            </Text>
                            <TouchableWithoutFeedback>
                                <TextInput
                                    style={{
                                        ...styles.feeBox,
                                        paddingLeft: '85%',
                                        borderColor:
                                            selectedFee === 'custom'
                                                ? 'rgba(255, 217, 63, .6)'
                                                : '#A7A9AC',
                                        borderWidth: 3,
                                        color: themeColor('text'),
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
                        </View>
                    )}
                    {error && !loading && (
                      <View style={{
                          flex: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: 500
                      }}>
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
            </View>
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
        color: '#fff',
        fontSize: 18,
        left: 10,
        top: 10
    },
    feeText: {
        top: -15,
        fontSize: 18,
        left: '90%'
    },
    custom: {
        color: '#A7A9AC',
        fontSize: 18,
        top: 48,
        left: 15,
        color: themeColor('text')
    },
    confirmButton: {
        marginTop: 20,
        width: 350
    }
});
