import * as React from 'react';
import {
    BackHandler,
    Dimensions,
    NativeEventSubscription,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../../components/Button';
import CopyBox from '../../../components/CopyBox';
import LoadingIndicator from '../../../components/LoadingIndicator';
import Screen from '../../../components/Screen';
import SuccessAnimation from '../../../components/SuccessAnimation';

import { localeString } from '../../../utils/LocaleUtils';
import { SpliceDirection } from '../../../utils/SpliceUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import UrlUtils from '../../../utils/UrlUtils';

import NodeInfoStore from '../../../stores/NodeInfoStore';
import SpliceStore from '../../../stores/SpliceStore';

import ErrorIcon from '../../../assets/images/SVG/ErrorIcon.svg';
import Hourglass from '../../../assets/images/SVG/Hourglass.svg';
import Wordmark from '../../../assets/images/SVG/wordmark-black.svg';

interface SplicingProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<'Splicing', { direction: SpliceDirection }>;
    NodeInfoStore: NodeInfoStore;
    SpliceStore: SpliceStore;
}

type SplicingState = 'inFlight' | 'broadcast' | 'requested' | 'error';

@inject('NodeInfoStore', 'SpliceStore')
@observer
export default class Splicing extends React.Component<SplicingProps, {}> {
    private backPressSubscription: NativeEventSubscription;

    componentDidMount() {
        this.backPressSubscription = BackHandler.addEventListener(
            'hardwareBackPress',
            this.handleBackPress
        );
    }

    componentWillUnmount() {
        this.backPressSubscription?.remove();
    }

    private getSplicingState = (): SplicingState => {
        const { spliceError, spliceSuccess, spliceTxid } =
            this.props.SpliceStore;
        if (spliceError) return 'error';
        if (spliceSuccess) return spliceTxid ? 'broadcast' : 'requested';
        return 'inFlight';
    };

    // Leaving mid-negotiation would let the same splice be confirmed again,
    // which the node refuses while one is already running on the channel
    private handleBackPress = (): boolean => {
        const { navigation } = this.props;
        const state = this.getSplicingState();
        if (state === 'error') {
            navigation.goBack();
        } else if (state !== 'inFlight') {
            navigation.popTo('Wallet');
        }
        return true;
    };

