import * as React from 'react';
import { FlatList, Text, View, StyleSheet } from 'react-native';
import { Button, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Amount from '../components/Amount';
import Header from '../components/Header';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import ChannelsStore from '../stores/ChannelsStore';
import FiatStore from '../stores/FiatStore';
interface PendingHTLCsProps {
    navigation: StackNavigationProp<any, any>;
    ChannelsStore: ChannelsStore;
    FiatStore: FiatStore;
    route: Route<'PendingHTLCs', { order: any }>;
}

@inject('ChannelsStore', 'FiatStore')
@observer
export default class PendingHTLCs extends React.PureComponent<
    PendingHTLCsProps,
    {}
> {
    renderSeparator = () => (
        <View
            style={{
                height: 0.4,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    getRightTitleTheme = (item: any) => {
        if (item.incoming) return 'success';
        return 'warning';
    };

    render() {
        const { navigation, ChannelsStore, FiatStore } = this.props;
        const { getChannels, pendingHTLCs, loading } = ChannelsStore;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.PendingHTLCs.title'),
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
                ) : !!pendingHTLCs && pendingHTLCs.length > 0 ? (
                    <FlatList
                        data={pendingHTLCs}
                        renderItem={({ item }: { item: any }) => {
                            const displayName = item.incoming
                                ? localeString('views.PendingHTLCs.incoming')
                                : localeString('views.PendingHTLCs.outgoing');
                            const subTitle = `${localeString(
                                'views.PendingHTLCs.expirationHeight'
                            )}: ${FiatStore.numberWithCommas(
                                item.expiration_height
                            )}`;

                            return (
                                <React.Fragment>
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor: 'transparent'
                                        }}
                                        // TODO add individual HTLC view
                                        // onPress={() => {
                                        //     navigation.navigate('PendingHTLC', {
                                        //         pendingHTLC: item
                                        //     });
                                        // }}
                                    >
                                        <ListItem.Content>
                                            <View style={styles.row}>
                                                <ListItem.Title
                                                    style={{
                                                        ...styles.leftCell,
                                                        fontWeight: '600',
                                                        color: themeColor(
                                                            'text'
                                                        ),
                                                        fontFamily:
                                                            'PPNeueMontreal-Book'
                                                    }}
                                                >
                                                    {displayName}
                                                </ListItem.Title>

                                                <View
                                                    style={{
                                                        ...styles.rightCell,
                                                        flexDirection: 'row',
                                                        flexWrap: 'wrap',
                                                        columnGap: 5,
                                                        rowGap: -5,
                                                        justifyContent:
                                                            'flex-end'
                                                    }}
                                                >
                                                    <Amount
                                                        sats={item.amount}
                                                        sensitive
                                                        color={this.getRightTitleTheme(
                                                            item
                                                        )}
                                                    />
                                                    {!!item.getFee &&
                                                        item.getFee != 0 && (
                                                            <>
                                                                <Text
                                                                    style={{
                                                                        color: themeColor(
                                                                            'text'
                                                                        ),
                                                                        fontSize: 16
                                                                    }}
                                                                >
                                                                    +
                                                                </Text>
                                                                <Amount
                                                                    sats={
                                                                        item.getFee
                                                                    }
                                                                    sensitive
                                                                    color={this.getRightTitleTheme(
                                                                        item
                                                                    )}
                                                                    fee
                                                                />
                                                            </>
                                                        )}
                                                </View>
                                            </View>

                                            <View style={styles.row}>
                                                <ListItem.Subtitle
                                                    right
                                                    style={{
                                                        ...styles.leftCell,
                                                        color: themeColor(
                                                            'secondaryText'
                                                        ),
                                                        fontFamily:
                                                            'PPNeueMontreal-Book'
                                                    }}
                                                >
                                                    {subTitle}
                                                </ListItem.Subtitle>

                                                {false && (
                                                    <ListItem.Subtitle
                                                        style={{
                                                            ...styles.rightCell,
                                                            color: themeColor(
                                                                'secondaryText'
                                                            ),
                                                            fontFamily:
                                                                'PPNeueMontreal-Book'
                                                        }}
                                                    >
                                                        {
                                                            item.forwarding_channel
                                                        }
                                                    </ListItem.Subtitle>
                                                )}
                                            </View>
                                        </ListItem.Content>
                                    </ListItem>
                                </React.Fragment>
                            );
                        }}
                        keyExtractor={(item, index) =>
                            `${item.hash_lock}-${index}`
                        }
                        ItemSeparatorComponent={this.renderSeparator}
                        onEndReachedThreshold={50}
                        refreshing={loading}
                        onRefresh={() => getChannels()}
                        initialNumToRender={10}
                        maxToRenderPerBatch={5}
                        windowSize={10}
                    />
                ) : (
                    <Button
                        title={localeString('views.PendingHTLCs.noPendingHTLC')}
                        icon={{
                            name: 'error-outline',
                            size: 25,
                            color: themeColor('text')
                        }}
                        onPress={() => getChannels()}
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

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        columnGap: 10
    },
    leftCell: {
        flexGrow: 0,
        flexShrink: 1
    },
    rightCell: {
        flexGrow: 0,
        flexShrink: 1,
        textAlign: 'right'
    }
});
