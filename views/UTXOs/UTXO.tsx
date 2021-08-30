import * as React from 'react';
import {
    StyleSheet,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Header, Icon } from 'react-native-elements';
import UrlUtils from './../../utils/UrlUtils';
import Utxo from './../../models/Utxo';
import { inject, observer } from 'mobx-react';
import PrivacyUtils from './../../utils/PrivacyUtils';

import NodeInfoStore from './../../stores/NodeInfoStore';
import UnitsStore from './../../stores/UnitsStore';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

interface UTXOProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
    UnitsStore: UnitsStore;
}

@inject('NodeInfoStore', 'UnitsStore')
@observer
export default class UTXO extends React.Component<UTXOProps> {
    render() {
        const { NodeInfoStore, UnitsStore, navigation } = this.props;
        const { changeUnits, getAmount, units } = UnitsStore;
        const utxo: Utxo = navigation.getParam('utxo', null);
        const { testnet } = NodeInfoStore;

        const { getOutpoint, account, address, getConfs, isUnconfirmed } = utxo;
        const amount = utxo.getAmount;
        const tx = utxo.outpoint.txid_str;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('CoinControl')}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        const amountDisplay = PrivacyUtils.sensitiveValue(
            getAmount(amount),
            8,
            true
        );

        return (
            <ScrollView style={styles.scrollView}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('general.utxo'),
                        style: { color: themeColor('text') }
                    }}
                    backgroundColor="#1f2328"
                />
                <View style={styles.center}>
                    <TouchableOpacity onPress={() => changeUnits()}>
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontSize: 30,
                                fontWeight: 'bold'
                            }}
                        >
                            {units && amountDisplay}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    <View>
                        <Text style={styles.label}>
                            {localeString('general.outpoint')}:
                        </Text>
                        <Text style={styles.value}>{getOutpoint}</Text>
                    </View>

                    {!!address && (
                        <View>
                            <Text style={styles.label}>
                                {localeString('general.address')}:
                            </Text>
                            <TouchableOpacity
                                onPress={() =>
                                    UrlUtils.goToBlockExplorerAddress(
                                        address,
                                        testnet
                                    )
                                }
                            >
                                <Text style={styles.valueWithLink}>
                                    {PrivacyUtils.sensitiveValue(address)}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <Text style={styles.label}>
                        {localeString('views.Transaction.transactionHash')}:
                    </Text>
                    <TouchableOpacity
                        onPress={() =>
                            UrlUtils.goToBlockExplorerTXID(tx, testnet)
                        }
                    >
                        <Text style={styles.valueWithLink}>
                            {PrivacyUtils.sensitiveValue(tx)}
                        </Text>
                    </TouchableOpacity>

                    <View>
                        <Text style={styles.label}>
                            {localeString('views.Transaction.numConf')}:
                        </Text>
                        <Text
                            style={{
                                ...styles.value,
                                color: isUnconfirmed ? 'red' : 'green'
                            }}
                        >
                            {PrivacyUtils.sensitiveValue(getConfs, 3, true)}
                        </Text>
                    </View>
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
        backgroundColor: themeColor('background'),
        color: themeColor('text')
    },
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    },
    label: {
        paddingTop: 5,
        color: themeColor('text')
    },
    value: {
        paddingBottom: 5,
        color: themeColor('text')
    },
    valueWithLink: {
        paddingBottom: 5,
        color: 'rgba(92, 99,216, 1)'
    }
});
