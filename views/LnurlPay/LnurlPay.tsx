import url from 'url';
import * as React from 'react';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import querystring from 'querystring-es3';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Amount from '../../components/Amount';
import AmountInput from '../../components/AmountInput';
import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import TextInput from '../../components/TextInput';
import { Row } from '../..//components/layout/Row';
import LoadingIndicator from '../../components/LoadingIndicator';

import CashuStore from '../../stores/CashuStore';
import ContactStore from '../../stores/ContactStore';
import InvoicesStore from '../../stores/InvoicesStore';
import LnurlPayStore from '../../stores/LnurlPayStore';
import UnitsStore from '../../stores/UnitsStore';

import Contact from '../../models/Contact';

import LnurlPayMetadata from './Metadata';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { getUnformattedAmount, getSatAmount } from '../../utils/AmountUtils';
import { ScrollView } from 'react-native-gesture-handler';

interface LnurlPayProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    ContactStore: ContactStore;
    InvoicesStore: InvoicesStore;
    LnurlPayStore: LnurlPayStore;
    UnitsStore: UnitsStore;
    route: Route<
        'LnurlPay',
        {
            lnurlParams: any;
            amount: any;
            satAmount: any;
            ecash: boolean;
            lightningAddress?: string;
        }
    >;
}

interface LnurlPayState {
    amount: string;
    satAmount: string | number;
    domain: string;
    lightningAddress: string;
    matchedContact: Contact | null;
    comment: string;
    loading: boolean;
}

@inject(
    'CashuStore',
    'ContactStore',
    'InvoicesStore',
    'LnurlPayStore',
    'UnitsStore'
)
@observer
export default class LnurlPay extends React.Component<
    LnurlPayProps,
    LnurlPayState
