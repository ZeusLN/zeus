import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Button, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Amount from './../../components/Amount';
import Header from '../../components/Header';
import LoadingIndicator from './../../components/LoadingIndicator';
import Screen from './../../components/Screen';

import { localeString } from './../../utils/LocaleUtils';
import BackendUtils from './../../utils/BackendUtils';
import { themeColor } from './../../utils/ThemeUtils';

import UTXOsStore from './../../stores/UTXOsStore';

interface CoinControlProps {
    navigation: any;
    UTXOsStore: UTXOsStore;
}

@inject('UTXOsStore')
@observer
export default class CoinControl extends React.Component<CoinControlProps, {}> {
    async UNSAFE_componentWillMount() {
        const { UTXOsStore } = this.props;
        const { getUTXOs, listAccounts } = UTXOsStore;
        getUTXOs();
        if (BackendUtils.supportsAccounts()) {
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
        const { navigation, UTXOsStore } = this.props;
        const { loading, utxos, getUTXOs } = UTXOsStore;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text:
                            utxos.length > 0
                                ? `${localeString('general.coins')} (${
                                      utxos.length
                                  })`
                                : localeString('general.coins'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                {loading ? (
                    <View style={{ padding: 50 }}>
                        <LoadingIndicator />
                    </View>
                ) : !!utxos && utxos.length > 0 ? (
                    <FlatList
                        data={utxos}
                        renderItem={({ item }) => {
                            const subTitle = item.address;

                            return (
                                <React.Fragment>
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor: 'transparent'
                                        }}
                                        onPress={() => {
                                            navigation.navigate('Utxo', {
                                                utxo: item
                                            });
                                        }}
                                    >
                                        <ListItem.Content>
                                            <Amount
                                                sats={item.getAmount}
                                                sensitive
                                            />
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
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    />
                )}
            </Screen>
        );
    }
}
