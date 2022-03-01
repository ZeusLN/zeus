import url from 'url';
import * as React from 'react';
import RNFetchBlob from 'rn-fetch-blob';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import querystring from 'querystring-es3';
import { Hash as sha256Hash, HMAC as sha256HMAC } from 'fast-sha256';

import Button from './../components/Button';
import LoadingIndicator from './../components/LoadingIndicator';

import { themeColor } from './../utils/ThemeUtils';
import { localeString } from './../utils/LocaleUtils';
import RESTUtils from './../utils/RESTUtils';
import Base64Utils from './../utils/Base64Utils';

const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

const LNURLAUTH_CANONICAL_PHRASE =
    'DO NOT EVER SIGN THIS TEXT WITH YOUR PRIVATE KEYS! IT IS ONLY USED FOR DERIVATION OF LNURL-AUTH HASHING-KEY, DISCLOSING ITS SIGNATURE WILL COMPROMISE YOUR LNURL-AUTH IDENTITY AND MAY LEAD TO LOSS OF FUNDS!';

interface LnurlAuthProps {
    navigation: any;
}

interface LnurlAuthState {
    domain: string;
    action: string;
    k1: string;
    linkingKeyPub: string;
    signedMessageDER: string;
    preparingSignature: boolean;
    authenticating: boolean;
    signatureSuccess: boolean;
    lnurlAuthSuccess: boolean;
    errorMsgAuth: string;
}

export default class LnurlAuth extends React.Component<
    LnurlAuthProps,
    LnurlAuthState
