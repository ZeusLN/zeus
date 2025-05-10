import * as React from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import { Button, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Amount from '../../components/Amount';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import CashuStore from '../../stores/CashuStore';

interface UnspentTokensProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    route: Route<'UnspentTokens'>;
}

interface UnspentTokensState {
    unspentTokens: any;
}

@inject('CashuStore')
@observer
export default class UnspentTokens extends React.PureComponent<
    UnspentTokensProps,
    UnspentTokensState
> {
    state = {
        unspentTokens: []
    };

    componentDidMount() {
        this.props.navigation.addListener('focus', this.loadTokens);
        this.loadTokens(); // Initial load
    }

    componentWillUnmount() {
        this.props.navigation.removeListener &&
            this.props.navigation.removeListener('focus', this.loadTokens);
    }

    loadTokens = () => {
        const { sentTokens } = this.props.CashuStore;

        const unspentTokens = sentTokens
            ? sentTokens.filter((token: any) => !token.spent)
            : [];

        this.setState({
            unspentTokens
        });
    };

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
        const { navigation, CashuStore } = this.props;
        const { unspentTokens } = this.state;
        const { loading } = CashuStore;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Cashu.UnspentTokens.title'),
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
                ) : !!unspentTokens && unspentTokens.length > 0 ? (
                    <FlatList
                        data={unspentTokens}
                        renderItem={({ item }: { item: any }) => {
                            const displayName = localeString('general.unspent');
                            const subTitle = localeString('cashu.token');

                            return (
                                <React.Fragment>
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor: 'transparent'
                                        }}
                                        onPress={() => {
                                            navigation.navigate('CashuToken', {
                                                decoded: item
                                            });
                                        }}
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
                                                        sats={item.getAmount}
                                                        sensitive
                                                        color={this.getRightTitleTheme(
                                                            item
                                                        )}
                                                    />
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
                                                    {item.getDisplayTimeShort}
                                                </ListItem.Subtitle>
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
                        onRefresh={() => this.loadTokens()}
                        initialNumToRender={10}
                        maxToRenderPerBatch={5}
                        windowSize={10}
                    />
                ) : (
                    <Button
                        title={localeString(
                            'views.Cashu.UnspentTokens.noUnspentTokens'
                        )}
                        icon={{
                            name: 'error-outline',
                            size: 25,
                            color: themeColor('text')
                        }}
                        onPress={() => this.loadTokens()}
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
