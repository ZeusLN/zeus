import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Button, Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import LoadingIndicator from './../../components/LoadingIndicator';

import { localeString } from './../../utils/LocaleUtils';
import RESTUtils from './../../utils/RESTUtils';
import { themeColor } from './../../utils/ThemeUtils';

import UTXOsStore from './../../stores/UTXOsStore';
import UnitsStore from './../../stores/UnitsStore';

interface CoinControlProps {
    navigation: any;
    UTXOsStore: UTXOsStore;
    UnitsStore: UnitsStore;
}

@inject('UTXOsStore', 'UnitsStore')
@observer
export default class CoinControl extends React.Component<CoinControlProps, {}> {
    async UNSAFE_componentWillMount() {
        const { UTXOsStore } = this.props;
        const { getUTXOs, listAccounts } = UTXOsStore;
        getUTXOs();
        if (RESTUtils.supportsAccounts()) {
            listAccounts();
        }
    }

    renderSeparator = () => (
        <View
            style={{
                height: 0.4,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    render() {
        const { navigation, UTXOsStore, UnitsStore } = this.props;
        const { getAmount } = UnitsStore;
        const { loading, utxos, getUTXOs } = UTXOsStore;

        const CloseButton = () => (
            <Icon
                name="close"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background'),
                    color: themeColor('text')
                }}
            >
                <Header
                    leftComponent={<CloseButton />}
                    centerComponent={{
                        text:
                            utxos.length > 0
                                ? `${localeString('general.coins')} (${
                                      utxos.length
                                  })`
                                : localeString('general.coins'),
                        style: { color: '#fff' }
                    }}
                    backgroundColor="#1f2328"
                />
                {loading ? (
                    <View style={{ padding: 50 }}>
                        <LoadingIndicator />
                    </View>
                ) : !!utxos && utxos.length > 0 ? (
                    <FlatList
                        data={utxos}
                        renderItem={({ item }) => {
                            const displayName = getAmount(item.getAmount);
                            const subTitle = item.address;

                            return (
                                <React.Fragment>
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor:
                                                themeColor('background')
                                        }}
                                        onPress={() => {
                                            navigation.navigate('Utxo', {
                                                utxo: item
                                            });
                                        }}
                                    >
                                        <ListItem.Content>
                                            <ListItem.Title
                                                right
                                                style={{
                                                    fontWeight: '600',
                                                    color: themeColor('text')
                                                }}
                                            >
                                                {displayName}
                                            </ListItem.Title>
                                            <ListItem.Subtitle
                                                right
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    fontSize: 10
                                                }}
                                            >
                                                {subTitle}
                                            </ListItem.Subtitle>
                                        </ListItem.Content>
                                        {/*
                                        <ListItem.Content right>
                                            <FrozenPill />
                                        </ListItem.Content>
                                        */}
                                    </ListItem>
                                </React.Fragment>
                            );
                        }}
                        keyExtractor={(item, index) => `${item.model}-${index}`}
                        ItemSeparatorComponent={this.renderSeparator}
                        onEndReachedThreshold={50}
                        refreshing={loading}
                        onRefresh={() => getUTXOs()}
                    />
                ) : (
                    <Button
                        title={localeString('views.UTXOs.CoinControl.noUTXOs')}
                        icon={{
                            name: 'error-outline',
                            size: 25,
                            color: themeColor('text')
                        }}
                        onPress={() => getUTXOs()}
                        buttonStyle={{
                            backgroundColor: 'transparent',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: themeColor('text')
                        }}
                    />
                )}
            </View>
        );
    }
}
