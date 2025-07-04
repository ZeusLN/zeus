import React from 'react';
import { inject, observer } from 'mobx-react';
import { Text, View } from 'react-native';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import SweepStore from '../../stores/SweepStore';

interface SweepProps {
    SweepStore: SweepStore;
    navigation: StackNavigationProp<any, any>;
    route: Route<'Sweep', { p: string }>;
}

@inject('SweepStore')
@observer
export default class WIFTransactionDetails extends React.Component<SweepProps> {
    render() {
        const { SweepStore } = this.props;
        return (
            <View>
                <Text
                    style={{ fontSize: 20, fontWeight: 'bold', color: 'white' }}
                >
                    Transaction Details
                    <Text>fee: {SweepStore.fee.toString()}</Text>
                    <Text>feeRate: {SweepStore.feeRate.toString()}</Text>
                    <Text>txHex: {SweepStore.txHex?.toString()}</Text>
                </Text>
            </View>
        );
    }
}
