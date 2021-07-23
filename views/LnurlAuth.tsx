import * as React from 'react';
import RNFetchBlob from 'rn-fetch-blob';
import { Alert, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, Header, Icon } from 'react-native-elements';
import querystring from 'querystring-es3';
import url from 'url';
import SettingsStore from './../stores/SettingsStore';
import { localeString } from './../utils/LocaleUtils';
import RESTUtils from './../utils/RESTUtils';
import Base64Utils from './../utils/Base64Utils';
import { Hash as sha256Hash, HMAC as sha256HMAC } from 'fast-sha256';

const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

const LNURLAUTH_CANONICAL_PHRASE =
    'DO NOT EVER SIGN THIS TEXT WITH YOUR PRIVATE KEYS! IT IS ONLY USED FOR DERIVATION OF LNURL-AUTH HASHING-KEY, DISCLOSING ITS SIGNATURE WILL COMPROMISE YOUR LNURL-AUTH IDENTITY AND MAY LEAD TO LOSS OF FUNDS!';

interface LnurlAuthProps {
    navigation: any;
    SettingsStore: SettingsStore;
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

@inject('SettingsStore')
@observer
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
                [{ text: 'OK', onPress: () => void 0 }],
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

        const body = {
            msg: Base64Utils.btoa(LNURLAUTH_CANONICAL_PHRASE),
            key_loc: {
                key_family: 0,
                key_index: 0
            }
        };

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
                    linkingKeyPriv
                );
                const signedMessageDER = signedMessage.toDER();

                this.setState({
                    linkingKeyPub: linkingKeyPub,
                    signedMessageDER: Base64Utils.bytesToHexString(
                        signedMessageDER
                    ),
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
                        [{ text: 'OK', onPress: () => void 0 }],
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
        const { SettingsStore, navigation } = this.props;
        const {
            domain,
            preparingSignature,
            signatureSuccess,
            authenticating,
            lnurlAuthSuccess,
            errorMsgAuth
        } = this.state;
        const { settings } = SettingsStore;
        const { theme } = settings;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View
                style={
                    theme === 'dark'
                        ? styles.darkThemeStyle
                        : styles.lightThemeStyle
                }
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: 'Authentication Request',
                        style: { color: '#fff' }
                    }}
                    backgroundColor="grey"
                />
                <View style={styles.content}>
                    <Text
                        style={{
                            padding: 20,
                            fontWeight: 'bold',
                            fontSize: 22,
                            color: theme === 'dark' ? 'white' : 'black'
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
                            <ActivityIndicator size="large" color="#0000ff" />
                        )}
                        {lnurlAuthSuccess && (
                            <Text style={{ color: 'green' }}>
                                {localeString('views.LnurlAuth.loginSuccess')}
                            </Text>
                        )}
                        {!preparingSignature &&
                            !signatureSuccess &&
                            !authenticating &&
                            !lnurlAuthSuccess && (
                                <Text style={{ color: 'red' }}>
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
    lightThemeStyle: {
        flex: 1,
        backgroundColor: 'white'
    },
    darkThemeStyle: {
        flex: 1,
        backgroundColor: 'black',
        color: 'white'
    },
    textInput: {
        fontSize: 20,
        color: 'black',
        paddingTop: 10,
        paddingBottom: 10
    },
    textInputDark: {
        fontSize: 20,
        color: 'white',
        paddingTop: 10,
        paddingBottom: 10
    },
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15
    }
});
