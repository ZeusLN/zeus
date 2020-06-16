import * as React from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    View,
    ScrollView,
    ImageBackground,
    Dimensions,
    Image,
    TouchableHighlight
} from 'react-native';
import { Button, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import UrlUtils from './../utils/UrlUtils';

const Background = require('./../images/onboarding/background.jpg');

const btcPay = require('./../images/onboarding/BTCPay.png');
const nodl = require('./../images/onboarding/nodl.png');
const raspiBlitz = require('./../images/onboarding/RaspiBlitz.png');
const myNode = require('./../images/onboarding/myNode.png');

import SettingsStore from './../../stores/SettingsStore';

interface OnboardingProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface OnboardingState {
    index: number;
}

interface ButtonProps {
    title: string;
}

@inject('SettingsStore')
@observer
export default class Onboarding extends React.Component<
    OnboardingProps,
    OnboardingState
> {
    state = {
        index: 0
    };

    continue = () => {
        this.setState({
            index: this.state.index + 1
        });
        this.refs._scrollView.scrollTo(0);
    };

    goBack = () => {
        this.setState({
            index: this.state.index - 1
        });
        this.refs._scrollView.scrollTo(0);
    };

    skipOnboarding = () => {
        this.props.navigation.navigate('AddEditNode');
    };

    UNSAFE_componentWillReceiveProps(nextProps: any) {
        const { navigation } = nextProps;
        const reset = navigation.getParam('reset', null);

        if (reset) {
            this.setState({
                index: 0
            });
        }
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        let ScreenHeight = Dimensions.get('window').height;
        const { settings } = SettingsStore;
        const nodes = settings.nodes;
        const { index } = this.state;

        const image = Background;

        const nodeIndex: number = (nodes && nodes.length) || 0;

        const ContinueButton = (props: ButtonProps) => (
            <Button
                title={props.title || 'Continue'}
                buttonStyle={{
                    backgroundColor: 'navy',
                    borderRadius: 30,
                    width: 350,
                    alignSelf: 'center'
                }}
                titleStyle={{
                    color: 'white'
                }}
                onPress={() => this.continue()}
                style={styles.button}
            />
        );

        const BackButton = () => (
            <Button
                title={'Go Back'}
                buttonStyle={{
                    backgroundColor: 'grey',
                    borderRadius: 30,
                    width: 350,
                    alignSelf: 'center'
                }}
                titleStyle={{
                    color: 'white'
                }}
                onPress={() => this.goBack()}
                style={styles.button}
            />
        );

        const SkipTourButton = (props: ButtonProps) => (
            <Button
                title={props.title || 'Skip Tour'}
                buttonStyle={{
                    backgroundColor: 'green',
                    borderRadius: 30,
                    width: 350,
                    alignSelf: 'center'
                }}
                titleStyle={{
                    color: 'white'
                }}
                onPress={() => this.skipOnboarding()}
                style={styles.button}
            />
        );

        const ScanQRButton = () => (
            <Button
                title="Scan lndconnect QR"
                icon={{
                    name: 'crop-free',
                    size: 25,
                    color: 'white'
                }}
                onPress={() =>
                    navigation.navigate('LNDConnectConfigQRScanner', {
                        nodeIndex
                    })
                }
                buttonStyle={{
                    backgroundColor: 'black',
                    borderRadius: 30
                }}
                titleStyle={{
                    color: 'white'
                }}
                style={styles.button}
            />
        );

        const Welcome = () => (
            <View style={{ paddingTop: 240, padding: 8, height: ScreenHeight }}>
                <Text
                    style={{
                        fontSize: 40,
                        alignSelf: 'center',
                        fontWeight: 'bold'
                    }}
                >
                    Welcome to Zeus
                </Text>
                <Text
                    style={{
                        padding: 20,
                        fontSize: 20,
                        alignSelf: 'center'
                    }}
                >
                    The best way to connect to your lightning node on the go
                </Text>
                <ContinueButton title="Get started" />
                <ScanQRButton />
                <SkipTourButton />
            </View>
        );

        const Intro = () => (
            <View style={{ paddingTop: 40, padding: 8 }}>
                <Text
                    style={{
                        fontSize: 40,
                        alignSelf: 'center'
                    }}
                >
                    Full node control
                </Text>
                <Text
                    style={{
                        padding: 20,
                        fontSize: 18,
                        alignSelf: 'center'
                    }}
                >
                    Running a full node has a lot of great advantages. You have
                    full control of your lightning channels and verify your own
                    transactions without the help of any third party.
                </Text>
                <Text
                    style={{
                        paddingBottom: 20,
                        paddingRight: 20,
                        paddingLeft: 20,
                        fontSize: 18,
                        alignSelf: 'center'
                    }}
                >
                    Zeus gives you an interface to manage your channels, send
                    and receive bitcoin both on lightning and on-chain, and use
                    some of lightning's latest features.
                </Text>
                <Text
                    style={{
                        paddingBottom: 20,
                        paddingRight: 20,
                        paddingLeft: 20,
                        fontSize: 18,
                        alignSelf: 'center'
                    }}
                >
                    Zeus has support for connecting to lnd nodes and to
                    c-lightning nodes running the c-lightning-REST or Spark
                    interfaces.
                </Text>
                <Button
                    title="Connect to an lnd node"
                    onPress={() =>
                        navigation.navigate('AddEditNode', {
                            newEntry: true,
                            node: {
                                implementation: 'lnd'
                            },
                            index:
                                (nodes &&
                                    nodes.length &&
                                    Number(nodes.length)) ||
                                0
                        })
                    }
                    buttonStyle={{
                        backgroundColor: 'purple',
                        borderRadius: 30
                    }}
                    titleStyle={{
                        color: 'white'
                    }}
                    style={styles.button}
                />
                <Button
                    title="Connect to a c-lightning-REST node"
                    onPress={() =>
                        navigation.navigate('AddEditNode', {
                            newEntry: true,
                            node: {
                                implementation: 'c-lightning-REST'
                            },
                            index:
                                (nodes &&
                                    nodes.length &&
                                    Number(nodes.length)) ||
                                0
                        })
                    }
                    buttonStyle={{
                        borderRadius: 30
                    }}
                    titleStyle={{
                        color: 'white'
                    }}
                    style={styles.button}
                />
                <Button
                    title="Connect to a c-lightning Spark node"
                    onPress={() =>
                        navigation.navigate('AddEditNode', {
                            newEntry: true,
                            node: {
                                implementation: 'spark'
                            },
                            index:
                                (nodes &&
                                    nodes.length &&
                                    Number(nodes.length)) ||
                                0
                        })
                    }
                    buttonStyle={{
                        borderRadius: 30
                    }}
                    titleStyle={{
                        color: 'white'
                    }}
                    style={styles.button}
                />
                <ScanQRButton />
                <Text
                    style={{
                        fontSize: 40,
                        paddingTop: 20,
                        alignSelf: 'center'
                    }}
                >
                    No node?
                </Text>
                <Text
                    style={{
                        padding: 20,
                        fontSize: 18,
                        alignSelf: 'center'
                    }}
                >
                    LNDHub is a custodial solution for lightning. You use the
                    admin's channels so you don't have to worry about managing
                    them yourself. You'll be able to pay and create lightning
                    interfaces without having a node of your own.
                </Text>
                <Text
                    style={{
                        paddingBottom: 20,
                        paddingRight: 20,
                        paddingLeft: 20,
                        fontSize: 18,
                        alignSelf: 'center'
                    }}
                >
                    There are trade-offs though: you won't be able to send
                    payments on-chain, and the administrator of the LNDHub
                    instance will have full control of your funds and records of
                    your transactions. Not your keys, not your coins.
                </Text>
                <Text
                    style={{
                        paddingBottom: 20,
                        paddingRight: 20,
                        paddingLeft: 20,
                        fontSize: 18,
                        alignSelf: 'center'
                    }}
                >
                    You can connect to the public instance or find a friend you
                    trust with a LNDHub enabled node. Consider being the Uncle
                    Jim in your family and setting up LNDHub on your lnd node.
                </Text>
                <Button
                    title="Connect to an LNDHub instance"
                    onPress={() =>
                        navigation.navigate('AddEditNode', {
                            newEntry: true,
                            node: {
                                implementation: 'lndhub',
                                lndhubUrl: 'lndhub.herokuapp.com',
                                sslVerification: true
                            },
                            index:
                                (nodes &&
                                    nodes.length &&
                                    Number(nodes.length)) ||
                                0
                        })
                    }
                    buttonStyle={{
                        backgroundColor: 'lightblue',
                        borderRadius: 30
                    }}
                    titleStyle={{
                        color: 'white'
                    }}
                    style={styles.button}
                />
                <ContinueButton title="See integrations" />
                <BackButton />
                <SkipTourButton />
            </View>
        );

        const Integrations = () => (
            <View style={{ paddingTop: 100, padding: 8 }}>
                <Text
                    style={{
                        fontSize: 40,
                        alignSelf: 'center',
                        fontWeight: 'bold'
                    }}
                >
                    Need a node?
                </Text>
                <Text
                    style={{
                        padding: 15,
                        fontSize: 20,
                        alignSelf: 'center'
                    }}
                >
                    Zeus is proudly integrated on the following node platforms:
                </Text>
                <TouchableHighlight
                    onPress={() => UrlUtils.goToUrl('https://raspiblitz.com/')}
                >
                    <Image
                        style={{
                            alignSelf: 'center',
                            height: 50,
                            width: 300,
                            margin: 20
                        }}
                        source={raspiBlitz}
                    />
                </TouchableHighlight>
                <TouchableHighlight
                    onPress={() => UrlUtils.goToUrl('https://nodl.it/')}
                >
                    <Image
                        style={{
                            alignSelf: 'center',
                            height: 190,
                            width: 200,
                            marginBottom: 20
                        }}
                        source={nodl}
                    />
                </TouchableHighlight>
                <TouchableHighlight
                    onPress={() => UrlUtils.goToUrl('https://mynodebtc.com/')}
                >
                    <Image
                        style={{
                            alignSelf: 'center',
                            height: 75,
                            width: 300,
                            margin: 20
                        }}
                        source={myNode}
                    />
                </TouchableHighlight>
                <TouchableHighlight
                    onPress={() =>
                        UrlUtils.goToUrl('https://btcpayserver.org/')
                    }
                >
                    <Image
                        style={{
                            alignSelf: 'center',
                            height: 100,
                            width: 180,
                            margin: 20
                        }}
                        source={btcPay}
                    />
                </TouchableHighlight>
                <BackButton />
                <SkipTourButton title="Complete tour" />
            </View>
        );

        return (
            <ScrollView style={styles.onboardingStyle} ref="_scrollView">
                <ImageBackground source={image} style={styles.backgroundImage}>
                    {index == 0 && <Welcome />}
                    {index == 1 && <Intro />}
                    {index == 2 && <Integrations />}
                </ImageBackground>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    onboardingStyle: {
        flex: 1,
        backgroundColor: 'white'
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10
    },
    backgroundImage: {
        flex: 1,
        resizeMode: 'cover',
        justifyContent: 'center'
    },
    integrationImage: {
        width: 200,
        height: 200,
        alignSelf: 'center'
    }
});
