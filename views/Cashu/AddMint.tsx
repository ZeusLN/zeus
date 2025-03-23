import * as React from 'react';
import { Animated, FlatList, StyleSheet, Text, View } from 'react-native';
import { ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { CashuMint } from '@cashu/cashu-ts';

import Button from '../../components/Button';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import { Row } from '../../components/layout/Row';
import Screen from '../../components/Screen';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import TextInput from '../../components/TextInput';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

import CashuStore from '../../stores/CashuStore';

import Nostr from '../../assets/images/SVG/Nostrich.svg';

interface AddMintProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    route: Route<'AddMint'>;
}

interface AddMintState {
    mintUrl: string;
    loading: boolean;
    showDiscoverMints: boolean;
    error: boolean;
}

const LoadingNostr = () => {
    let state = new Animated.Value(1);
    Animated.loop(
        Animated.sequence([
            Animated.timing(state, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true
            }),
            Animated.timing(state, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true
            })
        ])
    ).start();

    return (
        <Animated.View
            style={{
                alignSelf: 'center',
                opacity: state,
                marginTop: 30
            }}
        >
            <Nostr fill={themeColor('highlight')} width={40} height={40} />
        </Animated.View>
    );
};

@inject('CashuStore')
@observer
export default class AddMint extends React.Component<
    AddMintProps,
    AddMintState