> {
    constructor(props: LnurlPayProps) {
        super(props);

        try {
            this.state = {
                ...this.stateFromProps(props),
                loading: false
            };
        } catch (err: any) {
            this.state = {
                amount: '',
                satAmount: '',
                domain: '',
                lightningAddress: '',
                matchedContact: null,
                comment: '',
                loading: false
            };

            Alert.alert(
                localeString('views.LnurlPay.LnurlPay.invalidParams'),
                err.message,
                [{ text: localeString('general.ok'), onPress: () => void 0 }],
                { cancelable: false }
            );
        }
    }

    // ensure the state is reset to show correct units
    // for when users navs back
    resetState = () => {
        this.setState({
            ...this.stateFromProps(this.props)
        });
    };

    componentDidMount() {
        this.props.navigation.addListener('focus', this.resetState);
    }

    componentWillUnmount() {
        this.props.navigation.removeListener &&
            this.props.navigation.removeListener('focus', this.resetState);
    }

    stateFromProps(props: LnurlPayProps) {
        const { route, UnitsStore, ContactStore } = props;
        const { resetUnits, units } = UnitsStore;
        const {
            lnurlParams: lnurl,
            amount,
            satAmount,
            lightningAddress
        } = route.params ?? {};

        // if requested amount is fixed,
        // convert units to sats so conversion rate doesn't make things unpayable
        if (lnurl.minSendable === lnurl.maxSendable) {
            resetUnits();
        }

        const minSendableSats = Math.floor(lnurl.minSendable / 1000);

        let finalAmount: string;
        let finalSatAmount: string | number;

        if (satAmount && satAmount != 0) {
            // If satAmount is provided, always derive display amount from it
            // (ignore any `amount` param as it may be in a different unit)
            const { amount: displayAmount } = getUnformattedAmount({
                sats: satAmount
            });
            finalAmount = displayAmount;
            finalSatAmount = satAmount;
        } else if (amount && amount != 0) {
            // If only amount is provided, use it and derive satAmount
            finalAmount = amount;
            finalSatAmount = getSatAmount(amount);
        } else {
            // Fall back to min sat amount
            const { amount: unformattedAmount } = getUnformattedAmount({
                sats: minSendableSats
            });
            const unspecifiedDefault =
                units === 'sats'
                    ? minSendableSats.toString()
                    : unformattedAmount;
            finalAmount = amount && amount != 0 ? amount : unspecifiedDefault;
            finalSatAmount = minSendableSats;
        }

        // Find matching contact by Lightning Address
        let matchedContact: Contact | null = null;
        if (lightningAddress && ContactStore?.contacts) {
            const normalizedAddress = lightningAddress.toLowerCase();
            const found = ContactStore.contacts.find((contact: Contact) =>
                contact.lnAddress?.some(
                    (addr: string) =>
                        addr && addr.toLowerCase() === normalizedAddress
                )
            );
            if (found) {
                matchedContact = new Contact(found);
            }
        }

        return {
            amount: finalAmount,
            satAmount: finalSatAmount,
            domain: lnurl.domain,
            lightningAddress: lightningAddress || '',
            matchedContact,
            comment: ''
        };
    }

    sendValues(satAmount: string | number) {
        this.setState({ loading: true });

        const { navigation, CashuStore, InvoicesStore, LnurlPayStore, route } =
            this.props;
        const { domain, comment, lightningAddress } = this.state;
        const ecash = route.params?.ecash;
        const lnurl = route.params?.lnurlParams;
        const u = url.parse(lnurl.callback);
        const qs = querystring.parse(u.query);
        qs.amount = Number(
            (parseFloat(satAmount.toString()) * 1000).toString()
        );
        qs.comment = comment;
        u.search = querystring.stringify(qs);
        u.query = querystring.stringify(qs);

        ReactNativeBlobUtil.fetch('get', url.format(u))
            .then((response: any) => {
                try {
                    const data = response.json();
                    return data;
                } catch (err) {
                    return { status: 'ERROR', reason: response.text() };
                }
            })
            .catch((err: any) => ({
                status: 'ERROR',
                reason: err.message
            }))
            .then((data: any) => {
                if (data.status === 'ERROR') {
                    this.setState({ loading: false });

                    Alert.alert(
                        `[error] ${domain} says:`,
                        data.reason,
                        [
                            {
                                text: localeString('general.ok'),
                                onPress: () => void 0
                            }
                        ],
                        { cancelable: false }
                    );
                    return;
                }

                const pr = data.pr;
                const successAction = data.successAction || {
                    tag: 'noop'
                };

                // Zaplocker data
                const pmthash_sig = data.pmthash_sig;
                const user_pubkey = data.user_pubkey;
                const relays = data.relays;
                const relays_sig = data.relays_sig;

                if (ecash) {
                    // load up both the payment routes
                    InvoicesStore.getPayReq(pr);
                    CashuStore.getPayReq(pr).then(() => {
                        this.setState({ loading: false });

                        if (CashuStore.getPayReqError) {
                            Alert.alert(
                                localeString(
                                    'views.LnurlPay.LnurlPay.invalidInvoice'
                                ),
                                CashuStore.getPayReqError,
                                [
                                    {
                                        text: localeString('general.ok'),
                                        onPress: () => void 0
                                    }
                                ],
                                { cancelable: false }
                            );
                            return;
                        }

                        const payment_hash: string =
                            (CashuStore.payReq &&
                                CashuStore.payReq.payment_hash) ||
                            '';
                        const description_hash: string =
                            (CashuStore.payReq &&
                                CashuStore.payReq.description_hash) ||
                            '';

                        LnurlPayStore.keep(
                            payment_hash,
                            domain,
                            lnurl.lnurlText,
                            lnurl.metadata,
                            description_hash,
                            successAction,
                            // Zaplocker
                            pmthash_sig,
                            user_pubkey,
                            relays,
                            relays_sig,
                            pr,
                            lightningAddress
                        );

                        navigation.navigate('ChoosePaymentMethod', {
                            lightning: CashuStore.paymentRequest,
                            locked: true
                        });
                    });
                } else {
                    InvoicesStore.getPayReq(pr).then(() => {
                        this.setState({ loading: false });

                        if (InvoicesStore.getPayReqError) {
                            Alert.alert(
                                localeString(
                                    'views.LnurlPay.LnurlPay.invalidInvoice'
                                ),
                                InvoicesStore.getPayReqError,
                                [
                                    {
                                        text: localeString('general.ok'),
                                        onPress: () => void 0
                                    }
                                ],
                                { cancelable: false }
                            );
                            return;
                        }

                        const payment_hash: string =
                            (InvoicesStore.pay_req &&
                                InvoicesStore.pay_req.payment_hash) ||
                            '';
                        const description_hash: string =
                            (InvoicesStore.pay_req &&
                                InvoicesStore.pay_req.description_hash) ||
                            '';

                        LnurlPayStore.keep(
                            payment_hash,
                            domain,
                            lnurl.lnurlText,
                            lnurl.metadata,
                            description_hash,
                            successAction,
                            // Zaplocker
                            pmthash_sig,
                            user_pubkey,
                            relays,
                            relays_sig,
                            pr,
                            lightningAddress
                        );
                        navigation.navigate('PaymentRequest');
                    });
                }
            });
    }

    render() {
        const { navigation, route } = this.props;
        const {
            amount,
            satAmount,
            domain,
            lightningAddress,
            matchedContact,
            comment,
            loading
        } = this.state;

        const lnurl = route.params?.lnurlParams;

        // Extract image from LNURL metadata
        let metadataImage: string | null = null;
        try {
            const keypairs: Array<[string, string]> = JSON.parse(
                lnurl.metadata
            );
            metadataImage =
                keypairs
                    .filter(([typ]) => typ.startsWith('image/'))
                    .map(([typ, content]) => `data:${typ},${content}`)[0] ||
                null;
        } catch (err) {
            console.log('Error parsing LNURL metadata:', err);
        }

        // Priority: Contact photo > LNURL metadata image
        const displayImage = matchedContact?.photo
            ? matchedContact.getPhoto
            : metadataImage;
        const displayName = matchedContact?.name;
        const displayAddress = lightningAddress || domain;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('general.send'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}
                        >
                            {loading && <LoadingIndicator size={30} />}
                        </View>
                    }
                    navigation={navigation}
                />
                <ScrollView keyboardShouldPersistTaps="handled">
                    {/* Lightning Address Header */}
                    {displayAddress && (
                        <View style={styles.headerSection}>
                            {displayImage && (
                                <Image
                                    source={{ uri: displayImage }}
                                    style={styles.profileImage}
                                />
                            )}
                            {displayName && (
                                <Text
                                    style={[
                                        styles.nameText,
                                        { color: themeColor('text') }
                                    ]}
                                >
                                    {displayName}
                                </Text>
                            )}
                            <Text
                                style={[
                                    styles.addressText,
                                    { color: themeColor('text') }
                                ]}
                            >
                                {displayAddress}
                            </Text>
                            <View style={{ marginTop: 8 }}>
                                <LnurlPayMetadata
                                    metadata={lnurl.metadata}
                                    showArrow={false}
                                    hideImage={true}
                                />
                            </View>
                        </View>
                    )}

                    <View style={styles.content}>
                        <View style={{ marginTop: 4 }}>
                            <Row align="flex-end">
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.LnurlPay.LnurlPay.amount'
                                    )}
                                </Text>
                                {lnurl &&
                                    lnurl.minSendable !== lnurl.maxSendable && (
                                        <>
                                            <Text
                                                style={{
                                                    ...styles.text,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {' ('}
                                            </Text>
                                            <Amount
                                                color="secondaryText"
                                                sats={Math.ceil(
                                                    lnurl.minSendable / 1000
                                                )}
                                                defaultTextSize={true}
                                            />
                                            <Text
                                                style={{
                                                    ...styles.text,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {' - '}
                                            </Text>
                                            <Amount
                                                color="secondaryText"
                                                sats={Math.floor(
                                                    lnurl.maxSendable / 1000
                                                )}
                                                defaultTextSize={true}
                                            />
                                            <Text
                                                style={{
                                                    ...styles.text,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {')'}
                                            </Text>
                                        </>
                                    )}
                            </Row>
                        </View>
                        <View style={{ marginTop: 0 }}>
                            <AmountInput
                                amount={amount}
                                locked={
                                    loading ||
                                    (lnurl &&
                                    lnurl.minSendable === lnurl.maxSendable
                                        ? true
                                        : false)
                                }
                                onAmountChange={(
                                    amount: string,
                                    satAmount: string | number
                                ) => {
                                    this.setState({
                                        amount,
                                        satAmount
                                    });
                                }}
                            />
                        </View>

                        {lnurl.commentAllowed > 0 ? (
                            <>
                                <Text
                                    style={{
                                        ...styles.text,
                                        marginTop: 10,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.LnurlPay.LnurlPay.comment'
                                    ) + ` (${lnurl.commentAllowed} char)`}
                                </Text>
                                <TextInput
                                    value={comment}
                                    onChangeText={(text: string) => {
                                        this.setState({ comment: text });
                                    }}
                                    locked={loading}
                                />
                            </>
                        ) : null}
                        <View style={styles.button}>
                            <Button
                                title={localeString(
                                    'views.LnurlPay.LnurlPay.confirm'
                                )}
                                titleStyle={{
                                    color: themeColor('text')
                                }}
                                icon={{
                                    name: 'send',
                                    size: 25,
                                    color: themeColor('text')
                                }}
                                onPress={() => {
                                    this.sendValues(satAmount);
                                }}
                                buttonStyle={{
                                    backgroundColor: themeColor('secondary')
                                }}
                                disabled={loading}
                            />
                        </View>
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    content: { paddingHorizontal: 20 },
    button: { paddingVertical: 15 },
    headerSection: {
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 20
    },
    profileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 15
    },
    nameText: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 5,
        fontFamily: 'PPNeueMontreal-Book'
    },
    addressText: {
        fontSize: 18,
        fontFamily: 'PPNeueMontreal-Book'
    }
});
