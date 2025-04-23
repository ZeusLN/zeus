import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Button, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import AccountFilter from './../../components/AccountFilter';
import Amount from './../../components/Amount';
import Header from '../../components/Header';
import LoadingIndicator from './../../components/LoadingIndicator';
import Screen from './../../components/Screen';

import { localeString } from './../../utils/LocaleUtils';
import BackendUtils from './../../utils/BackendUtils';
import { themeColor } from './../../utils/ThemeUtils';

import UTXOsStore from './../../stores/UTXOsStore';
import storage from '../../storage';

interface CoinControlProps {
    navigation: StackNavigationProp<any, any>;
    UTXOsStore: UTXOsStore;
    route: Route<'CoinControl', { account: string }>;
}

interface CoinControlState {
    account: string;
    utxoLabels: Record<string, string>;
}

@inject('UTXOsStore')
@observer
export default class CoinControl extends React.Component<
    CoinControlProps,
    CoinControlState
> {
    constructor(props: CoinControlProps) {
        super(props);

        const accountParam = props.route.params.account;
        const account =
            accountParam && accountParam === 'On-chain'
                ? 'default'
                : accountParam;

        this.state = {
            account: account || 'default',
            utxoLabels: {}
        };
    }

    async componentDidMount() {
        const { UTXOsStore, navigation } = this.props;
        const { account } = this.state;
        const { getUTXOs, listAccounts } = UTXOsStore;

        getUTXOs({ account });
        if (BackendUtils.supportsAccounts()) {
            listAccounts();
        }

        navigation.addListener('focus', async () => {
            const { utxos } = UTXOsStore;
            const utxoLabels: Record<string, string> = {};

            for (const utxo of utxos) {
                const key = `${utxo.txid}:${utxo.output}`;
                const label = await storage.getItem(key);
                if (label) {
                    utxoLabels[key] = label;
                }
            }

            this.setState({ utxoLabels });
        });
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
        const { account } = this.state;
        const { loading, utxos, getUTXOs, accounts } = UTXOsStore;

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

                {BackendUtils.supportsAccounts() && accounts?.length > 0 && (
                    <AccountFilter
                        default={account}
                        items={accounts}
                        refresh={(account: string) => {
                            getUTXOs({ account });
                            this.setState({ account });
                        }}
                        showAll
                    />
                )}

                {loading ? (
                    <View style={{ padding: 50 }}>
                        <LoadingIndicator />
                    </View>
                ) : !!utxos && utxos.length > 0 ? (
                    <FlatList
                        data={utxos}
                        renderItem={({ item }) => {
                            const key = `${item.txid}:${item.output}`;
                            const message = this.state.utxoLabels[key];
                            const subTitle = item.address;

                            return (
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
                                        {message && (
                                            <ListItem.Subtitle
                                                right
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    fontSize: 10
                                                }}
                                            >
                                                {`${localeString(
                                                    'general.label'
                                                )}: ${message}`}
                                            </ListItem.Subtitle>
                                        )}
                                    </ListItem.Content>
                                </ListItem>
                            );
                        }}
                        keyExtractor={(_, index) => `utxo-${index}`}
                        ItemSeparatorComponent={this.renderSeparator}
                        onEndReachedThreshold={50}
                        refreshing={loading}
                        onRefresh={() => {
                            getUTXOs({ account });
                        }}
                    />
                ) : (
                    <Button
                        title={localeString('views.UTXOs.CoinControl.noUTXOs')}
                        icon={{
                            name: 'error-outline',
                            size: 25,
                            color: themeColor('text')
                        }}
                        onPress={async () => {
                            getUTXOs({ account });
                        }}
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
