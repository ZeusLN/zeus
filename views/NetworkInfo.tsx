import * as React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { inject, observer } from 'mobx-react';

import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import NodeInfoStore from '../stores/NodeInfoStore';

interface NetworkInfoProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
}

@inject('NodeInfoStore')
@observer
export default class NetworkInfo extends React.Component<NetworkInfoProps, {}> {
    UNSAFE_componentWillMount() {
        const { NodeInfoStore } = this.props;
        NodeInfoStore.getNetworkInfo();
    }

    render() {
        const { navigation, NodeInfoStore } = this.props;
        const { getNetworkInfo, networkInfo, loading } = NodeInfoStore;

        const NETWORK_INFO = [
            {
                label: 'views.NetworkInfo.numChannels',
                value: networkInfo.num_channels || 0
            },
            {
                label: 'views.NetworkInfo.numNodes',
                value: networkInfo.num_nodes || 0
            },
            {
                label: 'views.NetworkInfo.numZombieChannels',
                value: networkInfo.num_zombie_chans || 0
            },
            {
                label: 'views.NetworkInfo.graphDiameter',
                value: networkInfo.graph_diameter || 0
            },
            {
                label: 'views.NetworkInfo.averageOutDegree',
                value: networkInfo.avg_out_degree || 0
            },
            {
                label: 'views.NetworkInfo.maxOutDegree',
                value: networkInfo.max_out_degree || 0
            }
        ];

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.NetworkInfo.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    navigation={navigation}
                />

                <FlatList
                    data={NETWORK_INFO}
                    renderItem={({ item }) => {
                        return (
                            <KeyValue
                                keyValue={localeString(item.label)}
                                value={item.value}
                            />
                        );
                    }}
                    onRefresh={() => getNetworkInfo}
                    refreshing={loading}
                    style={styles.content}
                />
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    error: {
        paddingBottom: 5,
        color: 'red',
        fontFamily: 'Lato-Regular'
    }
});