    render() {
        const { NodeInfoStore, SpliceStore, navigation, route } = this.props;
        const { spliceTxid, spliceError, spliceErrorDetail } = SpliceStore;
        const { testnet } = NodeInfoStore;
        const direction = route.params?.direction;
        const state = this.getSplicingState();
        const windowSize = Dimensions.get('window');

        if (state === 'inFlight') {
            return (
                <Screen>
                    <View style={styles.inFlight}>
                        <LoadingIndicator size={windowSize.height / 24} />
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('text'),
                                paddingTop: 30,
                                fontSize:
                                    windowSize.width * windowSize.scale * 0.014
                            }}
                        >
                            {direction === 'out'
                                ? localeString('views.Splice.splicingOut')
                                : localeString('views.Splice.splicingIn')}
                        </Text>
                        <Text
                            style={{
                                ...styles.text,
                                ...styles.info,
                                color: themeColor('secondaryText'),
                                // paddingBottom for centering
                                paddingBottom: windowSize.height / 10
                            }}
                        >
                            {localeString('views.Splice.negotiating')}
                        </Text>
                    </View>
                </Screen>
            );
        }

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <View
                        style={{
                            ...styles.content,
                            paddingTop: windowSize.height * 0.05
                        }}
                    >
                        {state === 'broadcast' && (
                            <>
                                <Wordmark
                                    height={windowSize.width * 0.25}
                                    width={windowSize.width}
                                    fill={themeColor('highlight')}
                                />
                                <View style={{ alignItems: 'center' }}>
                                    <SuccessAnimation />
                                    <Text
                                        style={{
                                            ...styles.text,
                                            ...styles.title,
                                            color: themeColor('text'),
                                            paddingTop:
                                                windowSize.height * 0.03,
                                            fontSize:
                                                windowSize.width *
                                                windowSize.scale *
                                                0.017
                                        }}
                                    >
                                        {localeString('views.Splice.broadcast')}
                                    </Text>
                                    <Text
                                        style={{
                                            ...styles.text,
                                            ...styles.info,
                                            color: themeColor('secondaryText')
                                        }}
                                    >
                                        {localeString(
                                            'views.Splice.broadcastInfo'
                                        )}
                                    </Text>
                                </View>
                            </>
                        )}
                        {state === 'requested' && (
                            <View style={{ alignItems: 'center' }}>
                                <Hourglass
                                    fill={themeColor('highlight')}
                                    width={windowSize.height * 0.1}
                                    height={windowSize.height * 0.1}
                                />
                                <Text
                                    style={{
                                        ...styles.text,
                                        ...styles.title,
                                        color: themeColor('text'),
                                        paddingTop: windowSize.height * 0.05,
                                        fontSize:
                                            windowSize.width *
                                            windowSize.scale *
                                            0.017
                                    }}
                                >
                                    {localeString('views.Splice.requested')}
                                </Text>
                                <Text
                                    style={{
                                        ...styles.text,
                                        ...styles.info,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString('views.Splice.requestedInfo')}
                                </Text>
                            </View>
                        )}
                        {state === 'error' && (
                            <View style={{ alignItems: 'center' }}>
                                <ErrorIcon
                                    width={windowSize.height * 0.13}
                                    height={windowSize.height * 0.13}
                                />
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('warning'),
                                        fontSize: 32,
                                        margin: 15,
                                        marginTop: windowSize.height * 0.07
                                    }}
                                >
                                    {localeString('general.error')}
                                </Text>
                                <Text
                                    style={{
                                        ...styles.text,
                                        ...styles.info,
                                        color: themeColor('text'),
                                        fontSize:
                                            windowSize.width *
                                            windowSize.scale *
                                            0.014
                                    }}
                                >
                                    {spliceError}
                                </Text>
                                {spliceErrorDetail && (
                                    <Text
                                        style={{
                                            ...styles.text,
                                            ...styles.info,
                                            color: themeColor('secondaryText'),
                                            fontSize: 12
                                        }}
                                    >
                                        {spliceErrorDetail}
                                    </Text>
                                )}
                            </View>
                        )}
                        {state === 'broadcast' && spliceTxid && (
                            <View style={{ width: '90%' }}>
                                <CopyBox
                                    heading={localeString(
                                        'views.SendingOnChain.txid'
                                    )}
                                    headingCopied={`${localeString(
                                        'views.SendingOnChain.txid'
                                    )} ${localeString(
                                        'components.ExternalLinkModal.copied'
                                    )}`}
                                    URL={spliceTxid}
                                    theme="dark"
                                />
                            </View>
                        )}
                    </View>

                    <View style={styles.buttons}>
                        {state === 'broadcast' && spliceTxid && (
                            <Button
                                title={localeString(
                                    'views.SendingOnChain.goToBlockExplorer'
                                )}
                                onPress={() =>
                                    UrlUtils.goToBlockExplorerTXID(
                                        spliceTxid,
                                        testnet
                                    )
                                }
                                containerStyle={{ width: '100%' }}
                                secondary
                                icon={{
                                    name: 'exit-to-app',
                                    size: 25
                                }}
                                buttonStyle={{ height: 40 }}
                            />
                        )}
                        {state === 'error' && (
                            <Button
                                title={localeString(
                                    'views.SendingLightning.tryAgain'
                                )}
                                icon={{
                                    name: 'rotate-ccw',
                                    type: 'feather',
                                    size: 25
                                }}
                                onPress={() => navigation.goBack()}
                                containerStyle={{ width: '100%' }}
                                buttonStyle={{ height: 40 }}
                            />
                        )}
                        <Button
                            title={localeString(
                                'views.SendingLightning.goToWallet'
                            )}
                            icon={{
                                name: 'list',
                                size: 25,
                                color: themeColor('background')
                            }}
                            titleStyle={{
                                color: themeColor('background')
                            }}
                            onPress={() => navigation.popTo('Wallet')}
                            containerStyle={{ width: '100%' }}
                            buttonStyle={{ height: 40 }}
                        />
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    title: {
        alignSelf: 'center',
        textAlign: 'center'
    },
    info: {
        textAlign: 'center',
        paddingTop: 15,
        paddingHorizontal: 30
    },
    inFlight: {
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-evenly',
        height: '100%'
    },
    buttons: {
        justifyContent: 'flex-end',
        width: '100%',
        gap: 15,
        bottom: 15
    }
});
