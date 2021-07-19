import * as React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { Avatar, Button, Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import DateTimeUtils from './../utils/DateTimeUtils';
import PrivacyUtils from './../utils/PrivacyUtils';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import UTXOsStore from './../stores/UTXOsStore';
import UnitsStore from './../stores/UnitsStore';
import SettingsStore from './../stores/SettingsStore';

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
        const { getUTXOs } = UTXOsStore;
        getUTXOs();
    }

    renderSeparator = () => <View style={styles.separator} />;

    render() {
        const {
            navigation,
            UTXOsStore,
            UnitsStore,
            SettingsStore
        } = this.props;
        const { getAmount, units } = UnitsStore;
        const { loading, utxos, getUTXOs } = UTXOsStore;
        const { settings } = SettingsStore;
        const { lurkerMode } = settings;

        const CloseButton = () => (
            <Icon
                name="close"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View style={styles.view}>
                <Header
                    leftComponent={<CloseButton />}
                    centerComponent={{
                        text: utxos.length > 0 ? `${localeString('general.coins')} (${utxos.length})` : localeString('general.coins'),
                        style: { color: '#fff' }
                    }}
                    backgroundColor="#1f2328"
                />
                {loading ? (
                    <View style={{ padding: 50 }}>
                        <ActivityIndicator size="large" color="#0000ff" />
                    </View>
                ) : !!utxos && utxos.length > 0 ? (
                    <FlatList
                        data={utxos}
                        renderItem={({ item }) => {
                            let displayName = 'a';
                            let subTitle = 'b';
                            let rightTitle = 'c';

                            return (
                                <React.Fragment>
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor: themeColor(
                                                'background'
                                            )
                                        }}
                                        onPress={(item: any) => {
                                            console.log(JSON.stringify(item));
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
                                                    )
                                                }}
                                            >
                                                {subTitle}
                                            </ListItem.Subtitle>
                                        </ListItem.Content>
                                        <ListItem.Content right>
                                            <ListItem.Title
                                                right
                                                style={{
                                                    fontWeight: '600',
                                                    color: themeColor('text')
                                                }}
                                            >
                                                {rightTitle}
                                            </ListItem.Title>
                                            <ListItem.Subtitle
                                                right
                                                style={
                                                    styles.rightSubtitleStyle
                                                }
                                            >
                                                {'timestamp'}
                                            </ListItem.Subtitle>
                                        </ListItem.Content>
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
                        title={localeString('views.Activity.noActivity')}
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

const styles = StyleSheet.create({
    view: {
        flex: 1,
        backgroundColor: themeColor('background'),
        color: themeColor('text')
    },
    separator: {
        height: 0.4,
        backgroundColor: themeColor('separator')
    },
    button: {
        paddingTop: 15,
        paddingBottom: 10
    },
    rightSubtitleStyle: {
        color: themeColor('secondaryText')
    }
});
