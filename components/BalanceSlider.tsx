import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { ChannelItem } from '../components/Channels/ChannelItem';

interface BalanceSliderProps {
    localBalance: string | number;
    remoteBalance: string | number;
    localReserveBalance?: string | number;
    remoteReserveBalance?: string | number;
    list?: boolean;
}

export default class BalanceSlider extends React.Component<
    BalanceSliderProps,
    {}
> {
    render() {
        const {
            localBalance,
            remoteBalance,
            localReserveBalance,
            remoteReserveBalance
        } = this.props;
        return (
            <View style={styles.slider}>
                <ChannelItem
                    inbound={remoteBalance}
                    outbound={localBalance}
                    inboundReserve={localReserveBalance}
                    outboundReserve={remoteReserveBalance}
                    noBorder
                    hideLabels
                />
            </View>
        );
    }
}

const styles = StyleSheet.create({
    slider: {
        flex: 1,
        marginLeft: 20,
        marginRight: 20
    }
});
