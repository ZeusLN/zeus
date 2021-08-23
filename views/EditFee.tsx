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
    feeBoxColor: any;
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
            feeBoxColor: '#A7A9AC'
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
                        <View style={styles.feeBoxes}>
                            <Text style={styles.feeTitle}>
                                {localeString('views.EditFee.fastestFee')}
                            </Text>
                            <Text style={styles.feeText}>
                                {recommendedFees['fastestFee']}
                            </Text>
                        </View>
                        <View style={styles.feeBoxes}>
                            <Text style={styles.feeTitle}>
                                {localeString('views.EditFee.halfHourFee')}
                            </Text>
                            <Text style={styles.feeText}>
                                {recommendedFees['halfHourFee']}
                            </Text>
                        </View>
                        <View style={styles.feeBoxes}>
                            <Text style={styles.feeTitle}>
                                {localeString('views.EditFee.hourFee')}
                            </Text>
                            <Text style={styles.feeText}>
                                {recommendedFees['hourFee']}
                            </Text>
                        </View>
                        <View style={styles.feeBoxes}>
                            <Text style={styles.feeTitle}>
                                {localeString('views.EditFee.minimumFee')}
                            </Text>
                            <Text style={styles.feeText}>
                                {recommendedFees['hourFee']}
                            </Text>
                        </View>
                        <View>
                            <Text style={styles.custom}>
                                {localeString('views.EditFee.custom')}
                            </Text>
                        </View>
                        <TextInput
                            style={{ ...styles.feeBoxes, top: 30 }}
                            keyboardType="numeric"
                            defaultValue={this.state.customFee}
                            onChangeText={(text: string) =>
                                this.setState({ customFee: text })
                            }
                        ></TextInput>
                        <TouchableOpacity style={styles.confirmButton}>
                            <Text
                                style={{
                                    fontSize: 18,
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                    top: 8
                                }}
                            >
                                {localeString('views.EditFee.confirmFee')}
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
        borderWidth: 1,
        borderRadius: 4,
        borderColor: '#A7A9AC'
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
