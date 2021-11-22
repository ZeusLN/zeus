import * as React from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { Avatar, Button, Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import DateTimeUtils from './../../utils/DateTimeUtils';
import PrivacyUtils from './../../utils/PrivacyUtils';
import RESTUtils from './../../utils/RESTUtils';
import Pill from './../../components/Pill';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import UTXOsStore from './../../stores/UTXOsStore';
import UnitsStore from './../../stores/UnitsStore';
import SettingsStore from './../../stores/SettingsStore';

interface CoinControlProps {
    navigation: any;
    UTXOsStore: UTXOsStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

@inject('UTXOsStore', 'UnitsStore', 'SettingsStore')
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
        const { navigation, UTXOsStore, UnitsStore, SettingsStore } =
            this.props;
        const { getAmount, units } = UnitsStore;
        const { loading, utxos, getUTXOs } = UTXOsStore;
        const { settings } = SettingsStore;
        const { privacy } = settings;
        const { lurkerMode } = privacy;

        const AddPill = () => (
            <Pill title={localeString('general.add').toUpperCase()} />
        );
        const FrozenPill = () => (
            <Pill
                title={localeString('general.frozen')}
                textColor="white"
                borderColor="darkred"
                backgroundColor="darkred"
            />
        );

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
                        <ActivityIndicator
                            size="large"
                            color={themeColor('highlight')}
                        />
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
