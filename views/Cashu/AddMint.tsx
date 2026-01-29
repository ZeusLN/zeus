import * as React from 'react';
import {
    Clipboard,
    FlatList,
    Image,
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

import DateTimeUtils from '../../utils/DateTimeUtils';
import { font } from '../../utils/FontUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import CashuStore, {
    MintReview,
    MintReviewRating
} from '../../stores/CashuStore';

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
    showReviewsModal: boolean;
    reviewsMintUrl: string;
    discoverMode: DiscoverMode;
    customNpub: string;
    npubError: string;
    error: boolean;
    error_msg: string;
    expandedReviews: Set<number>;
}

const REVIEW_CONTENT_MAX_LENGTH = 150;

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
            showReviewsModal: false,
            reviewsMintUrl: '',
            discoverMode: 'zeus',
            customNpub: '',
            npubError: '',
            loading: false,
            error: false,
            error_msg: '',
            expandedReviews: new Set()
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

        const highlightColor = themeColor('highlight');

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
                    <View
                        style={[
                            styles.modalContent,
                            { backgroundColor: themeColor('secondary') }
                        ]}
                    >
                        <Text
                            style={[
                                styles.modalTitle,
                                { color: themeColor('text') }
                            ]}
                        >
                            {localeString('views.Cashu.AddMint.discover')}
                        </Text>

                        <Text
                            style={[
                                styles.modalSubtitle,
                                { color: themeColor('secondaryText') }
                            ]}
                        >
                            {localeString(
                                'views.Cashu.AddMint.discoverModal.subtitle'
                            )}
                        </Text>

                        {/* Option 1: ZEUS Follows */}
                        <TouchableOpacity
                            style={[
                                styles.optionItem,
                                { backgroundColor: themeColor('background') },
                                discoverMode === 'zeus' && [
                                    styles.optionItemSelected,
                                    { borderColor: highlightColor }
                                ]
                            ]}
                            onPress={() => this.handleDiscoverSelect('zeus')}
                        >
                            <View
                                style={[
                                    styles.radioOuter,
                                    { borderColor: highlightColor }
                                ]}
                            >
                                {discoverMode === 'zeus' && (
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
                                    style={[
                                        styles.optionTitle,
                                        { color: themeColor('text') }
                                    ]}
                                >
                                    {localeString(
                                        'views.Cashu.AddMint.zeusFollows'
                                    )}
                                </Text>
                                <Text
                                    style={[
                                        styles.optionDescription,
                                        { color: themeColor('secondaryText') }
                                    ]}
                                >
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
                                { backgroundColor: themeColor('background') },
                                discoverMode === 'all' && [
                                    styles.optionItemSelected,
                                    { borderColor: highlightColor }
                                ]
                            ]}
                            onPress={() => this.handleDiscoverSelect('all')}
                        >
                            <View
                                style={[
                                    styles.radioOuter,
                                    { borderColor: highlightColor }
                                ]}
                            >
                                {discoverMode === 'all' && (
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
                                    style={[
                                        styles.optionTitle,
                                        { color: themeColor('text') }
                                    ]}
                                >
                                    {localeString(
                                        'views.Cashu.AddMint.allNostrUsers'
                                    )}
                                </Text>
                                <Text
                                    style={[
                                        styles.optionDescription,
                                        { color: themeColor('secondaryText') }
                                    ]}
                                >
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
                                { backgroundColor: themeColor('background') },
                                discoverMode === 'custom' && [
                                    styles.optionItemSelected,
                                    { borderColor: highlightColor }
                                ]
                            ]}
                            onPress={() => this.handleDiscoverSelect('custom')}
                        >
                            <View
                                style={[
                                    styles.radioOuter,
                                    { borderColor: highlightColor }
                                ]}
                            >
                                {discoverMode === 'custom' && (
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
                                    style={[
                                        styles.optionTitle,
                                        { color: themeColor('text') }
                                    ]}
                                >
                                    {localeString(
                                        'views.Cashu.AddMint.yourFollows'
                                    )}
                                </Text>
                                <Text
                                    style={[
                                        styles.optionDescription,
                                        { color: themeColor('secondaryText') }
                                    ]}
                                >
                                    {localeString(
                                        'views.Cashu.AddMint.yourFollows.description'
                                    )}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Custom npub input */}
                        {discoverMode === 'custom' && (
                            <View style={styles.npubInputContainer}>
                                <Text
                                    style={[
                                        styles.npubLabel,
                                        { color: themeColor('secondaryText') }
                                    ]}
                                >
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
                                    <Text
                                        style={[
                                            styles.npubError,
                                            { color: themeColor('error') }
                                        ]}
                                    >
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

    openReviewsModal = async (mintUrl: string) => {
        const { CashuStore } = this.props;

        this.setState({
            showReviewsModal: true,
            reviewsMintUrl: mintUrl
        });

        // Get reviews for this mint and fetch profiles
        const reviews = CashuStore.mintReviews.get(mintUrl) || [];
        const pubkeys = reviews.map((r) => r.pubkey);
        await CashuStore.fetchReviewerProfiles(pubkeys);
    };

    copyToClipboard = (text: string) => {
        Clipboard.setString(text);
    };

    toggleReviewExpanded = (index: number) => {
        this.setState((prevState) => {
            const newExpanded = new Set(prevState.expandedReviews);
            if (newExpanded.has(index)) {
                newExpanded.delete(index);
            } else {
                newExpanded.add(index);
            }
            return { expandedReviews: newExpanded };
        });
    };

    renderStarRating = (rating: MintReviewRating) => {
        const stars = [];
        for (let i = 1; i <= rating.max; i++) {
            const isFilled = i <= rating.score;
            stars.push(
                <Text
                    key={i}
                    style={{
                        color: isFilled
                            ? themeColor('text')
                            : themeColor('secondaryText'),
                        fontSize: 14,
                        marginRight: 2
                    }}
                >
                    {isFilled ? '★' : '☆'}
                </Text>
            );
        }
        return <View style={styles.starContainer}>{stars}</View>;
    };

    renderReviewItem = ({
        item,
        index
    }: {
        item: MintReview;
        index: number;
    }) => {
        const { CashuStore } = this.props;
        const profile = CashuStore.reviewerProfiles.get(item.pubkey);

        const displayName = profile?.name || localeString('general.anonymous');
        const npub = profile?.npub || item.pubkey;
        const truncatedNpub = `${npub.slice(0, 12)}...${npub.slice(-8)}`;
        const formattedDate = item.createdAt
            ? DateTimeUtils.listFormattedDateShort(item.createdAt)
            : '';

        return (
            <View style={styles.reviewItem} key={`review-${index}`}>
                <View style={styles.reviewHeader}>
                    {profile?.picture ? (
                        <Image
                            source={{ uri: profile.picture }}
                            style={styles.profileImage}
                        />
                    ) : (
                        <View
                            style={[
                                styles.profilePlaceholder,
                                { backgroundColor: themeColor('secondary') }
                            ]}
                        >
                            <Text
                                style={[
                                    styles.profilePlaceholderText,
                                    { color: themeColor('text') }
                                ]}
                            >
                                {displayName.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}
                    <View style={styles.reviewHeaderText}>
                        <View style={styles.reviewNameRow}>
                            <Text
                                style={[
                                    styles.reviewerName,
                                    { color: themeColor('text') }
                                ]}
                            >
                                {displayName}
                            </Text>
                            {formattedDate ? (
                                <Text
                                    style={[
                                        styles.reviewDate,
                                        { color: themeColor('secondaryText') }
                                    ]}
                                >
                                    {formattedDate}
                                </Text>
                            ) : null}
                        </View>
                        {item.rating && this.renderStarRating(item.rating)}
                        <TouchableOpacity
                            onPress={() => this.copyToClipboard(npub)}
                        >
                            <Text
                                style={[
                                    styles.reviewerNpub,
                                    { color: themeColor('secondaryText') }
                                ]}
                            >
                                {truncatedNpub}{' '}
                                <Text
                                    style={[
                                        styles.copyHint,
                                        { color: themeColor('highlight') }
                                    ]}
                                >
                                    {localeString('general.tapToCopy')}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
                {this.renderReviewContent(item.content, index)}
            </View>
        );
    };

    renderReviewContent = (content: string, index: number) => {
        const { expandedReviews } = this.state;
        const isExpanded = expandedReviews.has(index);
        const isLongContent =
            content && content.length > REVIEW_CONTENT_MAX_LENGTH;

        if (!content) {
            return (
                <Text
                    style={[
                        styles.reviewContent,
                        {
                            color: themeColor('secondaryText'),
                            fontStyle: 'italic'
                        }
                    ]}
                >
                    {localeString('views.Cashu.AddMint.noReviewContent')}
                </Text>
            );
        }

        const displayContent =
            isLongContent && !isExpanded
                ? `${content.slice(0, REVIEW_CONTENT_MAX_LENGTH)}...`
                : content;

        if (isLongContent) {
            return (
                <TouchableOpacity
                    onPress={() => this.toggleReviewExpanded(index)}
                    activeOpacity={0.7}
                >
                    <Text
                        style={[
                            styles.reviewContent,
                            { color: themeColor('text') }
                        ]}
                    >
                        {displayContent}
                    </Text>
                    <Text
                        style={[
                            styles.expandHint,
                            { color: themeColor('highlight') }
                        ]}
                    >
                        {localeString(
                            isExpanded
                                ? 'views.Cashu.AddMint.tapToCollapse'
                                : 'views.Cashu.AddMint.tapToExpand'
                        )}
                    </Text>
                </TouchableOpacity>
            );
        }

        return (
            <Text style={[styles.reviewContent, { color: themeColor('text') }]}>
                {content}
            </Text>
        );
    };

    renderReviewsModal = () => {
        const { CashuStore } = this.props;
        const { showReviewsModal, reviewsMintUrl } = this.state;

        const reviews = CashuStore.mintReviews.get(reviewsMintUrl) || [];
        const isLoading = CashuStore.loadingReviews;

        return (
            <ModalBox
                isOpen={showReviewsModal}
                style={{
                    backgroundColor: 'transparent',
                    minHeight: 300,
                    maxHeight: '80%'
                }}
                swipeToClose={false}
                onClosed={() =>
                    this.setState({
                        showReviewsModal: false,
                        reviewsMintUrl: ''
                    })
                }
            >
                <View style={styles.modalContainer}>
                    <View
                        style={[
                            styles.reviewsModalContent,
                            { backgroundColor: themeColor('secondary') }
                        ]}
                    >
                        <View style={styles.reviewsModalHeader}>
                            <Text
                                style={[
                                    styles.modalTitle,
                                    { color: themeColor('text') }
                                ]}
                            >
                                {localeString('views.Cashu.AddMint.reviews')}
                            </Text>
                            <Text
                                style={[
                                    styles.reviewsMintUrl,
                                    { color: themeColor('secondaryText') }
                                ]}
                                numberOfLines={1}
                            >
                                {reviewsMintUrl}
                            </Text>
                        </View>

                        <View style={styles.reviewsModalBody}>
                            {isLoading ? (
                                <View style={styles.loadingContainer}>
                                    <LoadingIndicator />
                                </View>
                            ) : reviews.length === 0 ? (
                                <Text
                                    style={[
                                        styles.noReviews,
                                        { color: themeColor('secondaryText') }
                                    ]}
                                >
                                    {localeString(
                                        'views.Cashu.AddMint.noReviews'
                                    )}
                                </Text>
                            ) : (
                                <FlatList
                                    data={reviews}
                                    renderItem={this.renderReviewItem}
                                    keyExtractor={(_, index) =>
                                        `review-${index}`
                                    }
                                    style={styles.reviewsList}
                                    showsVerticalScrollIndicator={false}
                                    ItemSeparatorComponent={() => (
                                        <View
                                            style={[
                                                styles.reviewSeparator,
                                                {
                                                    backgroundColor:
                                                        themeColor('separator')
                                                }
                                            ]}
                                        />
                                    )}
                                />
                            )}
                        </View>

                        <View style={styles.reviewsModalFooter}>
                            <Button
                                title={localeString('general.close')}
                                onPress={() =>
                                    this.setState({
                                        showReviewsModal: false,
                                        reviewsMintUrl: ''
                                    })
                                }
                                secondary
                            />
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
                                        'views.Cashu.AddMint.viewReviews'
                                    )}
                                    onPress={() => {
                                        if (mintUrl) {
                                            this.openReviewsModal(mintUrl);
                                        }
                                    }}
                                    disabled={loading || !mintUrl}
                                    tertiary
                                />
                            </View>
                        )}
                </View>
                {this.renderDiscoverModal()}
                {this.renderReviewsModal()}
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
        borderRadius: 20,
        padding: 20,
        width: '95%',
        maxWidth: 400
    },
    modalTitle: {
        fontFamily: font('marlideBold'),
        fontSize: 22,
        textAlign: 'center',
        marginBottom: 10
    },
    modalSubtitle: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20
    },
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
        paddingLeft: 34
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
    modalButtons: {
        marginTop: 20
    },
    cancelButton: {
        marginTop: 10
    },
    // Reviews modal styles
    reviewsModalContent: {
        borderRadius: 20,
        padding: 20,
        width: '95%',
        maxWidth: 400,
        maxHeight: '80%',
        flex: 1
    },
    reviewsModalHeader: {
        marginBottom: 10
    },
    reviewsModalBody: {
        flex: 1,
        minHeight: 100
    },
    reviewsModalFooter: {
        marginTop: 'auto',
        paddingTop: 15
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    reviewsMintUrl: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 15
    },
    reviewsList: {
        flexGrow: 1,
        flexShrink: 1
    },
    reviewItem: {
        paddingVertical: 12
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8
    },
    profileImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12
    },
    profilePlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    profilePlaceholderText: {
        fontFamily: 'PPNeueMontreal-Medium',
        fontSize: 18
    },
    reviewHeaderText: {
        flex: 1
    },
    reviewNameRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2
    },
    starContainer: {
        flexDirection: 'row',
        marginBottom: 2
    },
    reviewerName: {
        fontFamily: 'PPNeueMontreal-Medium',
        fontSize: 14,
        flex: 1
    },
    reviewDate: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 11,
        marginLeft: 8
    },
    reviewerNpub: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 11
    },
    copyHint: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 10
    },
    reviewContent: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14,
        fontStyle: 'normal'
    },
    expandHint: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 12,
        marginTop: 4
    },
    reviewSeparator: {
        height: 1
    },
    noReviews: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 20
    }
});
