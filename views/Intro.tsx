import React, { useState, useRef } from 'react';
import { Dimensions, Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import Carousel, {
    Pagination,
    ICarouselInstance
} from 'react-native-reanimated-carousel';
import { StackNavigationProp } from '@react-navigation/stack';
import { v4 as uuidv4 } from 'uuid';

import { settingsStore } from '../stores/Stores';

import Button from '../components/Button';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import { ErrorMessage } from '../components/SuccessErrorMessage';

import {
    optimizeNeutrinoPeers,
    createLndWallet
} from '../utils/LndMobileUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import UrlUtils from '../utils/UrlUtils';

const One = require('../assets/images/intro/1.png');
const Two = require('../assets/images/intro/2.png');
const Three = require('../assets/images/intro/3.png');
const Four = require('../assets/images/intro/4.png');

import Wordmark from '../assets/images/SVG/wordmark-black.svg';

interface IntroProps {
    navigation: StackNavigationProp<any, any>;
}

const Intro: React.FC<IntroProps> = (props) => {
    const [creatingWallet, setCreatingWallet] = useState(false);
    const [choosingPeers, setChoosingPeers] = useState(false);
    const [error, setError] = useState(false);

    const ref = useRef<ICarouselInstance>(null);
    const progress = useSharedValue<number>(0);

    const screenWidth = Dimensions.get('window').width;
    const carouselItems = [
        {
            title: localeString('views.Intro.carousel1.title'),
            text: localeString('views.Intro.carousel1.text'),
            illustration: One
        },
        {
            title: localeString('views.Intro.carousel2.title'),
            text: localeString('views.Intro.carousel2.text').replace(
                'Zeus',
                'ZEUS'
            ),
            illustration: Two
        },
        {
            title: localeString('views.Intro.carousel3.title'),
            text: localeString('views.Intro.carousel3.text'),
            illustration: Three
        },
        {
            title: localeString('views.Intro.carousel4.title'),
            text: localeString('views.Intro.carousel4.text'),
            illustration: Four
        }
    ];

    const { navigation } = props;

    const onPressPagination = (index: number) => {
        ref.current?.scrollTo({
            count: index - progress.value,
            animated: true
        });
    };

    const renderItem = ({ item }: { item: any }) => (
        <View
            style={{
                borderRadius: 5,
                flex: 1
            }}
        >
            <Image
                source={item.illustration}
                style={{
                    width: screenWidth,
                    height: '50%'
                }}
                resizeMode="contain"
            />
            <View
                style={{
                    backgroundColor: themeColor('background'),
                    width: '100%',
                    flex: 1,
                    paddingHorizontal: 20
                }}
            >
                <Text
                    style={{
                        fontSize: 23,
                        color: themeColor('text'),
                        fontFamily: 'PPNeueMontreal-Book',
                        alignSelf: 'center',
                        paddingTop: 10
                    }}
                >
                    {item.title}
                </Text>
                <Text
                    style={{
                        fontSize: 20,
                        color: themeColor('secondaryText'),
                        fontFamily: 'PPNeueMontreal-Book',
                        alignSelf: 'center',
                        padding: 10
                    }}
                >
                    {item.text}
                </Text>
                {item.text === localeString('views.Intro.carousel3.text') && (
                    <>
                        <View
                            style={{
                                padding: 10
                            }}
                        >
                            <Button
                                title={localeString(
                                    'views.Intro.lightningOnboarding'
                                )}
                                onPress={() =>
                                    UrlUtils.goToUrl(
                                        'https://docs.zeusln.app/for-users/embedded-node/lightning-onboarding/'
                                    )
                                }
                                secondary
                            />
                        </View>
                        <View
                            style={{
                                padding: 10
                            }}
                        >
                            <Button
                                title={localeString(
                                    'views.Intro.lightningLiquidity'
                                )}
                                onPress={() =>
                                    UrlUtils.goToUrl(
                                        'https://bitcoin.design/guide/how-it-works/liquidity/'
                                    )
                                }
                                secondary
                            />
                        </View>
                    </>
                )}
                {item.text === localeString('views.Intro.carousel4.text') && (
                    <>
                        {error && (
                            <ErrorMessage
                                message={localeString(
                                    'views.Intro.errorCreatingWallet'
                                )}
                            />
                        )}
                        <View
                            style={{
                                padding: 10
                            }}
                        >
                            <Button
                                title={
                                    <View>
                                        <Text
                                            style={{
                                                fontSize: 20,
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                color: themeColor('white'),
                                                textAlign: 'center'
                                            }}
                                        >
                                            {localeString(
                                                'views.Intro.quickStart'
                                            ).toUpperCase()}
                                        </Text>
                                        <Text
                                            style={{
                                                fontSize: 14,
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                color: themeColor('white'),
                                                textAlign: 'center'
                                            }}
                                        >
                                            {localeString(
                                                'views.Intro.quickStartExplainer'
                                            ).toUpperCase()}
                                        </Text>
                                    </View>
                                }
                                onPress={async () => {
                                    const {
                                        setConnectingStatus,
                                        updateSettings
                                    } = settingsStore;

                                    setChoosingPeers(true);

                                    await optimizeNeutrinoPeers(undefined);

                                    setCreatingWallet(true);
                                    setChoosingPeers(false);

                                    const lndDir = uuidv4();

                                    let response;
                                    try {
                                        response = await createLndWallet({
                                            lndDir
                                        });
                                    } catch (e) {
                                        setCreatingWallet(false);
                                        setChoosingPeers(false);
                                        setError(true);
                                        return;
                                    }

                                    const { wallet, seed, randomBase64 }: any =
                                        response;
                                    if (wallet && wallet.admin_macaroon) {
                                        let nodes = [
                                            {
                                                adminMacaroon:
                                                    wallet.admin_macaroon,
                                                seedPhrase:
                                                    seed.cipher_seed_mnemonic,
                                                walletPassword: randomBase64,
                                                embeddedLndNetwork: 'Mainnet',
                                                implementation: 'embedded-lnd',
                                                nickname: localeString(
                                                    'general.defaultNodeNickname'
                                                ),
                                                lndDir,
                                                isSqlite: true
                                            }
                                        ];

                                        updateSettings({ nodes }).then(() => {
                                            setConnectingStatus(true);
                                            navigation.navigate('Wallet');
                                        });
                                    } else {
                                        setCreatingWallet(false);
                                        setChoosingPeers(false);
                                        setError(true);
                                    }
                                }}
                            />
                        </View>
                        <View
                            style={{
                                padding: 10
                            }}
                        >
                            <Button
                                title={
                                    <View>
                                        <Text
                                            style={{
                                                fontSize: 20,
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                color: themeColor('highlight'),
                                                textAlign: 'center'
                                            }}
                                        >
                                            {localeString(
                                                'views.Intro.advancedSetUp'
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                fontSize: 14,
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                color: themeColor('highlight'),
                                                textAlign: 'center'
                                            }}
                                        >
                                            {localeString(
                                                'views.Intro.advancedSetUpExplainer'
                                            ).toUpperCase()}
                                        </Text>
                                    </View>
                                }
                                onPress={() => navigation.navigate('Menu')}
                                secondary
                            />
                        </View>
                    </>
                )}
            </View>
        </View>
    );

    if (choosingPeers || creatingWallet) {
        return (
            <Screen>
                <View
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        top: 10
                    }}
                >
                    <View
                        style={{
                            width: Dimensions.get('window').width * 0.85,
                            maxHeight: 200,
                            marginTop: 10,
                            alignSelf: 'center'
                        }}
                    >
                        <Wordmark fill={themeColor('highlight')} />
                    </View>
                    <Text
                        style={{
                            color: themeColor('secondaryText'),
                            fontFamily: 'PPNeueMontreal-Book',
                            alignSelf: 'center',
                            fontSize: 15,
                            padding: 8
                        }}
                    >
                        {choosingPeers
                            ? localeString('views.Intro.choosingPeers')
                            : localeString(
                                  'views.Intro.creatingWallet'
                              ).replace('Zeus', 'ZEUS')}
                    </Text>
                    <View style={{ marginTop: 40 }}>
                        <LoadingIndicator />
                    </View>
                </View>
                <View
                    style={{
                        bottom: 56,
                        position: 'absolute',
                        alignSelf: 'center'
                    }}
                ></View>
            </Screen>
        );
    }

    return (
        <SafeAreaView
            style={{
                flex: 1,
                backgroundColor: themeColor('background')
            }}
        >
            <View
                style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    justifyContent: 'center'
                }}
            >
                <Carousel
                    ref={ref}
                    data={carouselItems}
                    width={screenWidth}
                    height={Dimensions.get('window').height * 0.75}
                    renderItem={renderItem}
                    onProgressChange={progress}
                    loop={false}
                    scrollAnimationDuration={500}
                    snapEnabled={true}
                    pagingEnabled={false}
                    overscrollEnabled={false}
                    onConfigurePanGesture={(gesture) => {
                        'worklet';
                        gesture.activeOffsetX([-10, 10]);
                    }}
                />
            </View>
            <Pagination.Basic
                progress={progress}
                data={carouselItems}
                dotStyle={{
                    backgroundColor: themeColor('secondaryText'),
                    borderRadius: 50
                }}
                activeDotStyle={{
                    backgroundColor: themeColor('highlight')
                }}
                containerStyle={{ gap: 5, marginBottom: 10 }}
                onPress={onPressPagination}
            />
        </SafeAreaView>
    );
};

export default Intro;
