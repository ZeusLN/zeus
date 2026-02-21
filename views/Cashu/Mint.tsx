import * as React from 'react';
import { observer, inject } from 'mobx-react';
import {
    Linking,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    View
} from 'react-native';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearProgress } from '@rneui/themed';

import Amount from '../../components/Amount';
import Button from '../../components/Button';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import LoadingIndicator from '../../components/LoadingIndicator';
import ModalBox from '../../components/ModalBox';
import Pill from '../../components/Pill';
import { Row } from '../../components/layout/Row';
import Screen from '../../components/Screen';
import {
    ErrorMessage,
    SuccessMessage
} from '../../components/SuccessErrorMessage';
import Switch from '../../components/Switch';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';

import { font } from '../../utils/FontUtils';
import { localeString } from '../../utils/LocaleUtils';
import NostrUtils from '../../utils/NostrUtils';
import PrivacyUtils from '../../utils/PrivacyUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

import CashuStore from '../../stores/CashuStore';

import MintAvatar from '../../components/MintAvatar';

interface MintProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<'Mint', { mint: any; lookup?: boolean }>;
    CashuStore: CashuStore;
}

type ReviewStep = 'rating' | 'signing' | 'success';

interface MintState {
    checkForExistingBalances: boolean;
    showReviewModal: boolean;
    reviewStep: ReviewStep;
    reviewRating: number;
    reviewText: string;
    signingMethod: 'anonymous' | 'nsec';
    nsecInput: string;
    nsecError: string;
    submitError: string;
    submittedNpub: string;
}

const supportedContacts = ['email', 'nostr', 'twitter', 'x'];

@inject('CashuStore')
@observer
export default class Mint extends React.Component<MintProps, MintState> {
    state: MintState = {
        checkForExistingBalances: false,
        showReviewModal: false,
        reviewStep: 'rating',
        reviewRating: 0,
        reviewText: '',
        signingMethod: 'anonymous',
        nsecInput: '',
        nsecError: '',
        submitError: '',
        submittedNpub: ''
    };

    openReviewModal = () => {
        this.props.CashuStore.resetReviewSubmitState();
        this.setState({
            showReviewModal: true,
            reviewStep: 'rating',
            reviewRating: 0,
            reviewText: '',
            signingMethod: 'anonymous',
            nsecInput: '',
            nsecError: '',
            submitError: '',
            submittedNpub: ''
        });
    };

    closeReviewModal = () => {
        this.setState({ showReviewModal: false });
        this.props.CashuStore.resetReviewSubmitState();
    };

    setRating = (rating: number) => {
        this.setState({ reviewRating: rating });
    };

    proceedToSigning = () => {
        this.setState({ reviewStep: 'signing' });
    };

    validateAndSetNsec = (text: string) => {
        this.setState({ nsecInput: text });

        if (text.trim() === '') {
            this.setState({ nsecError: '' });
            return;
        }

        const isValid = NostrUtils.isValidNsec(text);
        if (!isValid) {
            this.setState({
                nsecError: localeString('views.Cashu.Mint.invalidNsec')
            });
        } else {
            this.setState({ nsecError: '' });
        }
    };

    submitReview = async () => {
        const { CashuStore, route } = this.props;
        const { reviewRating, reviewText, signingMethod, nsecInput } =
            this.state;
        const mint = route.params?.mint;

        const nsec = signingMethod === 'nsec' ? nsecInput : undefined;

        const result = await CashuStore.submitMintReview(
            mint?.mintUrl,
            reviewRating > 0 ? reviewRating : undefined,
            reviewText || undefined,
            nsec
        );

        if (result.success) {
            this.setState({
                reviewStep: 'success',
                submittedNpub: result.npub || ''
            });
        } else {
            this.setState({
                submitError:
                    result.error || localeString('views.Cashu.Mint.submitError')
            });
        }
    };

