import * as React from 'react';
import {
    Text as RNText,
    View,
    ScrollView,
    StyleSheet,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Route } from '@react-navigation/native';

import Button from '../../components/Button';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';

import CashuStore, { ScoredMint } from '../../stores/CashuStore';
import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import MintAvatar from '../../components/MintAvatar';

type DiscoverMode = 'zeus' | 'all' | 'custom' | 'later';

interface MintDiscoveryProps {
    navigation: NativeStackNavigationProp<any, any>;
    CashuStore: CashuStore;
    SettingsStore: SettingsStore;
    route: Route<
        'MintDiscovery',
        { enableCashu: boolean; returnTo?: string; implementation?: string }
    >;
}

interface MintDiscoveryState {
    discoverMode: DiscoverMode;
    customNpub: string;
    npubError: string;
    hasFetched: boolean;
}

@inject('CashuStore', 'SettingsStore')
@observer
export default class MintDiscovery extends React.Component<
    MintDiscoveryProps,
    MintDiscoveryState
> {
    state: MintDiscoveryState = {
        discoverMode: 'zeus',
        customNpub: '',
        npubError: '',
        hasFetched: false
    };

    componentDidMount() {
        // Auto-fetch with default mode (ZEUS' contacts)
        this.handleFetchMints();
    }

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
        this.setState({ discoverMode: mode }, () => {
            if (mode !== 'custom' && mode !== 'later') {
                this.handleFetchMints();
            }
        });
    };

    handleFetchMints = () => {
        const { CashuStore } = this.props;
        const { discoverMode, customNpub, npubError } = this.state;

        if (discoverMode === 'custom') {
            if (npubError || !customNpub.trim()) {
                return;
            }
        }

        this.setState({ hasFetched: true });

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

    handleNext = () => {
        const { navigation, route, CashuStore } = this.props;
        const { discoverMode } = this.state;
        const returnTo = route.params?.returnTo;
        const enableCashu = route.params?.enableCashu;
        const implementation = route.params?.implementation;

        let initialMintUrls: string[] = [];
        if (discoverMode !== 'later') {
            const topMints = CashuStore.getTopScoredMints(
                5,
                discoverMode === 'all' ? 'all' : 'zeus'
            );
            initialMintUrls = topMints.map((m: ScoredMint) => m.url);
        }

        if (returnTo) {
            navigation.navigate(returnTo, {
                discoverMode,
                initialMintUrls
            });
        } else {
            navigation.navigate('WalletSettings', {
                enableCashu,
                initialMintUrls,
                implementation
            });
        }
    };

    renderRadioOption = (
        mode: DiscoverMode,
        titleKey: string,
        descriptionKey: string
    ) => {
        const { discoverMode } = this.state;
        const highlightColor = themeColor('highlight');
        const isSelected = discoverMode === mode;

        return (
            <TouchableOpacity
                style={[
                    styles.optionItem,
                    { backgroundColor: themeColor('background') },
                    isSelected && [
                        styles.optionItemSelected,
                        { borderColor: highlightColor }
                    ]
                ]}
                onPress={() => this.handleDiscoverSelect(mode)}
            >
                <View
                    style={[styles.radioOuter, { borderColor: highlightColor }]}
                >
                    {isSelected && (
                        <View
                            style={[
                                styles.radioInner,
                                { backgroundColor: highlightColor }
                            ]}
                        />
                    )}
                </View>
                <View style={styles.optionTextContainer}>
                    <Text
                        style={{
                            ...styles.optionTitle,
                            color: themeColor('text')
                        }}
                    >
                        {localeString(titleKey)}
                    </Text>
                    <Text
                        style={{
                            ...styles.optionDescription,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {localeString(descriptionKey)}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    render() {
        const { navigation, CashuStore } = this.props;
        const { discoverMode, customNpub, npubError, hasFetched } = this.state;

        const isLater = discoverMode === 'later';

        const isLoading = isLater
            ? false
            : discoverMode === 'all'
            ? CashuStore.loading
            : CashuStore.loadingTrustedMints;

        const topMints =
            hasFetched && !isLater
                ? CashuStore.getTopScoredMints(
                      5,
                      discoverMode === 'all' ? 'all' : 'zeus'
                  )
                : [];

        // Fetch mint info for icons when top mints are available
        if (topMints.length > 0 && !isLoading) {
            const urls = topMints.map((m: ScoredMint) => m.url);
            const hasUncached = urls.some(
                (u: string) => !CashuStore.mintInfoCache.has(u)
            );
            if (hasUncached) {
                CashuStore.fetchMintInfoBatch(urls);
            }
        }

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.MintDiscovery.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={{ flex: 1, paddingHorizontal: 15, marginTop: 5 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text
                        style={{
                            color: themeColor('secondaryText'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: 14,
                            textAlign: 'center',
                            marginBottom: 20,
                            marginTop: 10
                        }}
                    >
                        {localeString('views.MintDiscovery.subtitle')}
                    </Text>

                    {this.renderRadioOption(
                        'zeus',
                        'views.Cashu.AddMint.zeusFollows',
                        'views.Cashu.AddMint.zeusFollows.description'
                    )}
                    {this.renderRadioOption(
                        'all',
                        'views.Cashu.AddMint.allNostrUsers',
                        'views.Cashu.AddMint.allNostrUsers.description'
                    )}
                    {this.renderRadioOption(
                        'custom',
                        'views.Cashu.AddMint.yourFollows',
                        'views.Cashu.AddMint.yourFollows.description'
                    )}
                    {this.renderRadioOption(
                        'later',
                        'views.MintDiscovery.chooseLater',
                        'views.MintDiscovery.chooseLater.description'
                    )}

                    {discoverMode === 'custom' && (
                        <View style={styles.npubInputContainer}>
                            <Text
                                style={{
                                    ...styles.npubLabel,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('views.Cashu.AddMint.enterNpub')}
                            </Text>
                            <TextInput
                                placeholder="npub1..."
                                value={customNpub}
                                onChangeText={this.validateAndSetNpub}
                                autoCapitalize="none"
                                autoCorrect={false}
                                error={!!npubError}
                                textColor={
                                    npubError
                                        ? themeColor('warning')
                                        : undefined
                                }
                            />
                            {npubError ? (
                                <Text
                                    style={{
                                        ...styles.npubError,
                                        color: themeColor('warning')
                                    }}
                                >
                                    {npubError}
                                </Text>
                            ) : null}
                            <View style={{ marginTop: 10 }}>
                                <Button
                                    title={localeString(
                                        'views.MintDiscovery.fetchMints'
                                    )}
                                    onPress={this.handleFetchMints}
                                    disabled={this.isFetchDisabled()}
                                />
                            </View>
                        </View>
                    )}

                    {/* Top mints section */}
                    {hasFetched && discoverMode !== 'later' && (
                        <View style={styles.mintsSection}>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Medium',
                                    fontSize: 16,
                                    marginBottom: 10
                                }}
                            >
                                {localeString('views.MintDiscovery.topMints')}
                            </Text>

                            {isLoading ? (
                                <View style={{ padding: 20 }}>
                                    <LoadingIndicator />
                                </View>
                            ) : topMints.length > 0 ? (
                                topMints.map((mint: ScoredMint) => {
                                    const mintInfo =
                                        CashuStore.mintInfoCache.get(mint.url);
                                    const iconUrl = mintInfo?.icon_url;
                                    const mintName = mintInfo?.name;

                                    return (
                                        <View
                                            key={mint.url}
                                            style={[
                                                styles.mintItem,
                                                {
                                                    backgroundColor:
                                                        themeColor('secondary'),
                                                    flexDirection: 'row',
                                                    alignItems: 'center'
                                                }
                                            ]}
                                        >
                                            <MintAvatar
                                                iconUrl={iconUrl}
                                                name={mintName || mint.url}
                                            />
                                            <View
                                                style={{
                                                    flex: 1,
                                                    marginLeft: 12
                                                }}
                                            >
                                                {mintName && (
                                                    <RNText
                                                        style={{
                                                            color: themeColor(
                                                                'text'
                                                            ),
                                                            fontFamily:
                                                                'PPNeueMontreal-Medium',
                                                            fontSize: 14,
                                                            marginBottom: 2
                                                        }}
                                                        numberOfLines={1}
                                                    >
                                                        {mintName}
                                                    </RNText>
                                                )}
                                                <RNText
                                                    style={{
                                                        color: themeColor(
                                                            'secondaryText'
                                                        ),
                                                        fontFamily:
                                                            'PPNeueMontreal-Book',
                                                        fontSize: 12
                                                    }}
                                                    numberOfLines={1}
                                                >
                                                    {mint.url.replace(
                                                        'https://',
                                                        ''
                                                    )}
                                                </RNText>
                                            </View>
                                        </View>
                                    );
                                })
                            ) : (
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book',
                                        fontSize: 14,
                                        textAlign: 'center',
                                        padding: 20
                                    }}
                                >
                                    {CashuStore.error
                                        ? CashuStore.error_msg
                                        : localeString(
                                              'views.RecommendedSettings.loadingMints'
                                          )}
                                </Text>
                            )}
                        </View>
                    )}
                </ScrollView>

                <View
                    style={{
                        padding: 20,
                        paddingBottom: 40
                    }}
                >
                    <Button
                        title={localeString('views.MintDiscovery.next')}
                        onPress={this.handleNext}
                        disabled={isLoading && discoverMode !== 'later'}
                    />
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    optionItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10
    },
    optionItemSelected: {
        borderWidth: 2
    },
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        marginTop: 2
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6
    },
    optionTextContainer: {
        flex: 1
    },
    optionTitle: {
        fontFamily: 'PPNeueMontreal-Medium',
        fontSize: 16,
        marginBottom: 4
    },
    optionDescription: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 13
    },
    npubInputContainer: {
        marginTop: 10,
        paddingHorizontal: 5
    },
    npubLabel: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14,
        marginBottom: 8
    },
    npubError: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 12,
        marginTop: 5
    },
    mintsSection: {
        marginTop: 25,
        borderTopWidth: 1,
        borderTopColor: '#333',
        paddingTop: 15
    },
    mintItem: {
        padding: 12,
        borderRadius: 8,
        marginBottom: 8
    }
});
