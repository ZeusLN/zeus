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
        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Send')}
                color="#fff"
                underlayColor="transparent"
            />
        );
        const { recommendedFees, loading } = FeeStore;
        return (
            <SafeAreaView style={styles.maincontainer}>
                <View style={styles.container}>
                    <View style={{flex:0.05,flexWrap:'wrap'}}>
                        <BackButton />
                        <Text style={styles.maintext}>Edit network fee</Text>
                    </View>

                    <View style={styles.feeboxes}>
                        <Text style={styles.feetitle}>Fastest Fee</Text>
                        {loading ? (
                            <View style={styles.loadingicon}>
                                <Spinner />
                            </View>
                        ) : (
                            <Text style={styles.feetext}>
                                {recommendedFees['fastestFee']}
                            </Text>
                        )}
                    </View>
                    <View style={styles.feeboxes}>
                        <Text style={styles.feetitle}>Half Hour Fee</Text>
                        {loading ? (
                            <View style={styles.loadingicon}>
                                <Spinner />
                            </View>
                        ) : (
                            <Text style={styles.feetext}>
                                {recommendedFees['halfHourFee']}
                            </Text>
                        )}
                    </View>
                    <View style={styles.feeboxes}>
                        <Text style={styles.feetitle}> Hour Fee</Text>
                        {loading ? (
                            <View style={styles.loadingicon}>
                                <Spinner />
                            </View>
                        ) : (
                            <Text style={styles.feetext}>
                                {recommendedFees['hourFee']}
                            </Text>
                        )}
                    </View>
                    <View style={styles.feeboxes}>
                        <Text style={styles.feetitle}> Minimum Fee</Text>
                        {loading ? (
                            <View style={styles.loadingicon}>
                                <Spinner />
                            </View>
                        ) : (
                            <Text style={styles.feetext}>
                                {recommendedFees['minimumFee']}
                            </Text>
                        )}
                    </View>
                </View>
                <View>
                    <View>
                        <Text style={styles.custom}>Custom</Text>
                    </View>
                    <TextInput
                        style={{
                            height: 75,
                            width: 350,
                            borderWidth: 1,
                            borderColor: '#A7A9AC',
                            borderRadius: 4,
                            color: themeColor('text'),
                            fontSize: 20
                        }}
                        keyboardType="numeric"
                        defaultValue={this.state.customfee}
                        onChangeText={(text: string) =>
                            this.setState({ customfee: text })
                        }
                    ></TextInput>
                    <View style={styles.button}>
                        <Button title="CONFIRM FEE" color="yellow" />
                    </View>
                </View>
            </SafeAreaView>
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
    container: {
        flex: 1,
        backgroundColor: themeColor('background'),
        alignItems: 'center',
        flexDirection: 'column',
        justifyContent: 'space-evenly'
    },
    maintext: {
        color: themeColor('text'),
        fontSize: 18
    },
    feeboxes: {
        height: 75,
        width: 350,
        borderWidth: 1,
        borderColor: '#A7A9AC',
        borderRadius: 4
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
        top: -10
    },
    button: {
        alignItems: 'stretch',
        height: 60,
        paddingTop: 24
    }
});
