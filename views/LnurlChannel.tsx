import url from 'url';
import * as React from 'react';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import querystring from 'querystring-es3';

import Button from '../components/Button';
import Header from '../components/Header';
import LightningIndicator from '../components/LightningIndicator';
import Screen from '../components/Screen';
import {
    SuccessMessage,
    ErrorMessage
} from '../components/SuccessErrorMessage';

import ChannelsStore from '../stores/ChannelsStore';
import NodeInfoStore from '../stores/NodeInfoStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import NodeUriUtils from '../utils/NodeUriUtils';
import BackendUtils from '../utils/BackendUtils';

interface LnurlChannelProps {
    navigation: any;
    ChannelsStore: ChannelsStore;
    NodeInfoStore: NodeInfoStore;
}

interface LnurlChannelState {
    domain: string;
    privateChannel: boolean;
    node_pubkey_string: string;
    host: string;
    k1: string;
    connectingToPeer: boolean;
    peerSuccess: boolean;
    lnurlChannelSuccess: boolean;
    errorMsgPeer: string;
}

@inject('ChannelsStore', 'NodeInfoStore')
@observer
export default class LnurlChannel extends React.Component<
    LnurlChannelProps,
    LnurlChannelState
> {
    constructor(props: LnurlChannelProps) {
        super(props);

        try {
            this.state = this.stateFromProps(props);
        } catch (err) {
            this.state = {
                domain: '',
                privateChannel: false,
                node_pubkey_string: '',
                host: '',
                k1: '',
                connectingToPeer: false,
                peerSuccess: false,
                lnurlChannelSuccess: false,
                errorMsgPeer: ''
            };

            Alert.alert(
                localeString('views.LnurlPay.LnurlPay.invalidParams'),
                err.message,
                [{ text: localeString('general.ok'), onPress: () => void 0 }],
                { cancelable: false }
            );
        }
    }

    stateFromProps(props: LnurlChannelProps) {
        const { navigation } = props;
        const lnurl = navigation.getParam('lnurlParams');

        const { pubkey, host } = NodeUriUtils.processNodeUri(lnurl.uri);
        return {
            uri: lnurl.uri,
            domain: lnurl.domain,
            node_pubkey_string: pubkey,
            host,
            k1: lnurl.k1,
            localnodeids: [],
            localnodeid: '',
            privateChannel: false,
            connectingToPeer: false,
            peerSuccess: false,
            lnurlChannelSuccess: false,
            errorMsgPeer: 'Error'
        };
    }

    triggerConnect() {
        const { node_pubkey_string, host } = this.state;
        this.setState({ connectingToPeer: true });

        BackendUtils.connectPeer({
            addr: {
                pubkey: node_pubkey_string,
                host
            }
        })
            .then(() => {
                this.setState({ connectingToPeer: false });
                this.setState({ peerSuccess: true });
            })
            .catch((error: any) => {
                // handle error
                this.setState({ connectingToPeer: false });
                this.setState({ errorMsgPeer: error.toString() });

                if (
                    this.state.errorMsgPeer &&
                    this.state.errorMsgPeer.includes('already')
                ) {
                    this.setState({ peerSuccess: true });
                }
            });
    }
    componentDidMount() {
        this.triggerConnect();
    }

    sendValues() {
        const { navigation, NodeInfoStore } = this.props;
        const { domain, k1 } = this.state;
        const lnurl = navigation.getParam('lnurlParams');
        const u = url.parse(lnurl.callback);
        const qs = querystring.parse(u.query);
        qs.k1 = k1;
        qs.private = this.state.privateChannel ? 1 : 0;

        const { nodeInfo } = NodeInfoStore;
        const pubkey = nodeInfo.getPubkey;

        qs.remoteid = pubkey;
        u.search = querystring.stringify(qs);
        u.query = querystring.stringify(qs);

        ReactNativeBlobUtil.fetch('get', url.format(u))
            .then((response: any) => {
                try {
                    const data = response.json();
                    return data;
                } catch (err) {
                    this.setState({ peerSuccess: false });
                    this.setState({ errorMsgPeer: response.text() });
                    return { status: 'ERROR', reason: response.text() };
                }
            })
            .catch((err: any) => ({
                status: 'ERROR',
                reason: err.message
            }))
            .then((data: any) => {
                if (data.status === 'ERROR') {
                    this.setState({ peerSuccess: false });
                    this.setState({ errorMsgPeer: data.reason });
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
                    this.setState({ peerSuccess: false });
                    this.setState({ lnurlChannelSuccess: true });
                }
            });
    }

    render() {
        const { navigation } = this.props;
        const {
            domain,
            privateChannel,
            peerSuccess,
            lnurlChannelSuccess,
            errorMsgPeer
        } = this.state;
        const lnurl = navigation.getParam('lnurlParams');

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.LnurlChannel.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={styles.content}>
                    <Text
                        style={{
                            padding: 20,
                            fontSize: 22,
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Medium'
                        }}
                    >
                        {domain}
                    </Text>
                </View>
                <View style={styles.content}>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    >
                        {localeString('views.LnurlChannel.uri')}
                        {':'}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    >
                        {lnurl.uri}
                    </Text>

                    <View style={{ padding: 10 }}>
                        <>
                            <Text
                                style={{
                                    top: 10,
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString('views.OpenChannel.private')}
                            </Text>
                            <Switch
                                value={privateChannel}
                                onValueChange={() =>
                                    this.setState({
                                        privateChannel: !privateChannel
                                    })
                                }
                                trackColor={{
                                    false: '#767577',
                                    true: themeColor('highlight')
                                }}
                                style={{
                                    alignSelf: 'flex-end'
                                }}
                            />
                        </>
                    </View>
                    <View style={styles.button}>
                        <Button
                            title={localeString('views.LnurlChannel.connect')}
                            icon={{
                                name: 'send',
                                size: 25,
                                color: themeColor('background')
                            }}
                            onPress={() => {
                                this.sendValues();
                            }}
                            disabled={!peerSuccess}
                        />
                    </View>

                    <View style={styles.content}>
                        {this.state.connectingToPeer && <LightningIndicator />}
                        {peerSuccess && (
                            <SuccessMessage
                                message={localeString(
                                    'views.OpenChannel.peerSuccess'
                                )}
                            />
                        )}
                        {lnurlChannelSuccess && (
                            <SuccessMessage
                                message={localeString(
                                    'views.LnurlChannel.success'
                                )}
                            />
                        )}
                        {errorMsgPeer &&
                            !peerSuccess &&
                            !lnurlChannelSuccess && (
                                <ErrorMessage
                                    message={
                                        errorMsgPeer ||
                                        localeString('general.error')
                                    }
                                />
                            )}
                    </View>
                </View>
            </Screen>
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