> {
    constructor(props: LnurlAuthProps) {
        super(props);

        try {
            this.state = this.stateFromProps(props);
        } catch (err) {
            this.state = {
                domain: '',
                action: '',
                k1: '',
                linkingKeyPub: '',
                signedMessageDER: '',
                preparingSignature: false,
                authenticating: false,
                signatureSuccess: false,
                lnurlAuthSuccess: false,
                errorMsgAuth: ''
            };

            Alert.alert(
                localeString('views.LnurlPay.LnurlPay.invalidParams'),
                err.message,
                [{ text: localeString('general.ok'), onPress: () => void 0 }],
                { cancelable: false }
            );
        }
    }

    stateFromProps(props: LnurlAuthProps) {
        const { navigation } = props;
        const lnurl = navigation.getParam('lnurlParams');

        return {
            domain: lnurl.domain,
            action: lnurl.action,
            k1: lnurl.k1,
            linkingKeyPub: '',
            signedMessageDER: '',
            preparingSignature: false,
            authenticating: false,
            signatureSuccess: false,
            lnurlAuthSuccess: false,
            errorMsgAuth: 'Error'
        };
    }

    triggerSign() {
        this.setState({ preparingSignature: true });

        const body = LNURLAUTH_CANONICAL_PHRASE;

        RESTUtils.signMessage(body)
            .then((signature: any) => {
                // got the signed message, now build linkingkey

                // from https://github.com/hsjoberg/blixt-wallet/blob/931c625666633915412bf7d8947ef6c2c5ce92b3/src/state/LNURL.ts
                // 1. The following canonical phrase is defined: [...].
                // 2. LN WALLET obtains an RFC6979 deterministic signature of sha256(utf8ToBytes(canonical phrase)) using secp256k1 with node private key.
                // 3. LN WALLET defines hashingKey as PrivateKey(sha256(obtained signature)).
                const hashingKey = new sha256Hash()
                    .update(Base64Utils.stringToUint8Array(signature.signature))
                    .digest();
                // // 4. SERVICE domain name is extracted from auth LNURL and then service-specific linkingPrivKey is defined as PrivateKey(hmacSha256(hashingKey, service domain name)).
                const linkingKeyPriv = new sha256HMAC(hashingKey)
                    .update(Base64Utils.stringToUint8Array(this.state.domain))
                    .digest();

                const linkingKeyPair = ec.keyFromPrivate(linkingKeyPriv, true);
                const pubPoint = linkingKeyPair.getPublic();
                // Need to compress the key
                const linkingKeyPub = pubPoint.encodeCompressed('hex');

                const signedMessage = ec.sign(
                    Base64Utils.hexToUint8Array(this.state.k1),
                    linkingKeyPriv,
                    { canonical: true }
                );
                const signedMessageDER = signedMessage.toDER();

                this.setState({
                    linkingKeyPub,
                    signedMessageDER:
                        Base64Utils.bytesToHexString(signedMessageDER),
                    preparingSignature: false,
                    signatureSuccess: true
                });
            })
            .catch((error: any) => {
                // handle error
                this.setState({
                    preparingSignature: false,
                    errorMsgAuth: error.toString()
                });
            });
    }
    componentDidMount() {
        this.triggerSign();
    }

    sendValues() {
        this.setState({ authenticating: true });

        const { navigation } = this.props;
        const { domain } = this.state;
        const lnurl = navigation.getParam('lnurlParams');
        const u = url.parse(lnurl.callback);
        const qs = querystring.parse(u.query);
        qs.key = this.state.linkingKeyPub;
        qs.sig = this.state.signedMessageDER;

        u.search = querystring.stringify(qs);
        u.query = querystring.stringify(qs);

        RNFetchBlob.fetch('get', url.format(u))
            .then((response: any) => {
                try {
                    const data = response.json();
                    return data;
                } catch (err) {
                    this.setState({
                        signatureSuccess: false,
                        authenticating: false,
                        errorMsgAuth: response.text()
                    });
                    return { status: 'ERROR', reason: response.text() };
                }
            })
            .catch((err: any) => ({
                status: 'ERROR',
                reason: err.message
            }))
            .then((data: any) => {
                if (data.status === 'ERROR') {
                    this.setState({
                        authenticating: false,
                        signatureSuccess: false,
                        errorMsgAuth: data.reason
                    });
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
                } else {
                    this.setState({
                        authenticating: false,
                        signatureSuccess: false,
                        lnurlAuthSuccess: true
                    });
                }
            });
    }

    render() {
        const { navigation } = this.props;
        const {
            domain,
            preparingSignature,
            signatureSuccess,
            authenticating,
            lnurlAuthSuccess,
            errorMsgAuth
        } = this.state;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: 'Authentication Request',
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <View style={styles.content}>
                    <Text
                        style={{
                            padding: 20,
                            fontSize: 22,
                            color: themeColor('text'),
                            fontFamily: 'Lato-Bold'
                        }}
                    >
                        {domain}
                    </Text>
                </View>
                <View style={styles.content}>
                    <View style={styles.button}>
                        <Button
                            title="Login"
                            icon={{
                                name: 'vpn-key',
                                size: 25,
                                color: 'white'
                            }}
                            onPress={() => {
                                this.sendValues();
                            }}
                            style={styles.button}
                            disabled={!signatureSuccess || authenticating}
                            buttonStyle={{
                                backgroundColor: 'orange',
                                borderRadius: 30
                            }}
                        />
                    </View>

                    <View style={styles.content}>
                        {(preparingSignature || authenticating) && (
                            <LoadingIndicator />
                        )}
                        {lnurlAuthSuccess && (
                            <Text
                                style={{
                                    color: 'green',
                                    fontFamily: 'Lato-Regular'
                                }}
                            >
                                {localeString('views.LnurlAuth.loginSuccess')}
                            </Text>
                        )}
                        {!preparingSignature &&
                            !signatureSuccess &&
                            !authenticating &&
                            !lnurlAuthSuccess && (
                                <Text
                                    style={{
                                        color: 'red',
                                        fontFamily: 'Lato-Regular'
                                    }}
                                >
                                    {errorMsgAuth ||
                                        localeString('general.error')}
                                </Text>
                            )}
                    </View>
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15
    }
});
