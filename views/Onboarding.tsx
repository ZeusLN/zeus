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
    };

    goBack = () => {
        this.setState({
            index: this.state.index - 1
        });
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
        const { index } = this.state;

        const image = Background;

        const nodeIndex: number =
            (settings.nodes && settings.nodes.length) || 0;

        const ContinueButton = () => (
            <Button
                title={'Continue'}
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
                    backgroundColor: 'maroon',
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

        const SkipOnboardingButton = () => (
            <Button
                title={'Skip Onboarding'}
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
                title="Scan lndconnect"
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
                <ContinueButton />
                <Button
                    title="Connect to an lnd node"
                    onPress={() =>
                        navigation.navigate('LNDConnectConfigQRScanner', {
                            nodeIndex
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
                        navigation.navigate('LNDConnectConfigQRScanner', {
                            nodeIndex
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
                        navigation.navigate('LNDConnectConfigQRScanner', {
                            nodeIndex
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
                    title="Connect to an LNDHub instance"
                    onPress={() =>
                        navigation.navigate('LNDConnectConfigQRScanner', {
                            nodeIndex
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
                <ScanQRButton />
                <SkipOnboardingButton />
            </View>
        );

        const Intro = () => (
            <View style={{ paddingTop: 240, padding: 8, height: ScreenHeight }}>
                <Text
                    style={{
                        fontSize: 40,
                        alignSelf: 'center'
                    }}
                >
                    Features
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
                <ContinueButton />
                <ScanQRButton />
                <BackButton />
                <SkipOnboardingButton />
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
                <ContinueButton />
                <BackButton />
                <SkipOnboardingButton />
            </View>
        );

        const Alternatives = () => (
            <View style={{ paddingTop: 240, padding: 8, height: ScreenHeight }}>
                <Text
                    style={{
                        fontSize: 40,
                        padding: 20,
                        alignSelf: 'center'
                    }}
                >
                    Alternative ways to run a node
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
                <SkipOnboardingButton />
            </View>
        );

        return (
            <ScrollView style={styles.onboardingStyle}>
                <ImageBackground source={image} style={styles.backgroundImage}>
                    {index == 0 && <Welcome />}
                    {index == 1 && <Intro />}
                    {index == 2 && <Integrations />}
                    {index == 3 && <Alternatives />}
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
