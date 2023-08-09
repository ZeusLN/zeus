import * as React from 'react';
import { Dimensions, Image, Text, View, SafeAreaView } from 'react-native';

import Animated, {
    Extrapolate,
    SharedValue,
    interpolate,
    useAnimatedStyle,
    useSharedValue
} from 'react-native-reanimated';
import Carousel from 'react-native-reanimated-carousel';

import Button from './../components/Button';

import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

const One = require('./../assets/images/intro/1.png');
const Two = require('./../assets/images/intro/2.png');
const Three = require('./../assets/images/intro/3.png');
const Four = require('./../assets/images/intro/4.png');

interface IntroProps {
    navigation: any;
}

const Intro: React.FC<IntroProps> = (props) => {
    let screenWidth: number;
    const progressValue = useSharedValue<number>(0);

    screenWidth = Dimensions.get('window').width;
    const carouselItems = [
        {
            title: localeString('views.Intro.carousel1.title'),
            text: localeString('views.Intro.carousel1.text'),
            illustration: One
        },
        {
            title: localeString('views.Intro.carousel2.title'),
            text: localeString('views.Intro.carousel2.text'),
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

    const renderItem = ({ item }: { item: any }) => (
        <View
            style={{
                borderRadius: 5
            }}
        >
            <Image
                source={item.illustration}
                style={{
                    width: screenWidth,
                    height: '65%'
                }}
            />
            <View
                style={{
                    backgroundColor: themeColor('background'),
                    width: '100%',
                    flexGrow: 1,
                    justifyContent: 'flex-end'
                }}
            >
                <Text
                    style={{
                        fontSize: 23,
                        color: themeColor('text'),
                        fontFamily: 'Lato-Regular',
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
                        fontFamily: 'Lato-Regular',
                        alignSelf: 'center',
                        padding: 10
                    }}
                >
                    {item.text}
                </Text>
                {item.text === localeString('views.Intro.carousel4.text') && (
                    <Button
                        containerStyle={{ marginTop: 10 }}
                        title={localeString('views.Intro.advancedSetUp')}
                        onPress={() => navigation.navigate('Settings')}
                    />
                )}
            </View>
        </View>
    );

    const PaginationItem: React.FC<{
        index: number;
        backgroundColor: string;
        length: number;
        animValue: SharedValue<number>;
    }> = (props) => {
        const { animValue, index, length, backgroundColor } = props;
        const width = 10;

        const animStyle = useAnimatedStyle(() => {
            let inputRange = [index - 1, index, index + 1];
            let outputRange = [-width, 0, width];

            if (index === 0 && animValue?.value > length - 1) {
                inputRange = [length - 1, length, length + 1];
                outputRange = [-width, 0, width];
            }

            return {
                transform: [
                    {
                        translateX: interpolate(
                            animValue?.value ?? 0,
                            inputRange,
                            outputRange,
                            Extrapolate.CLAMP
                        )
                    }
                ]
            };
        }, [animValue, index, length]);
        return (
            <View
                style={{
                    backgroundColor: themeColor('secondaryText'),
                    width,
                    height: width,
                    borderRadius: 50,
                    overflow: 'hidden'
                }}
            >
                <Animated.View
                    style={[
                        {
                            borderRadius: 50,
                            backgroundColor,
                            flex: 1
                        },
                        animStyle
                    ]}
                />
            </View>
        );
    };

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
                    withAnimation={{
                        type: 'spring',
                        config: {
                            damping: 13
                        }
                    }}
                    data={carouselItems}
                    width={screenWidth}
                    renderItem={renderItem}
                    onProgressChange={(_, absoluteProgress) =>
                        (progressValue.value = absoluteProgress)
                    }
                    loop={false}
                    mode="parallax"
                    modeConfig={{
                        parallaxScrollingScale: 0.9,
                        parallaxScrollingOffset: 0
                    }}
                />
            </View>
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    width: 100,
                    marginBottom: 10,
                    alignSelf: 'center'
                }}
            >
                {carouselItems.map((_, index) => {
                    return (
                        <PaginationItem
                            backgroundColor={themeColor('highlight')}
                            animValue={progressValue}
                            index={index}
                            key={index}
                            length={carouselItems.length}
                        />
                    );
                })}
            </View>
        </SafeAreaView>
    );
};

export default Intro;
