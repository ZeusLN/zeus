import * as React from 'react';
import { Dimensions, Image, Text, View, SafeAreaView } from 'react-native';

import Carousel, { Pagination } from 'react-native-snap-carousel';
import Button from './../components/Button';

import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

const One = require('./../images/intro/1.png');
const Two = require('./../images/intro/2.png');
const Three = require('./../images/intro/3.png');
const Four = require('./../images/intro/4.png');

interface IntroProps {
    navigation: any;
}

interface IntroState {
    activeIndex: number;
    carouselItems: any;
}

export default class Intro extends React.Component<IntroProps, IntroState> {
    carousel: any;
    screenWidth: number;

    constructor(props: any) {
        super(props);
        this.screenWidth = Dimensions.get('window').width;
        this.state = {
            activeIndex: 0,
            carouselItems: [
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
            ]
        };
    }

    _renderItem({ item }: { item: any }) {
        return (
            <View
                style={{
                    borderRadius: 5,
                    height: 450
                }}
            >
                <Image
                    source={item.illustration}
                    style={{ width: this.screenWidth, height: 520 }}
                />
                <Text
                    style={{
                        fontSize: 25,
                        color: themeColor('text'),
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
                        alignSelf: 'center',
                        padding: 10
                    }}
                >
                    {item.text}
                </Text>
            </View>
        );
    }

    render() {
        const { navigation } = this.props;
        const { carouselItems, activeIndex } = this.state;
        return (
            <SafeAreaView
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <View
                    style={{
                        flex: 1,
                        justifyContent: 'center'
                    }}
                >
                    <Carousel
                        layout="default"
                        ref={(ref) => (this.carousel = ref)}
                        data={carouselItems}
                        sliderWidth={this.screenWidth}
                        itemWidth={this.screenWidth}
                        itemHeight={600}
                        renderItem={this._renderItem}
                        onSnapToItem={(index) =>
                            this.setState({ activeIndex: index })
                        }
                        hasParallaxImages={false}
                    />
                </View>
                {activeIndex === 3 && (
                    <Button
                        title={localeString('views.Intro.getStarted')}
                        onPress={() => navigation.navigate('Settings')}
                    />
                )}
                <Pagination
                    dotsLength={carouselItems.length}
                    activeDotIndex={activeIndex}
                    dotColor={themeColor('highlight')}
                    inactiveDotColor={themeColor('text')}
                    inactiveDotOpacity={0.4}
                    inactiveDotScale={0.6}
                    carouselRef={this.carousel}
                    tappableDots={!!this.carousel}
                />
            </SafeAreaView>
        );
    }
}
