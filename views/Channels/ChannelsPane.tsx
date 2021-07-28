import * as React from 'react';
import { FlatList, View } from 'react-native';

import { ChannelsHeader } from '../../components/Channels/ChannelsHeader';
import { WalletHeader } from '../../components/WalletHeader';
import { ChannelItem } from '../../components/Channels/ChannelItem';
import { localeString } from '../../utils/LocaleUtils';
import { Spacer } from '../../components/layout/Spacer';

// TODO: does this belong in the model? Or can it be computed from the model?
export enum Status {
    Good = 'Good',
    Stable = 'Stable',
    Unstable = 'Unstable',
    Offline = 'Offline'
}

interface ChannelsProps {
    navigation: any;
}

export default class ChannelsPane extends React.PureComponent<
    ChannelsProps,
    {}
> {
    largest = 20000 + 20000;
    dummyChannelsData = [
        {
            title: 'looptest',
            status: Status.Good,
            inbound: 20000,
            outbound: 20000
        },
        {
            title: 'evan.k',
            status: Status.Stable,
            inbound: 14000,
            outbound: 12000
        },
        {
            title: 'bosch',
            status: Status.Unstable,
            inbound: 6000,
            outbound: 18000
        },
        {
            title: 'bosch but offline',
            status: Status.Offline,
            inbound: 6000,
            outbound: 18000
        },
        {
            title: 'futurepaul',
            status: Status.Offline,
            inbound: 420,
            outbound: 6000
        }
    ];

    headerString = `${localeString('views.Wallet.Wallet.channels')} (${
        this.dummyChannelsData.length
    })`;

    renderItem = ({ item }) => {
        return (
            <ChannelItem
                title={item.title}
                status={item.status}
                inbound={item.inbound}
                outbound={item.outbound}
                largestTotal={this.largest}
            />
        );
    };

    render() {
        return (
            <View style={{ flex: 1 }}>
                <WalletHeader
                    navigation={this.props.navigation}
                    title={this.headerString}
                />
                <ChannelsHeader />
                <FlatList
                    data={this.dummyChannelsData}
                    renderItem={this.renderItem}
                    keyExtractor={item => item.title}
                    ListFooterComponent={<Spacer height={100} />}
                />
            </View>
        );
    }
}
