import React, { useEffect, useState } from 'react';
import { Dimensions, View, SafeAreaView } from 'react-native';

import Animated, {
    Extrapolate,
    SharedValue,
    interpolate,
    useAnimatedStyle,
    useSharedValue
} from 'react-native-reanimated';
import Carousel from 'react-native-reanimated-carousel';

import Header from '../components/Header';
import { themeColor } from '../utils/ThemeUtils';
import CollapsedQR from '../components/CollapsedQR';

interface ContactQRProps {
    navigation: any;
}

const ContactQR: React.FC<ContactQRProps> = (props: ContactQRProps) => {
    const [addressData, setAddressData] = useState(['']);
    const { navigation } = props;

    useEffect(() => {
        const contactData = navigation.getParam('contactData', null);
        const addressData = navigation.getParam('addressData', null);

        setAddressData([contactData, ...addressData]);
    }, [navigation]);

    let screenWidth: number;
    const progressValue = useSharedValue<number>(0);

    screenWidth = Dimensions.get('window').width;

    const renderItem = ({ item, index }: { item: any; index: number }) => (
        <CollapsedQR value={item} expanded hideText={index === 0} />
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
            <Header
                leftComponent="Back"
                containerStyle={{
                    borderBottomWidth: 0
                }}
                navigation={navigation}
            />
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
                    data={addressData}
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
            {addressData.length > 1 && (
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        width: 100,
                        marginBottom: 10,
                        alignSelf: 'center'
                    }}
                >
                    {addressData.map((_, index) => {
                        return (
                            <PaginationItem
                                backgroundColor={themeColor('highlight')}
                                animValue={progressValue}
                                index={index}
                                key={index}
                                length={addressData.length}
                            />
                        );
                    })}
                </View>
            )}
        </SafeAreaView>
    );
};

export default ContactQR;
