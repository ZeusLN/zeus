import * as React from 'react';
import RNFetchBlob from 'rn-fetch-blob';
import { Alert, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, Header, Icon, CheckBox } from 'react-native-elements';
import querystring from 'querystring-es3';
import url from 'url';
import SettingsStore from './../stores/SettingsStore';
import NodeInfoStore from './../stores/NodeInfoStore';

import { localeString } from './../utils/LocaleUtils';
import NodeUriUtils from './../utils/NodeUriUtils';
import RESTUtils from './../utils/RESTUtils';
import Base64Utils from './../utils/Base64Utils';

import sha256, { Hash as sha256Hash, HMAC as sha256HMAC } from "fast-sha256";
// import {secp256k1} from "secp256k1";

var EC = require('elliptic').ec;
var ec = new EC('secp256k1');
// import EC from 'elliptic';
// import * as secp from "noble-secp256k1";

const secp256k1 = require('bcrypto/lib/secp256k1');

const LNURLAUTH_CANONICAL_PHRASE = "DO NOT EVER SIGN THIS TEXT WITH YOUR PRIVATE KEYS! IT IS ONLY USED FOR DERIVATION OF LNURL-AUTH HASHING-KEY, DISCLOSING ITS SIGNATURE WILL COMPROMISE YOUR LNURL-AUTH IDENTITY AND MAY LEAD TO LOSS OF FUNDS!";

interface LnurlAuthProps {
    navigation: any;
    SettingsStore: SettingsStore;
    NodeInfoStore: NodeInfoStore;
}

interface LnurlAuthState {
    domain: string;
    action: string;
    k1: string;
    preparingSignature: boolean;
    signatureSuccess: boolean;
    errorMsgAuth: string;
}