    renderStarSelector = () => {
        const { reviewRating } = this.state;
        const stars = [];

        for (let i = 1; i <= 5; i++) {
            const isFilled = i <= reviewRating;
            stars.push(
                <TouchableOpacity
                    key={i}
                    onPress={() => this.setRating(i)}
                    style={styles.starButton}
                >
                    <Text
                        style={{
                            color: isFilled
                                ? themeColor('text')
                                : themeColor('secondaryText'),
                            fontSize: 32
                        }}
                    >
                        {isFilled ? '★' : '☆'}
                    </Text>
                </TouchableOpacity>
            );
        }

        return <View style={styles.starContainer}>{stars}</View>;
    };

    renderReviewModal = () => {
        const { CashuStore } = this.props;
        const {
            showReviewModal,
            reviewStep,
            reviewText,
            signingMethod,
            nsecInput,
            nsecError,
            submitError,
            submittedNpub
        } = this.state;
        const { submittingReview } = CashuStore;

        const isNsecValid =
            signingMethod === 'anonymous' ||
            (nsecInput.trim() !== '' && !nsecError);

        return (
            <ModalBox
                isOpen={showReviewModal}
                style={{
                    backgroundColor: 'transparent',
                    minHeight: 300
                }}
                onClosed={this.closeReviewModal}
            >
                <View style={styles.modalContainer}>
                    <View
                        style={[
                            styles.modalContent,
                            { backgroundColor: themeColor('secondary') }
                        ]}
                    >
                        {reviewStep === 'rating' && (
                            <>
                                <Text
                                    style={{
                                        ...styles.modalTitle,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.Cashu.Mint.submitReview'
                                    )}
                                </Text>

                                <Text
                                    style={{
                                        ...styles.modalSubtitle,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Cashu.Mint.ratingLabel'
                                    )}
                                </Text>

                                {this.renderStarSelector()}

                                <Text
                                    style={{
                                        ...styles.modalSubtitle,
                                        color: themeColor('secondaryText'),
                                        marginTop: 20
                                    }}
                                >
                                    {localeString(
                                        'views.Cashu.Mint.reviewTextLabel'
                                    )}
                                </Text>

                                <TextInput
                                    placeholder={localeString(
                                        'views.Cashu.Mint.reviewTextPlaceholder'
                                    )}
                                    value={reviewText}
                                    onChangeText={(text: string) =>
                                        this.setState({ reviewText: text })
                                    }
                                    multiline
                                    numberOfLines={3}
                                />

                                <View style={styles.modalButtons}>
                                    <Button
                                        title={localeString('general.next')}
                                        onPress={this.proceedToSigning}
                                    />
                                    <View style={styles.cancelButton}>
                                        <Button
                                            title={localeString(
                                                'general.cancel'
                                            )}
                                            onPress={this.closeReviewModal}
                                            secondary
                                        />
                                    </View>
                                </View>
                            </>
                        )}

                        {reviewStep === 'signing' && (
                            <>
                                <Text
                                    style={{
                                        ...styles.modalTitle,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.Cashu.Mint.signingMethod'
                                    )}
                                </Text>

                                <Text
                                    style={{
                                        ...styles.modalSubtitle,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Cashu.Mint.signingMethodSubtitle'
                                    )}
                                </Text>

                                {submitError ? (
                                    <View style={{ marginBottom: 15 }}>
                                        <ErrorMessage message={submitError} />
                                    </View>
                                ) : null}

                                {/* Anonymous option */}
                                <TouchableOpacity
                                    style={[
                                        styles.optionItem,
                                        {
                                            backgroundColor:
                                                themeColor('background')
                                        },
                                        signingMethod === 'anonymous' && [
                                            styles.optionItemSelected,
                                            {
                                                borderColor:
                                                    themeColor('highlight')
                                            }
                                        ]
                                    ]}
                                    onPress={() =>
                                        this.setState({
                                            signingMethod: 'anonymous'
                                        })
                                    }
                                >
                                    <View
                                        style={[
                                            styles.radioOuter,
                                            {
                                                borderColor:
                                                    themeColor('highlight')
                                            }
                                        ]}
                                    >
                                        {signingMethod === 'anonymous' && (
                                            <View
                                                style={[
                                                    styles.radioInner,
                                                    {
                                                        backgroundColor:
                                                            themeColor(
                                                                'highlight'
                                                            )
                                                    }
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
                                            {localeString(
                                                'views.Cashu.Mint.anonymousReview'
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                ...styles.optionDescription,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Cashu.Mint.anonymousReviewDesc'
                                            )}
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                {/* Nsec option */}
                                <TouchableOpacity
                                    style={[
                                        styles.optionItem,
                                        {
                                            backgroundColor:
                                                themeColor('background')
                                        },
                                        signingMethod === 'nsec' && [
                                            styles.optionItemSelected,
                                            {
                                                borderColor:
                                                    themeColor('highlight')
                                            }
                                        ]
                                    ]}
                                    onPress={() =>
                                        this.setState({ signingMethod: 'nsec' })
                                    }
                                >
                                    <View
                                        style={[
                                            styles.radioOuter,
                                            {
                                                borderColor:
                                                    themeColor('highlight')
                                            }
                                        ]}
                                    >
                                        {signingMethod === 'nsec' && (
                                            <View
                                                style={[
                                                    styles.radioInner,
                                                    {
                                                        backgroundColor:
                                                            themeColor(
                                                                'highlight'
                                                            )
                                                    }
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
                                            {localeString(
                                                'views.Cashu.Mint.useNsec'
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                ...styles.optionDescription,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Cashu.Mint.useNsecDesc'
                                            )}
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                {signingMethod === 'nsec' && (
                                    <View style={styles.nsecInputContainer}>
                                        <TextInput
                                            placeholder="nsec1..."
                                            value={nsecInput}
                                            onChangeText={
                                                this.validateAndSetNsec
                                            }
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            secureTextEntry
                                            error={!!nsecError}
                                            textColor={
                                                nsecError
                                                    ? themeColor('warning')
                                                    : undefined
                                            }
                                        />
                                        {nsecError ? (
                                            <Text
                                                style={{
                                                    ...styles.nsecError,
                                                    color: themeColor('warning')
                                                }}
                                            >
                                                {nsecError}
                                            </Text>
                                        ) : null}
                                    </View>
                                )}

                                <View style={styles.modalButtons}>
                                    {submittingReview ? (
                                        <LoadingIndicator />
                                    ) : (
                                        <>
                                            <Button
                                                title={localeString(
                                                    'views.Cashu.Mint.submitReviewButton'
                                                )}
                                                onPress={this.submitReview}
                                                disabled={!isNsecValid}
                                            />
                                            <View style={styles.cancelButton}>
                                                <Button
                                                    title={localeString(
                                                        'general.cancel'
                                                    )}
                                                    onPress={
                                                        this.closeReviewModal
                                                    }
                                                    secondary
                                                />
                                            </View>
                                        </>
                                    )}
                                </View>
                            </>
                        )}

                        {reviewStep === 'success' && (
                            <>
                                <Text
                                    style={{
                                        ...styles.modalTitle,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.Cashu.Mint.reviewSubmitted'
                                    )}
                                </Text>

                                <View style={{ marginVertical: 15 }}>
                                    <SuccessMessage
                                        message={localeString(
                                            'views.Cashu.Mint.reviewSubmittedDesc'
                                        )}
                                    />
                                </View>

                                {submittedNpub && (
                                    <View style={styles.npubContainer}>
                                        <Text
                                            style={{
                                                ...styles.npubLabel,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Cashu.Mint.publishedAs'
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                ...styles.npubValue,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {submittedNpub}
                                        </Text>
                                    </View>
                                )}

                                <View style={styles.modalButtons}>
                                    <Button
                                        title={localeString('general.close')}
                                        onPress={this.closeReviewModal}
                                    />
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </ModalBox>
        );
    };

    render() {
        const { navigation, route, CashuStore } = this.props;
        const { checkForExistingBalances } = this.state;
        const {
            addMint,
            removeMint,
            setSelectedMint,
            selectedMintUrl,
            restorationProgress,
            restorationKeyset,
            cashuWallets,
            loading,
            error,
            error_msg
        } = CashuStore;
        const mint = route.params?.mint;
        const lookup = route.params?.lookup;

        const mintInfo = mint;

        const isselectedMint =
            selectedMintUrl &&
            mint?.mintUrl &&
            selectedMintUrl === mint?.mintUrl;

        const errorConnecting = cashuWallets[mint?.mintUrl]?.errorConnecting;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('cashu.mint'),
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
                {error && (
                    <View style={{ margin: 20, marginBottom: 0 }}>
                        <ErrorMessage
                            message={error_msg || localeString('general.error')}
                        />
                    </View>
                )}
                {restorationProgress !== undefined && (
                    <View
                        style={{
                            backgroundColor: themeColor('highlight'),
                            borderRadius: 10,
                            margin: 20,
                            marginBottom: 0,
                            padding: 15,
                            borderWidth: 0.5
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Medium',
                                color: themeColor('background')
                            }}
                        >
                            {`${localeString(
                                'views.Wallet.BalancePane.recovery.title'
                            )}${
                                !restorationProgress
                                    ? ` - ${localeString(
                                          'views.Wallet.BalancePane.recovery.textAlt'
                                      )}`
                                    : ''
                            }`}
                        </Text>
                        {restorationProgress !== undefined && (
                            <>
                                <Text
                                    style={{
                                        fontFamily: 'PPNeueMontreal-Book',
                                        color: themeColor('background'),
                                        marginTop: 20
                                    }}
                                >
                                    {localeString(
                                        'views.Cashu.Mint.restoration'
                                    )}
                                </Text>
                                {restorationKeyset && (
                                    <Text
                                        style={{
                                            fontFamily: 'PPNeueMontreal-Book',
                                            color: themeColor('background')
                                        }}
                                    >
                                        {`${localeString(
                                            'views.Cashu.Mint.restorationKeyset'
                                        )}: ${restorationKeyset}`}
                                    </Text>
                                )}
                            </>
                        )}
                        {restorationProgress !== undefined && (
                            <View
                                style={{
                                    marginTop: 30,
                                    flex: 1,
                                    flexDirection: 'row',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    minWidth: '100%'
                                }}
                            >
                                <LinearProgress
                                    value={
                                        Math.floor(restorationProgress) / 100
                                    }
                                    variant="determinate"
                                    color={themeColor('background')}
                                    trackColor={themeColor(
                                        'secondaryBackground'
                                    )}
                                    style={{
                                        flex: 1,
                                        flexDirection: 'row'
                                    }}
                                />
                                <Text
                                    style={{
                                        fontFamily: 'PPNeueMontreal-Medium',
                                        color: themeColor('background'),
                                        marginTop: -8,
                                        marginLeft: 14,
                                        height: 40
                                    }}
                                >
                                    {`${Math.floor(
                                        restorationProgress
                                    ).toString()}%`}
                                </Text>
                            </View>
                        )}
                    </View>
                )}
                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.center}>
                        <MintAvatar
                            iconUrl={mintInfo?.icon_url}
                            name={mintInfo?.name}
                            mintUrl={mint?.mintUrl}
                            size="large"
                            style={{ marginBottom: 15 }}
                        />
                        {mintInfo?.name && (
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 28,
                                    fontWeight: 'bold',
                                    color: themeColor('text')
                                }}
                            >
                                {mintInfo?.name}
                            </Text>
                        )}
                        {errorConnecting && (
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 16,
                                    marginBottom: 10,
                                    color: themeColor('warning')
                                }}
                            >
                                {localeString('general.errorConnecting')}
                            </Text>
                        )}
                        {isselectedMint && (
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 16,
                                    marginBottom: 10,
                                    color: themeColor('highlight')
                                }}
                            >
                                {localeString('views.Cashu.Mint.selectedMint')}
                            </Text>
                        )}
                        {mintInfo?.description && (
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 18,
                                    marginBottom: 14,
                                    color: themeColor('text')
                                }}
                            >
                                {mintInfo?.description}
                            </Text>
                        )}
                        {mintInfo?.description_long && (
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 14,
                                    marginBottom: 10,
                                    color: themeColor('text')
                                }}
                            >
                                {mintInfo?.description_long}
                            </Text>
                        )}
                    </View>

                    {mint?.mintBalance !== undefined && (
                        <KeyValue
                            keyValue={localeString(
                                'views.Settings.Display.DefaultView.balance'
                            )}
                            value={
                                <Amount
                                    sats={mint.mintBalance}
                                    toggleable
                                    sensitive
                                />
                            }
                        />
                    )}

                    {mint?.mintUrl && (
                        <KeyValue
                            keyValue={localeString('cashu.mintUrl')}
                            value={mint?.mintUrl}
                        />
                    )}

                    {mintInfo?.version && (
                        <KeyValue
                            keyValue={localeString('general.version')}
                            value={mintInfo?.version}
                        />
                    )}

                    {mintInfo?.pubkey && (
                        <KeyValue
                            keyValue={localeString('views.NodeInfo.pubkey')}
                            value={mintInfo?.pubkey}
                        />
                    )}

                    {mintInfo?.nuts && (
                        <KeyValue
                            keyValue={localeString(
                                'views.Cashu.Mint.supportedNuts'
                            )}
                            value={
                                <>
                                    {Object.keys(mintInfo?.nuts).map(
                                        (title, index) => (
                                            <View
                                                key={`nuts-${index}`}
                                                style={{ margin: 3 }}
                                            >
                                                <Pill
                                                    title={title}
                                                    borderColor={themeColor(
                                                        'text'
                                                    )}
                                                    textColor={themeColor(
                                                        'text'
                                                    )}
                                                    borderWidth={1}
                                                    width={25}
                                                    height={25}
                                                />
                                            </View>
                                        )
                                    )}
                                </>
                            }
                        />
                    )}

                    {mintInfo?.contact &&
                        mintInfo?.contact.map((contact: any, index: number) => {
                            const { info, method } = contact;
                            const methodCapitalized =
                                String(method).charAt(0).toUpperCase() +
                                String(method).slice(1);
                            const methodLower = method.toLowerCase();
                            const supported =
                                supportedContacts.includes(methodLower);

                            if (!contact.info) return;
                            return (
                                <KeyValue
                                    key={`contact-${index}`}
                                    keyValue={methodCapitalized}
                                    value={
                                        <TouchableOpacity
                                            key={`contact-${contact.method}`}
                                            onPress={() => {
                                                if (!supported) return;

                                                if (methodLower === 'email') {
                                                    const url = `mailto:${contact.info}`;
                                                    Linking.canOpenURL(
                                                        url
                                                    ).then(
                                                        (
                                                            supported: boolean
                                                        ) => {
                                                            if (supported) {
                                                                Linking.openURL(
                                                                    url
                                                                );
                                                            }
                                                        }
                                                    );
                                                }

                                                if (
                                                    methodLower === 'x' ||
                                                    methodLower === 'twitter'
                                                ) {
                                                    UrlUtils.goToUrl(
                                                        `https://x.com/${info}`
                                                    );
                                                }

                                                if (methodLower === 'nostr') {
                                                    UrlUtils.goToUrl(
                                                        `https://njump.me/${info}`
                                                    );
                                                }
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    ...styles.valueWithLink,
                                                    color: supported
                                                        ? themeColor(
                                                              'highlight'
                                                          )
                                                        : themeColor('text')
                                                }}
                                            >
                                                {`${
                                                    typeof info === 'string' &&
                                                    PrivacyUtils.sensitiveValue(
                                                        { input: info }
                                                    )
                                                }`}
                                            </Text>
                                        </TouchableOpacity>
                                    }
                                />
                            );
                        })}
                </ScrollView>
                {mint?.mintUrl && !loading && !restorationProgress && (
                    <>
                        {lookup ? (
                            <View
                                style={{
                                    paddingVertical: 10,
                                    backgroundColor: themeColor('background')
                                }}
                            >
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        margin: 20,
                                        marginTop: 20
                                    }}
                                >
                                    <View
                                        style={{
                                            flex: 1,
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Cashu.Mint.checkForExistingBalances'
                                            )}
                                        </Text>
                                    </View>
                                    <View
                                        style={{
                                            alignSelf: 'center',
                                            marginLeft: 5
                                        }}
                                    >
                                        <Switch
                                            value={checkForExistingBalances}
                                            onValueChange={() =>
                                                this.setState({
                                                    checkForExistingBalances:
                                                        !checkForExistingBalances
                                                })
                                            }
                                            disabled={loading}
                                        />
                                    </View>
                                </View>
                                <View
                                    style={{ width: '100%', marginBottom: 10 }}
                                >
                                    <Button
                                        title={localeString(
                                            'views.Cashu.AddMint.title'
                                        )}
                                        tertiary
                                        onPress={async () => {
                                            await addMint(
                                                mint?.mintUrl,
                                                checkForExistingBalances
                                            );
                                            navigation.popTo('Mints');
                                        }}
                                        buttonStyle={{ height: 40 }}
                                        disabled={loading}
                                    />
                                </View>
                                <View style={{ width: '100%' }}>
                                    <Button
                                        title={localeString(
                                            'views.Cashu.Mint.reviewMint'
                                        )}
                                        secondary
                                        onPress={this.openReviewModal}
                                        buttonStyle={{ height: 40 }}
                                        disabled={loading}
                                    />
                                </View>
                            </View>
                        ) : (
                            <>
                                <View
                                    style={{
                                        paddingVertical: 10,
                                        backgroundColor:
                                            themeColor('background')
                                    }}
                                >
                                    {!isselectedMint && (
                                        <View
                                            style={{
                                                width: '100%',
                                                marginBottom: 20
                                            }}
                                        >
                                            <Button
                                                title={localeString(
                                                    'views.Cashu.Mint.setSelected'
                                                ).toUpperCase()}
                                                tertiary
                                                noUppercase
                                                onPress={async () => {
                                                    await setSelectedMint(
                                                        mint?.mintUrl
                                                    );
                                                }}
                                                buttonStyle={{ height: 40 }}
                                                disabled={loading}
                                            />
                                        </View>
                                    )}
                                    <View
                                        style={{
                                            width: '100%',
                                            marginBottom: 20
                                        }}
                                    >
                                        <Button
                                            title={localeString(
                                                'views.Cashu.Mint.reviewMint'
                                            )}
                                            tertiary
                                            onPress={this.openReviewModal}
                                            buttonStyle={{ height: 40 }}
                                            disabled={loading}
                                        />
                                    </View>
                                    <View style={{ width: '100%' }}>
                                        <Button
                                            title={localeString(
                                                'views.Cashu.Mint.removeMint'
                                            )}
                                            warning
                                            onPress={async () => {
                                                await removeMint(mint?.mintUrl);
                                                navigation.goBack();
                                            }}
                                            buttonStyle={{ height: 40 }}
                                            disabled={loading}
                                        />
                                    </View>
                                </View>
                            </>
                        )}
                    </>
                )}
                {this.renderReviewModal()}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20,
        overflow: 'hidden'
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    },
    valueWithLink: {
        paddingBottom: 5,
        fontFamily: 'PPNeueMontreal-Book'
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
        marginBottom: 15
    },
    starContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 10
    },
    starButton: {
        padding: 5
    },
    ratingText: {
        fontFamily: 'PPNeueMontreal-Medium',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 10
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
    nsecInputContainer: {
        marginTop: 10
    },
    nsecError: {
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
    npubContainer: {
        marginVertical: 10
    },
    npubLabel: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 12,
        marginBottom: 5
    },
    npubValue: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 12
    }
});
