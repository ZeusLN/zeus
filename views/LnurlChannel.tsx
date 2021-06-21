import * as React from 'react';
import RNFetchBlob from 'rn-fetch-blob';
import { Alert, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, Header, Icon, CheckBox } from 'react-native-elements';
import DropdownSetting from './../components/DropdownSetting';
import querystring from 'querystring-es3';
import url from 'url';
// import InvoicesStore from './../stores/InvoicesStore';
// import LnurlPayStore from './../stores/LnurlPayStore';
import SettingsStore from './../stores/SettingsStore';
import ChannelsStore from './../stores/ChannelsStore';
import NodeInfoStore from './../stores/NodeInfoStore';

// import LnurlPayMetadata from './Metadata';
import { localeString } from './../utils/LocaleUtils';
import NodeUriUtils from './../utils/NodeUriUtils';
import RESTUtils from './../utils/RESTUtils';

interface LnurlChannelProps {
    navigation: any;
    SettingsStore: SettingsStore;
    ChannelsStore: ChannelsStore;
    NodeInfoStore: NodeInfoStore;
}

interface LnurlChannelState {
    domain: string;
    private: boolean;
    node_pubkey_string: string;
    host: string;
    k1: string;
    connectingToPeer: boolean;
    peerSuccess: boolean;
    lnurlChannelSuccess: boolean;
    errorMsgPeer: string;
}

@inject('SettingsStore', 'ChannelsStore', 'NodeInfoStore')
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
                private: false,
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
        console.log("lnurl: ", lnurl);

        const { pubkey, host } = NodeUriUtils.processNodeUri(
            lnurl.uri
        );
        return {
            uri: lnurl.uri,
            domain: lnurl.domain,
            node_pubkey_string: pubkey,
            host: host,
            k1: lnurl.k1,
            localnodeids: [],
            localnodeid: '',
            connectingToPeer: false,
            peerSuccess: false,
            lnurlChannelSuccess: false,
            errorMsgPeer: 'Error'
        };
    }

    triggerConnect() {
        const { node_pubkey_string, host } = this.state;
        // console.log("triggerConnect to peer: ", node_pubkey_string, host);

        this.setState({ connectingToPeer: true })

        RESTUtils.connectPeer({
            addr: {
                pubkey: node_pubkey_string,
                host: host
            }
        })
        .then(() => {
            console.log("connectpeer OK");
            this.setState({ connectingToPeer: false })
            this.setState({ peerSuccess: true })
        })
        .catch((error: any) => {
            console.log("connectpeer Error ", error.toString());
            // handle error
            if (
                this.state.errorMsgPeer &&
                this.state.errorMsgPeer.includes('already')
            ) {
                this.setState({ peerSuccess: true })
            }

            this.setState({ connectingToPeer: false })
            console.log("set this.state.errorMsgPeer to ", error.toString());
            this.setState({ errorMsgPeer: error.toString() })
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
        qs.private = this.state.private ? 1 : 0;

        const { nodeInfo } = NodeInfoStore;
        const nodeids = nodeInfo.getURIs;
        const localnodeid = nodeids[0];
        const { pubkey, host } = NodeUriUtils.processNodeUri(
            localnodeid
        );

        qs.remoteid = pubkey;
        u.search = querystring.stringify(qs);
        u.query = querystring.stringify(qs);
        // <callback>?k1=<k1>&remoteid=<Local LN node ID>&private=<1/0>
        console.log("u: ", u)

        RNFetchBlob.fetch('get', url.format(u))
            .then((response: any) => {
                try {
                    const data = response.json();
                    console.log("response data: ", data);
                    return data;
                } catch (err) {
                    this.setState({ peerSuccess: false })
                    this.setState({ errorMsgPeer: response.text() })
                    return { status: 'ERROR', reason: response.text() };
                }
            })
            .catch((err: any) => ({
                status: 'ERROR',
                reason: err.message
            }))
            .then((data: any) => {
                if (data.status === 'ERROR') {
                    this.setState({ peerSuccess: false })
                    this.setState({ errorMsgPeer: data.reason })
                    Alert.alert(
                        `[error] ${domain} says:`,
                        data.reason,
                        [{ text: 'OK', onPress: () => void 0 }],
                        { cancelable: false }
                    );
                    return;
                } else {
                    this.setState({ peerSuccess: false })
                    this.setState({ lnurlChannelSuccess: true })
                }
            });
    }

    render() {
        const { SettingsStore, navigation, NodeInfoStore } = this.props;
        const { domain, privateChannel } = this.state;
        const { settings } = SettingsStore;
        const { theme } = settings;
        const lnurl = navigation.getParam('lnurlParams');
        // console.log("connectingToPeer: ", this.state.connectingToPeer, this.state.errorMsgPeer);

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
                    centerComponent={{ text: 'Incoming Channel', style: { color: '#fff' } }}
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
                    <Text
                        style={{
                            color: theme === 'dark' ? 'white' : 'black'
                        }}
                    >
                        {localeString('views.LnurlChannel.uri')}
                        {':'}
                    </Text>
                    <Text
                        style={{
                            color: theme === 'dark' ? 'white' : 'black'
                        }}
                    >
                        {lnurl.uri}
                    </Text>

                    <View style={{ padding: 10 }}>
                        <CheckBox
                            title={localeString('views.OpenChannel.private')}
                            checked={privateChannel}
                            onPress={() =>
                                this.setState({ private: !privateChannel })
                            }
                        />
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
                        {(this.state.connectingToPeer) && (
                            <ActivityIndicator size="large" color="#0000ff" />
                        )}
                        {(this.state.peerSuccess) && (
                            <Text style={{ color: 'green' }}>
                                {localeString('views.OpenChannel.peerSuccess')}
                            </Text>
                        )}
                        {(this.state.lnurlChannelSuccess) && (
                            <Text style={{ color: 'green' }}>
                                {localeString('views.LnurlChannel.success')}
                            </Text>
                        )}
                        {(this.state.errorMsgPeer && !this.state.peerSuccess && !this.state.lnurlChannelSuccess) && (
                            <Text style={{ color: 'red' }}>
                                {this.state.errorMsgChannel ||
                                    this.state.errorMsgPeer ||
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
