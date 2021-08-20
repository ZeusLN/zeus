import * as React from 'react';
import {
    StyleSheet,
    RefreshControl,
    Text,
    TextInput,
    View,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Button
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
    customfee: string;
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
            customfee: ''
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
            <View style={styles.maincontainer}>
                <Header
                    centerComponent={{
                        text: 'Edit network fee',
                        style: { color: themeColor('text') }
                    }}
                    backgroundColor={themeColor('background')}
                    leftComponent={<BackButton />}
                    rightComponent={<ReloadButton />}
                />
                {loading && !error && (
                    <View>
                        <Spinner />
                    </View>
                )}
                {recommendedFees['fastestFee'] && !loading && (
                    <View style={styles.feescontainer}>
                        <View style={styles.container}>
                            <View style={styles.feeboxes}>
                                <Text style={styles.feetitle}>Fastest Fee</Text>
                                <Text style={styles.feetext}>
                                    {recommendedFees['fastestFee']}
                                </Text>
                            </View>
                            <View style={styles.feeboxes}>
                                <Text style={styles.feetitle}>
                                    Half Hour Fee
                                </Text>
                                <Text style={styles.feetext}>
                                    {recommendedFees['halfHourFee']}
                                </Text>
                            </View>
                            <View style={styles.feeboxes}>
                                <Text style={styles.feetitle}>Hour Fee</Text>
                                <Text style={styles.feetext}>
                                    {recommendedFees['hourFee']}
                                </Text>
                            </View>
                            <View style={styles.feeboxes}>
                                <Text style={styles.feetitle}>Minimum Fee</Text>
                                <Text style={styles.feetext}>
                                    {recommendedFees['minimumFee']}
                                </Text>
                            </View>
                        </View>
                        <View>
                            <View>
                                <Text style={styles.custom}>Custom</Text>
                            </View>
                            <View style={{ justifyContent: 'space-evenly' }}>
                                <TextInput
                                    style={styles.feeboxes}
                                    keyboardType="numeric"
                                    defaultValue={this.state.customfee}
                                    onChangeText={(text: string) =>
                                        this.setState({ customfee: text })
                                    }
                                ></TextInput>

                                <TouchableOpacity style={styles.Confirmbutton}>
                                    <Text
                                        style={{
                                            fontSize: 18,
                                            textAlign: 'center',
                                            top: 8,
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        CONFIRM FEE
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
                {error && !loading && (
                    <Text style={{ fontSize: 30, color: 'red' }}>
                        {localeString('views.EditFee.error')}
                    </Text>
                )}
            </View>
        );
    }
}
const styles = StyleSheet.create({
    maincontainer: {
        flex: 1,
        backgroundColor: themeColor('background'),
        alignItems: 'center',
        flexDirection: 'column',
        justifyContent: 'space-evenly'
    },
    feescontainer: {},
    container: {
        flex: 1,
        backgroundColor: themeColor('background'),
        alignItems: 'center',
        flexDirection: 'column',
        justifyContent: 'space-evenly'
    },
    maintext: {
        color: themeColor('text'),
        fontSize: 18,
        top: -15
    },
    feeboxes: {
        height: 65,
        width: 350,
        borderWidth: 1,
        borderColor: '#A7A9AC',
        borderRadius: 4,
        top: -45
    },
    feetitle: {
        color: '#fff',
        fontSize: 18,
        left: 10,
        top: 20
    },
    loadingicon: {
        left: '82%',
        top: -17
    },
    feetext: {
        color: themeColor('text'),
        fontSize: 18,
        left: '90%',
        top: -4
    },
    custom: {
        color: '#A7A9AC',
        fontSize: 20,
        top: -55
    },
    Confirmbutton: {
        alignItems: 'stretch',
        height: 40,
        backgroundColor: 'yellow',
        top: 0
    }
});
