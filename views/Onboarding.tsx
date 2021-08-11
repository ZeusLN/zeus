import * as React from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    ImageBackground,
    Dimensions,
    Image,
    TouchableHighlight
} from 'react-native';
import { Button } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import UrlUtils from './../utils/UrlUtils';
import { DEFAULT_LNDHUB } from './../utils/AddressUtils';
import DropdownSetting from './../components/DropdownSetting';
import SettingsStore, {
    DEFAULT_LOCALE,
    LOCALE_KEYS
} from './../stores/SettingsStore';
import { localeString } from './../utils/LocaleUtils';

const Background = require('./../images/onboarding/background.jpg');

const btcPay = require('./../images/onboarding/BTCPay.png');
const nodl = require('./../images/onboarding/nodl.png');
const raspiBlitz = require('./../images/onboarding/RaspiBlitz.png');
const myNode = require('./../images/onboarding/myNode.png');

interface OnboardingProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface OnboardingState {
    index: number;
}

interface ButtonProps {
    title?: string;
}

@inject('SettingsStore')
@observer
export default class Onboarding extends React.Component<
    OnboardingProps,
    OnboardingState
> {
    refs: any;

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
        const { settings, changeLocale } = SettingsStore;
        const { nodes, locale } = settings;
        const { index } = this.state;

        const image = Background;

        const nodeIndex: number = (nodes && nodes.length) || 0;

        const ContinueButton = (props: ButtonProps) => (
            <View style={styles.button}>
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
                />
            </View>
        );

        const BackButton = () => (
            <View style={styles.button}>
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
                />
            </View>
        );

        const SkipTourButton = (props: ButtonProps) => (
            <View style={styles.button}>
                <Button
                    title={
                        props.title || localeString('views.Onboarding.skipTour')
                    }
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
                />
            </View>
        );

        const ScanQRButton = () => (
            <View style={styles.button}>
                <Button
                    title={localeString(
                        'views.Settings.AddEditNode.scanLndconnect'
                    )}
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
                />
            </View>
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
                    {localeString('views.Onboarding.welcome')}
                </Text>
                <Text
                    style={{
                        padding: 20,
                        fontSize: 20,
                        alignSelf: 'center'
                    }}
                >
                    {localeString('views.Onboarding.tagline')}
                </Text>
                <ContinueButton title="Get started" />
                <ScanQRButton />
                <SkipTourButton />
                <View style={{ alignItems: 'center', top: 25 }}>
                    <DropdownSetting
                        title={localeString('views.Settings.locale')}
                        selectedValue={locale || DEFAULT_LOCALE}
                        onValueChange={(value: string) => changeLocale(value)}
                        values={LOCALE_KEYS}
                    />
                </View>
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
                    {localeString('views.Onboarding.fullNodeTitle')}
                </Text>
                <Text style={styles.leadingGraph}>
                    {localeString('views.Onboarding.fullNodeGraph1')}
                </Text>
                <Text style={styles.defaultGraph}>
                    {localeString('views.Onboarding.fullNodeGraph2')}
                </Text>
                <Text style={styles.defaultGraph}>
                    {localeString('views.Onboarding.fullNodeGraph3')}
                </Text>
                <Text style={styles.defaultGraph}>
                    {localeString('views.Onboarding.fullNodeGraph4')}
                </Text>
                <View style={styles.button}>
                    <Button
                        title={localeString('views.Onboarding.connect1')}
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
                    />
                </View>
                <View style={styles.button}>
                    <Button
                        title={localeString('views.Onboarding.connect2')}
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
                    />
                </View>
                <View style={styles.button}>
                    <Button
                        title={localeString('views.Onboarding.connect3')}
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
                    />
                </View>
                <View style={styles.button}>
                    <Button
                        title="Connect to an Eclair node"
                        onPress={() =>
                            navigation.navigate('AddEditNode', {
                                newEntry: true,
                                node: {
                                    implementation: 'eclair'
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
                    />
                </View>
                <ScanQRButton />

                <View style={{ padding: 20 }} />

                <ContinueButton
                    title={localeString('views.Onboarding.noNode')}
                />
                <BackButton />
                <SkipTourButton />
            </View>
        );
        const LNDHub = () => (
            <View>
                <Text
                    style={{
                        fontSize: 40,
                        paddingTop: 60,
                        alignSelf: 'center'
                    }}
                >
                    {localeString('views.Onboarding.noNodeTitle')}
                </Text>
                <Text style={styles.leadingGraph}>
                    {localeString('views.Onboarding.noNodeGraph1')}
                </Text>
                <Text style={styles.defaultGraph}>
                    {localeString('views.Onboarding.noNodeGraph2')}
                </Text>
                <Text style={styles.defaultGraph}>
                    {localeString('views.Onboarding.noNodeGraph3')}
                </Text>
                <View style={styles.button}>
                    <Button
                        title={localeString('views.Onboarding.connect4')}
                        onPress={() =>
                            navigation.navigate('AddEditNode', {
                                newEntry: true,
                                node: {
                                    implementation: 'lndhub',
                                    lndhubUrl: DEFAULT_LNDHUB,
                                    certVerification: true
                                },
                                index:
                                    (nodes &&
                                        nodes.length &&
                                        Number(nodes.length)) ||
                                    0
                            })
                        }
                        buttonStyle={{
                            borderRadius: 30,
                            backgroundColor: 'lightblue'
                        }}
                        titleStyle={{
                            color: 'white'
                        }}
                    />
                </View>
                <ContinueButton
                    title={localeString('views.Onboarding.seeIntegrations')}
                />
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
                    {localeString('views.Onboarding.needANode')}
                </Text>
                <Text
                    style={{
                        padding: 15,
                        fontSize: 20,
                        alignSelf: 'center'
                    }}
                >
                    {localeString('views.Onboarding.integratedOn')}
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
                <SkipTourButton
                    title={localeString('views.Onboarding.completeTour')}
                />
                <BackButton />
            </View>
        );

        return (
            <ScrollView style={styles.onboardingStyle} ref="_scrollView">
                <ImageBackground source={image} style={styles.backgroundImage}>
                    {index == 0 && <Welcome />}
                    {index == 1 && <Intro />}
                    {index == 2 && <LNDHub />}
                    {index == 3 && <Integrations />}
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
        paddingBottom: 10,
        width: 350,
        alignSelf: 'center'
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
    },
    leadingGraph: {
        padding: 20,
        fontSize: 18,
        alignSelf: 'center'
    },
    defaultGraph: {
        paddingBottom: 20,
        paddingRight: 20,
        paddingLeft: 20,
        fontSize: 18,
        alignSelf: 'center'
    }
});
