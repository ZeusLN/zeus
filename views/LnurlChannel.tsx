import url from 'url';
import * as React from 'react';
import RNFetchBlob from 'rn-fetch-blob';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, Header, Icon } from 'react-native-elements';
import querystring from 'querystring-es3';

import LoadingIndicator from './../components/LoadingIndicator';

import ChannelsStore from './../stores/ChannelsStore';
import NodeInfoStore from './../stores/NodeInfoStore';

import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';
import NodeUriUtils from './../utils/NodeUriUtils';
import RESTUtils from './../utils/RESTUtils';

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
                [{ text: 'OK', onPress: () => void 0 }],
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

        RESTUtils.connectPeer({
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
        const nodeids = nodeInfo.getURIs;
        const localnodeid = nodeids[0];
        const { pubkey } = NodeUriUtils.processNodeUri(localnodeid);

        qs.remoteid = pubkey;
        u.search = querystring.stringify(qs);
        u.query = querystring.stringify(qs);

        RNFetchBlob.fetch('get', url.format(u))
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
                        [{ text: 'OK', onPress: () => void 0 }],
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
        const { domain, privateChannel } = this.state;
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
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: 'Incoming Channel',
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
                            color: themeColor('text')
                        }}
                    >
                        {domain}
                    </Text>
                </View>
                <View style={styles.content}>
                    <Text style={{ color: themeColor('text') }}>
                        {localeString('views.LnurlChannel.uri')}
                        {':'}
                    </Text>
                    <Text style={{ color: themeColor('text') }}>
                        {lnurl.uri}
                    </Text>

                    <View style={{ padding: 10 }}>
                        <>
                            <Text
                                style={{
                                    top: 10,
                                    color: themeColor('secondaryText')
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
                            title="Connect"
                            icon={{
                                name: 'send',
                                size: 25,
                                color: 'white'
                            }}
                            onPress={() => {
                                this.sendValues();
                            }}
                            style={styles.button}
                            disabled={!this.state.peerSuccess}
                            buttonStyle={{
                                backgroundColor: 'orange',
                                borderRadius: 30
                            }}
                        />
                    </View>

                    <View style={styles.content}>
                        {this.state.connectingToPeer && <LoadingIndicator />}
                        {this.state.peerSuccess && (
                            <Text style={{ color: 'green' }}>
                                {localeString('views.OpenChannel.peerSuccess')}
                            </Text>
                        )}
                        {this.state.lnurlChannelSuccess && (
                            <Text style={{ color: 'green' }}>
                                {localeString('views.LnurlChannel.success')}
                            </Text>
                        )}
                        {this.state.errorMsgPeer &&
                            !this.state.peerSuccess &&
                            !this.state.lnurlChannelSuccess && (
                                <Text style={{ color: 'red' }}>
                                    {this.state.errorMsgPeer ||
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
