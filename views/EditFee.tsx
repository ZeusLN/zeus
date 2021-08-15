import * as React from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    View,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Button
} from 'react-native';
import { themeColor } from '../utils/ThemeUtils';
import FeeStore from './../stores/FeeStore';
import { inject, observer } from 'mobx-react';

interface NodeInfoProps {
    FeeStore: FeeStore;
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
        const { FeeStore } = this.props;
        const { recommendedFees } = FeeStore;
        return (
            <SafeAreaView style={styles.maincontainer}>
                <View style={styles.container}>
                    <Text style={styles.maintext}>Edit network fee</Text>
                    <View
                        style={styles.feeboxes}
                    >
                        <Text style={styles.feetext}>
                            Fastest Fee
                            {
                                '                                                   '
                            }
                            {recommendedFees['fastestFee']}
                        </Text>
                    </View>
                    <View
                        style={styles.feeboxes}
                    >
                        <Text style={styles.feetext}>
                            Half Hour Fee
                            {'                                               '}
                            {recommendedFees['halfHourFee']}
                        </Text>
                    </View>
                    <View
                        style={styles.feeboxes}
                    >
                        <Text style={styles.feetext}>
                            Hour Fee
                            {
                                '                                                        '
                            }
                            {recommendedFees['hourFee']}
                        </Text>
                    </View>
                    <View
                        style={styles.feeboxes}
                    >
                        <Text style={styles.feetext}>
                            Minimum Fee
                            {'                                               '}
                            {recommendedFees['minimumFee']}
                        </Text>
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
                            color: 'white',
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
        fontSize: 18,
    },
    feeboxes:{
        height: 75,
        width: 350,
        borderWidth: 1,
        borderColor: '#A7A9AC',
        borderRadius: 4
    },
    feetext: {
        color: themeColor('text'),
        fontSize: 18,
        top: 10,
        left: 10
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
