import * as React from 'react';
import {
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    Vibration,
    View
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Icon } from '@rneui/themed';
import { observer } from 'mobx-react';

import Button from './Button';
import LoadingIndicator from './LoadingIndicator';
import ModalBox from './ModalBox';

import CashuStore, { MintReview, MintReviewRating } from '../stores/CashuStore';

import DateTimeUtils from '../utils/DateTimeUtils';
import { font } from '../utils/FontUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

const REVIEW_CONTENT_MAX_LENGTH = 150;

interface MintReviewsModalProps {
    isOpen: boolean;
    mintUrl: string;
    CashuStore: CashuStore;
    onClose: () => void;
}

interface MintReviewsModalState {
    expandedReviews: Set<number>;
    showCopiedToast: boolean;
}

@observer
export default class MintReviewsModal extends React.Component<
    MintReviewsModalProps,
    MintReviewsModalState
> {
    private toastTimeout: ReturnType<typeof setTimeout> | null = null;

    state: MintReviewsModalState = {
        expandedReviews: new Set(),
        showCopiedToast: false
    };

    componentDidUpdate(prevProps: MintReviewsModalProps) {
        if (this.props.isOpen && !prevProps.isOpen) {
            this.setState({ expandedReviews: new Set() });
            this.fetchProfiles();
        }
    }

    componentWillUnmount() {
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
    }

    fetchProfiles = async () => {
        const { CashuStore, mintUrl } = this.props;
        const reviews = CashuStore.mintReviews.get(mintUrl) || [];
        const pubkeys = reviews.map((r) => r.pubkey);
        await CashuStore.fetchReviewerProfiles(pubkeys);
    };

    copyToClipboard = (text: string) => {
        Clipboard.setString(text);
        Vibration.vibrate(50);
        this.setState({ showCopiedToast: true });
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(
            () => this.setState({ showCopiedToast: false }),
            2000
        );
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
                    {isFilled ? '\u2605' : '\u2606'}
                </Text>
            );
        }
        return <View style={styles.starContainer}>{stars}</View>;
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
                        <View style={styles.npubRow}>
                            <Text
                                style={[
                                    styles.reviewerNpub,
                                    { color: themeColor('secondaryText') }
                                ]}
                            >
                                {truncatedNpub}
                            </Text>
                            <TouchableOpacity
                                onPress={() => this.copyToClipboard(npub)}
                                style={styles.copyIconButton}
                            >
                                <Icon
                                    name="content-copy"
                                    size={14}
                                    color={themeColor('secondaryText')}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
                {this.renderReviewContent(item.content, index)}
            </View>
        );
    };

    render() {
        const { isOpen, mintUrl, CashuStore, onClose } = this.props;

        const reviews = CashuStore.mintReviews.get(mintUrl) || [];
        const isLoading = CashuStore.loadingReviews;

        return (
            <ModalBox
                isOpen={isOpen}
                style={{
                    backgroundColor: 'transparent',
                    minHeight: 300,
                    maxHeight: '80%'
                }}
                swipeToClose={false}
                onClosed={onClose}
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
                                {mintUrl}
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
                                onPress={onClose}
                                secondary
                            />
                        </View>
                    </View>
                </View>
            </ModalBox>
        );
    }
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalTitle: {
        fontFamily: font('marlideBold'),
        fontSize: 22,
        textAlign: 'center',
        marginBottom: 10
    },
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
    reviewsMintUrl: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 15
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
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
    npubRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    copyIconButton: {
        padding: 4,
        marginLeft: 4
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
