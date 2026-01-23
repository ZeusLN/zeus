import * as React from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { ListItem } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { CashuMint } from '@cashu/cashu-ts';

import Button from '../../components/Button';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import ModalBox from '../../components/ModalBox';
import { Row } from '../../components/layout/Row';
import Screen from '../../components/Screen';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import TextInput from '../../components/TextInput';

import { font } from '../../utils/FontUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

import CashuStore from '../../stores/CashuStore';

type DiscoverMode = 'zeus' | 'all' | 'custom';

interface AddMintProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    route: Route<'AddMint'>;
}

interface AddMintState {
    mintUrl: string;
    loading: boolean;
    showDiscoverMints: boolean;
    showDiscoverModal: boolean;
    discoverMode: DiscoverMode;
    customNpub: string;
    npubError: string;
    error: boolean;
    error_msg: string;
}

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
            showDiscoverModal: false,
            discoverMode: 'zeus',
            customNpub: '',
            npubError: '',
            loading: false,
            error: false,
            error_msg: ''
        };
    }

    getMintInfo = async () => {
        const { mintUrl } = this.state;
        if (!mintUrl.trim()) {
            return;
        }
        const { CashuStore } = this.props;
        const existingMints = CashuStore.mintUrls || [];

        const mintAlreadyAdded = existingMints.some(
            (url) =>
                url.trim().replace(/\/$/, '') ===
                mintUrl.trim().replace(/\/$/, '')
        );
        if (mintAlreadyAdded) {
            this.setState({
                error: true,
                error_msg: localeString(
                    'views.Cashu.AddMint.errorMintAlreadyAdded'
                )
            });
            return;
        }
        this.setState({
            loading: true,
            error: false,
            error_msg: ''
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

    validateAndSetNpub = (text: string) => {
        const { CashuStore } = this.props;
        this.setState({ customNpub: text });

        if (text.trim() === '') {
            this.setState({ npubError: '' });
            return;
        }

        const isValid = CashuStore.validateNpub(text);
        if (!isValid) {
            this.setState({
                npubError: localeString('views.Cashu.AddMint.invalidNpub')
            });
        } else {
            this.setState({ npubError: '' });
        }
    };

    handleDiscoverSelect = (mode: DiscoverMode) => {
        this.setState({ discoverMode: mode });
    };

    handleFetchMints = () => {
        const { CashuStore } = this.props;
        const { discoverMode, customNpub } = this.state;

        // For custom mode, validate npub first
        if (discoverMode === 'custom') {
            if (this.state.npubError || !customNpub.trim()) {
                return;
            }
        }

        this.setState({
            showDiscoverModal: false,
            showDiscoverMints: true
        });

        if (discoverMode === 'all') {
            CashuStore.fetchMints();
        } else if (discoverMode === 'zeus') {
            CashuStore.fetchMintsFromFollows();
        } else if (discoverMode === 'custom') {
            CashuStore.fetchMintsFromFollows(customNpub);
        }
    };

    isFetchDisabled = () => {
        const { discoverMode, customNpub, npubError } = this.state;
        if (discoverMode === 'custom') {
            return !customNpub.trim() || !!npubError;
        }
        return false;
    };

    renderSeparator = () => (
        <View
            style={{
                height: 0.4,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    renderDiscoverModal = () => {
        const { showDiscoverModal, discoverMode, customNpub, npubError } =
            this.state;

        return (
            <ModalBox
                isOpen={showDiscoverModal}
                style={{
                    backgroundColor: 'transparent',
                    minHeight: 200
                }}
                onClosed={() => this.setState({ showDiscoverModal: false })}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>
                            {localeString('views.Cashu.AddMint.discover')}
                        </Text>

                        <Text style={styles.modalSubtitle}>
                            {localeString(
                                'views.Cashu.AddMint.discoverModal.subtitle'
                            )}
                        </Text>

                        {/* Option 1: ZEUS Follows */}
                        <TouchableOpacity
                            style={[
                                styles.optionItem,
                                discoverMode === 'zeus' &&
                                    styles.optionItemSelected
                            ]}
                            onPress={() => this.handleDiscoverSelect('zeus')}
                        >
                            <View style={styles.radioOuter}>
                                {discoverMode === 'zeus' && (
                                    <View style={styles.radioInner} />
                                )}
                            </View>
                            <View style={styles.optionTextContainer}>
                                <Text style={styles.optionTitle}>
                                    {localeString(
                                        'views.Cashu.AddMint.zeusFollows'
                                    )}
                                </Text>
                                <Text style={styles.optionDescription}>
                                    {localeString(
                                        'views.Cashu.AddMint.zeusFollows.description'
                                    )}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Option 2: All Nostr Users */}
                        <TouchableOpacity
                            style={[
                                styles.optionItem,
                                discoverMode === 'all' &&
                                    styles.optionItemSelected
                            ]}
                            onPress={() => this.handleDiscoverSelect('all')}
                        >
                            <View style={styles.radioOuter}>
                                {discoverMode === 'all' && (
                                    <View style={styles.radioInner} />
                                )}
                            </View>
                            <View style={styles.optionTextContainer}>
                                <Text style={styles.optionTitle}>
                                    {localeString(
                                        'views.Cashu.AddMint.allNostrUsers'
                                    )}
                                </Text>
                                <Text style={styles.optionDescription}>
                                    {localeString(
                                        'views.Cashu.AddMint.allNostrUsers.description'
                                    )}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Option 3: Your Nostr Follows */}
                        <TouchableOpacity
                            style={[
                                styles.optionItem,
                                discoverMode === 'custom' &&
                                    styles.optionItemSelected
                            ]}
                            onPress={() => this.handleDiscoverSelect('custom')}
                        >
                            <View style={styles.radioOuter}>
                                {discoverMode === 'custom' && (
                                    <View style={styles.radioInner} />
                                )}
                            </View>
                            <View style={styles.optionTextContainer}>
                                <Text style={styles.optionTitle}>
                                    {localeString(
                                        'views.Cashu.AddMint.yourFollows'
                                    )}
                                </Text>
                                <Text style={styles.optionDescription}>
                                    {localeString(
                                        'views.Cashu.AddMint.yourFollows.description'
                                    )}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Custom npub input */}
                        {discoverMode === 'custom' && (
                            <View style={styles.npubInputContainer}>
                                <Text style={styles.npubLabel}>
                                    {localeString(
                                        'views.Cashu.AddMint.enterNpub'
                                    )}
                                </Text>
                                <TextInput
                                    placeholder="npub1..."
                                    value={customNpub}
                                    onChangeText={this.validateAndSetNpub}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                {npubError ? (
                                    <Text style={styles.npubError}>
                                        {npubError}
                                    </Text>
                                ) : null}
                            </View>
                        )}

                        <View style={styles.modalButtons}>
                            <Button
                                title={localeString(
                                    'views.Cashu.AddMint.fetchRecommendations'
                                )}
                                onPress={this.handleFetchMints}
                                disabled={this.isFetchDisabled()}
                            />
                            <View style={styles.cancelButton}>
                                <Button
                                    title={localeString('general.cancel')}
                                    onPress={() =>
                                        this.setState({
                                            showDiscoverModal: false
                                        })
                                    }
                                    secondary
                                />
                            </View>
                        </View>
                    </View>
                </View>
            </ModalBox>
        );
    };

    getExplainerText = () => {
        const { discoverMode } = this.state;
        switch (discoverMode) {
            case 'zeus':
                return localeString(
                    'views.Cashu.AddMint.discover.explainerZeus'
                );
            case 'custom':
                return localeString(
                    'views.Cashu.AddMint.discover.explainerCustom'
                );
            case 'all':
            default:
                return localeString('views.Cashu.AddMint.discover.explainer');
        }
    };

    render() {
        const { CashuStore, navigation } = this.props;
        const {
            mintUrl,
            showDiscoverMints,
            discoverMode,
            loading,
            error,
            error_msg
        } = this.state;

        const mints =
            discoverMode === 'all'
                ? CashuStore.mintRecommendations
                : CashuStore.trustedMintRecommendations;
        const isLoading =
            discoverMode === 'all'
                ? CashuStore.loading
                : CashuStore.loadingTrustedMints;

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
                        {(error || (showDiscoverMints && CashuStore.error)) && (
                            <ErrorMessage
                                message={
                                    CashuStore.error_msg ||
                                    error_msg ||
                                    localeString('general.error')
                                }
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
                                disabled={loading || mintUrl.length === 0}
                            />
                        </View>

                        {!showDiscoverMints || CashuStore.error ? (
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
                                        this.setState({
                                            showDiscoverModal: true
                                        });
                                    }}
                                    disabled={loading}
                                    tertiary
                                />
                            </View>
                        ) : (
                            <>
                                <View style={styles.discoverHeader}>
                                    <Text
                                        style={{
                                            ...styles.text,
                                            color: themeColor('secondaryText'),
                                            flex: 1
                                        }}
                                    >
                                        {localeString(
                                            'views.Cashu.AddMint.discover'
                                        )}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() =>
                                            this.setState({
                                                showDiscoverModal: true
                                            })
                                        }
                                    >
                                        <Text
                                            style={{
                                                color: themeColor('highlight'),
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
                                            }}
                                        >
                                            {localeString('general.change')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('text')
                                    }}
                                >
                                    {this.getExplainerText()}
                                </Text>

                                {isLoading && (
                                    <View style={{ marginTop: 20 }}>
                                        <LoadingIndicator />
                                    </View>
                                )}

                                {!isLoading && (
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
                            </>
                        )}
                    </View>
                    {!isLoading &&
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
                {this.renderDiscoverModal()}
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
    },
    discoverHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 15,
        marginBottom: 5
    },
    // Modal styles
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalContent: {
        backgroundColor: themeColor('modalBackground') || '#1a1a1a',
        borderRadius: 20,
        padding: 20,
        width: '95%',
        maxWidth: 400
    },
    modalTitle: {
        fontFamily: font('marlideBold'),
        fontSize: 22,
        color: themeColor('text'),
        textAlign: 'center',
        marginBottom: 10
    },
    modalSubtitle: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14,
        color: themeColor('secondaryText'),
        textAlign: 'center',
        marginBottom: 20
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        backgroundColor: themeColor('secondary') || '#2a2a2a'
    },
    optionItemSelected: {
        borderWidth: 2,
        borderColor: themeColor('highlight') || '#FFD93D'
    },
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: themeColor('highlight') || '#FFD93D',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        marginTop: 2
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: themeColor('highlight') || '#FFD93D'
    },
    optionTextContainer: {
        flex: 1
    },
    optionTitle: {
        fontFamily: 'PPNeueMontreal-Medium',
        fontSize: 16,
        color: themeColor('text'),
        marginBottom: 4
    },
    optionDescription: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 13,
        color: themeColor('secondaryText')
    },
    npubInputContainer: {
        marginTop: 10,
        paddingLeft: 34
    },
    npubLabel: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14,
        color: themeColor('secondaryText'),
        marginBottom: 8
    },
    npubError: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 12,
        color: themeColor('error') || '#ff4444',
        marginTop: 5
    },
    modalButtons: {
        marginTop: 20
    },
    cancelButton: {
        marginTop: 10
    }
});