@inject('SettingsStore', 'NodeInfoStore')
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
                preparingSignature: false,
                signatureSuccess: false,
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
        console.log("lnurlParams: ", lnurl)
        // lnurlParams:  {"callback": "https://lnurl.fiatjaf.com/lnurl-login?tag=login&k1=cd92c82833e069c50b390d84c40c3f396d68c2874642325957b3902710ec4afc", 
        // "domain": "lnurl.fiatjaf.com", "k1": "cd92c82833e069c50b390d84c40c3f396d68c2874642325957b3902710ec4afc", "tag": "login"}

        return {
            domain: lnurl.domain,
            action: lnurl.action,
            k1: lnurl.k1,
            preparingSignature: false,
            signatureSuccess: false,
            errorMsgAuth: 'Error'
        };
    }

    triggerSign() {
        // const { node_pubkey_string, host } = this.state;
        this.setState({ preparingSignature: true });
        console.log("base64 encoded canonical ", Buffer.from(LNURLAUTH_CANONICAL_PHRASE).toString('base64'))

        RESTUtils.signMessage({
            "message": LNURLAUTH_CANONICAL_PHRASE
        })
            .then((signature) => {
                console.log("signature: ", signature);

                // got the signed message, now build linkingkey

                // copy/pasta from blixt: 
                // https://github.com/hsjoberg/blixt-wallet/blob/931c625666633915412bf7d8947ef6c2c5ce92b3/src/state/LNURL.ts
                // 1. The following canonical phrase is defined: [...].
                // 2. LN WALLET obtains an RFC6979 deterministic signature of sha256(utf8ToBytes(canonical phrase)) using secp256k1 with node private key.
                // 3. LN WALLET defines hashingKey as PrivateKey(sha256(obtained signature)).
                const hashingKey = new sha256Hash().update(Base64Utils.stringToUint8Array(signature.signature)).digest();
                console.log("hashingKey: ", hashingKey);
                // // 4. SERVICE domain name is extracted from auth LNURL and then service-specific linkingPrivKey is defined as PrivateKey(hmacSha256(hashingKey, service domain name)).
                const linkingKeyPriv = new sha256HMAC(hashingKey).update(Base64Utils.stringToUint8Array(this.state.domain)).digest();
                console.log("linkingKeyPriv ", linkingKeyPriv);

                // Obtain the public key
                // secp256k1 v4.x
                // const linkingKeyPub = secp256k1.publicKeyCreate(linkingKeyPriv, true);

                // // secp256k1 v3.x
                // const linkingKeyPub = secp256k1.publicKeyCreate(new Buffer.from(linkingKeyPriv), true);

                // noble-secp256k1
                // const linkingKeyPub = secp.getPublicKey(linkingKeyPriv);

                // ecdsa - deprecated
                // var msg = new Buffer("hello world!", 'utf8')

                // bcrypto
                // const linkingKeyPub = secp256k1.publicKeyCreate(new Buffer(linkingKeyPriv), true);
                
                // elliptic
                // console.log("EC, ec: ", EC, ec);
                const linkingKeyPair = ec.keyFromPrivate(linkingKeyPriv, true);
                var pubPoint = linkingKeyPair.getPublic();
                var linkingKeyPub = pubPoint.encode('hex');

                // Generate keys
                // var key = ec.genKeyPair();
                // console.log("key ", key);
                // Sign the message's hash (input must be an array, or a hex-string)
                // var msgHash = [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ];
                // var signature = linkingKeyPair.sign(msgHash);
                // console.log("signature ", signature);
                // // Export DER encoded signature in Array
                // var derSign = signature.toDER();
                // console.log("derSign ", derSign);
                // // Verify signature
                // console.log("verify: ", linkingKeyPair.verify(msgHash, derSign));

                console.log("linkingKeyPub ", linkingKeyPub);


                // // Sign the message
                // secp256k1 v4.x
                // const signedMessage = secp256k1.ecdsaSign(Base64Utils.hexToUint8Array(this.state.k1), linkingKeyPriv);
                // const signedMessageDER = secp256k1.signatureExport(signedMessage.signature)

                // // secp256k1 v3.x
                // // new Buffer.from(this.state.k1) // needs to be 32 bytes Buffer
                // const k1hash = sha256(this.state.k1);
                // const k1hashbuffer = new Buffer.from(k1hash);
                // const linkingKeyPrivbuffer = new Buffer.from(linkingKeyPriv);
                // console.log("k1, k1hash, k1hashbuffer: ", this.state.k1, k1hash, k1hashbuffer);
                // console.log(Buffer.isBuffer(k1hash), Buffer.isBuffer(linkingKeyPriv));
                // const signedMessage = secp256k1.sign(k1hashbuffer, linkingKeyPrivbuffer);
                // console.log("signedMessage", signedMessage);
                // const signedMessageDER = secp256k1.signatureExport(new Buffer.from(signedMessage.signature));


                // bcrypto - verification failed
                // console.log(this.state.k1)
                // console.log(Buffer.isBuffer(new Buffer(this.state.k1, 'utf8')), Buffer.isBuffer(new Buffer(linkingKeyPriv)));
                // const signedMessage = secp256k1.sign(new Buffer(this.state.k1, 'utf8'), new Buffer(linkingKeyPriv));
                // console.log("signedMessage ", signedMessage)
                // const signedMessageDER = secp256k1.signatureExport(signedMessage)

                // elliptic
                console.log("k1: ", this.state.k1, Base64Utils.hexToUint8Array(this.state.k1))
                const signedMessage = ec.sign(Base64Utils.hexToUint8Array(this.state.k1), linkingKeyPriv);
                // var signature  = linkingKeyPair.sign(Base64Utils.hexToUint8Array(this.state.k1));
                console.log("signedMessage ", signedMessage)
                // console.log("signature ", signature)
                var signedMessageDER = signedMessage.toDER();

                console.log("signedMessage, signedMessageDER", signedMessage, signedMessageDER)

                // Verify signature
                console.log(linkingKeyPair.verify(Base64Utils.hexToUint8Array(this.state.k1), signedMessageDER));

                this.setState({ preparingSignature: false });
                this.setState({ signatureSuccess: true });

                this.sendValues(linkingKeyPub, Base64Utils.bytesToHexString(signedMessageDER));

            })
            .catch((error: any) => {
                // handle error
                this.setState({ preparingSignature: false });
                this.setState({ errorMsgAuth: error.toString() });
            });
    }
    componentDidMount() {
        this.triggerSign();
    }

    sendValues(linkingKeyPub: string, signedMessageDER: string) {
        console.log("sendvalues: ", linkingKeyPub, signedMessageDER);
        const { navigation, NodeInfoStore } = this.props;
        const { domain, k1 } = this.state;
        const lnurl = navigation.getParam('lnurlParams');
        const u = url.parse(lnurl.callback);
        const qs = querystring.parse(u.query);
        qs.key = linkingKeyPub;
        qs.sig = signedMessageDER;

        u.search = querystring.stringify(qs);
        u.query = querystring.stringify(qs);
        console.log("sending request: ", u);

        RNFetchBlob.fetch('get', url.format(u))
            .then((response: any) => {
                try {
                    console.log("response: ", response.text());
                    const data = response.json();
                    return data;
                } catch (err) {
                    this.setState({ signatureSuccess: false });
                    this.setState({ errorMsgAuth: response.text() });
                    return { status: 'ERROR', reason: response.text() };
                }
            })
            .catch((err: any) => ({
                status: 'ERROR',
                reason: err.message
            }))
            .then((data: any) => {
                if (data.status === 'ERROR') {
                    this.setState({ signatureSuccess: false });
                    this.setState({ errorMsgAuth: data.reason });
                    Alert.alert(
                        `[error] ${domain} says:`,
                        data.reason,
                        [{ text: 'OK', onPress: () => void 0 }],
                        { cancelable: false }
                    );
                    return;
                } else {
                    this.setState({ signatureSuccess: false });
                    this.setState({ lnurlAuthSuccess: true });
                }
            });
    }

    render() {
        const { SettingsStore, navigation } = this.props;
        const { domain, privateChannel } = this.state;
        const { settings } = SettingsStore;
        const { theme } = settings;
        const lnurl = navigation.getParam('lnurlParams');

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
                            disabled={!this.state.signatureSuccess}
                            buttonStyle={{
                                backgroundColor: 'orange',
                                borderRadius: 30
                            }}
                        />
                    </View>

                    <View style={styles.content}>
                        {this.state.preparingSignature && (
                            <ActivityIndicator size="large" color="#0000ff" />
                        )}
                        {this.state.lnurlAuthSuccess && (
                            <Text style={{ color: 'green' }}>
                                {localeString('views.LnurlAuth.loginSuccess')}
                            </Text>
                        )}
                        {!this.state.preparingSignature && !this.state.lnurlAuthSuccess && (
                                <Text style={{ color: 'red' }}>
                                    {this.state.errorMsgAuth ||
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