> {
    listener: any;
    constructor(props: any) {
        super(props);
        this.state = {
            mintUrl: '',
            showDiscoverMints: false,
            loading: false,
            error: false
        };
    }

    getMintInfo = async () => {
        const { mintUrl } = this.state;
        this.setState({
            loading: true
        });
        try {
            const mint = new CashuMint(mintUrl);
            const mintInfo = await mint.getInfo();
            this.props.navigation.navigate('Mint', {
                mint: { ...mintInfo, mintUrl },
                lookup: true
            });
        } catch (e) {
            this.setState({
                error: true
            });
        } finally {
            this.setState({
                loading: false
            });
        }
    };

    renderSeparator = () => (
        <View
            style={{
                height: 0.4,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    render() {
        const { CashuStore, navigation } = this.props;
        const { mintUrl, showDiscoverMints, loading, error } = this.state;

        const mints = CashuStore.mintRecommendations;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Cashu.AddMint.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        loading ? (
                            <Row>
                                <LoadingIndicator size={30} />
                            </Row>
                        ) : undefined
                    }
                    navigation={navigation}
                />
                <View style={{ flex: 1 }}>
                    <View style={styles.content}>
                        {error && (
                            <ErrorMessage
                                message={localeString('general.error')}
                            />
                        )}

                        <>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('cashu.mintUrl')}
                            </Text>
                            <TextInput
                                placeholder={'https://'}
                                value={mintUrl}
                                onChangeText={(text: string) =>
                                    this.setState({
                                        mintUrl: text,
                                        error: false
                                    })
                                }
                                locked={false}
                                autoCapitalize="none"
                            />
                        </>

                        <View
                            style={{
                                ...styles.button,
                                paddingTop: 10
                            }}
                        >
                            <Button
                                title={localeString(
                                    'views.Cashu.AddMint.title'
                                )}
                                onPress={() => {
                                    this.getMintInfo();
                                }}
                                disabled={loading}
                            />
                        </View>

                        {!showDiscoverMints ? (
                            <View
                                style={{
                                    ...styles.button
                                }}
                            >
                                <Button
                                    title={localeString(
                                        'views.Cashu.AddMint.discover'
                                    )}
                                    onPress={() => {
                                        CashuStore.fetchMints();
                                        this.setState({
                                            showDiscoverMints: true
                                        });
                                    }}
                                    disabled={loading}
                                    tertiary
                                />
                            </View>
                        ) : (
                            <>
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('secondaryText'),
                                        marginTop: 15
                                    }}
                                >
                                    {localeString(
                                        'views.Cashu.AddMint.discover'
                                    )}
                                </Text>

                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.Cashu.AddMint.discover.explainer'
                                    )}
                                </Text>

                                {CashuStore.loading && <LoadingNostr />}

                                {!CashuStore.loading && (
                                    <FlatList
                                        style={{
                                            paddingTop: 5,
                                            marginBottom: 30
                                        }}
                                        data={mints}
                                        renderItem={({
                                            item,
                                            index
                                        }: {
                                            item: any;
                                            index: number;
                                        }) => {
                                            return (
                                                <ListItem
                                                    key={`mint-${index}`}
                                                    containerStyle={{
                                                        borderBottomWidth: 0,
                                                        backgroundColor:
                                                            'transparent'
                                                    }}
                                                    onPress={() => {
                                                        this.setState({
                                                            mintUrl: item.url
                                                        });
                                                    }}
                                                >
                                                    <ListItem.Content>
                                                        <View>
                                                            <View
                                                                style={
                                                                    styles.row
                                                                }
                                                            >
                                                                <ListItem.Title
                                                                    style={{
                                                                        ...styles.leftCell,
                                                                        color: themeColor(
                                                                            'text'
                                                                        ),
                                                                        fontSize: 16
                                                                    }}
                                                                >
                                                                    {item.url}
                                                                </ListItem.Title>
                                                            </View>
                                                        </View>
                                                    </ListItem.Content>
                                                    <View>
                                                        <Row>
                                                            <View
                                                                style={{
                                                                    right: 15
                                                                }}
                                                            >
                                                                <Text
                                                                    style={{
                                                                        color: themeColor(
                                                                            'text'
                                                                        )
                                                                    }}
                                                                >
                                                                    {item.count}
                                                                </Text>
                                                            </View>
                                                        </Row>
                                                    </View>
                                                </ListItem>
                                            );
                                        }}
                                        keyExtractor={(_, index) =>
                                            `mint-${index}`
                                        }
                                        ItemSeparatorComponent={
                                            this.renderSeparator
                                        }
                                        onEndReachedThreshold={50}
                                    />
                                )}

                                {!CashuStore.loading && (
                                    <>
                                        {!!mints && mints.length > 0 ? (
                                            <View></View>
                                        ) : (
                                            <Button
                                                title={localeString(
                                                    'views.Mints.noMints'
                                                )}
                                                icon={{
                                                    name: 'error-outline',
                                                    size: 25,
                                                    color: themeColor('text')
                                                }}
                                                buttonStyle={{
                                                    backgroundColor:
                                                        'transparent',
                                                    borderRadius: 30
                                                }}
                                                titleStyle={{
                                                    color: themeColor('text'),
                                                    fontFamily:
                                                        'PPNeueMontreal-Book'
                                                }}
                                            />
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </View>
                    {!CashuStore.loading &&
                        showDiscoverMints &&
                        mints?.length &&
                        mints.length > 0 && (
                            <View
                                style={{
                                    ...styles.button,
                                    ...styles.bottom
                                }}
                            >
                                <Button
                                    title={localeString(
                                        'views.Cashu.AddMint.reviews'
                                    )}
                                    onPress={() => {
                                        UrlUtils.goToUrl(
                                            mintUrl
                                                ? `https://bitcoinmints.com/?tab=reviews&mintUrl=${mintUrl}`
                                                : 'https://bitcoinmints.com/'
                                        );
                                    }}
                                    disabled={loading}
                                    tertiary
                                />
                            </View>
                        )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    content: {
        flex: 1,
        paddingTop: 20,
        paddingBottom: 20,
        paddingLeft: 10,
        paddingRight: 10
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10
    },
    row: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        columnGap: 10
    },
    leftCell: {
        fontFamily: 'PPNeueMontreal-Book',
        flexGrow: 0,
        flexShrink: 1
    },
    bottom: {
        flex: 1,
        flexDirection: 'column',
        position: 'absolute',
        bottom: 0,
        paddingBottom: 10,
        width: '100%'
    }
});
