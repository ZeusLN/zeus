import React, { useEffect, useState, useRef } from 'react';
import { Dimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { useSharedValue } from 'react-native-reanimated';
import Carousel, {
    Pagination,
    ICarouselInstance
} from 'react-native-reanimated-carousel';

import Header from '../components/Header';
import { themeColor } from '../utils/ThemeUtils';
import CollapsedQR from '../components/CollapsedQR';

interface MultiQRProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'MultiQR',
        {
            contactData: string;
            addressData: string[];
            fromContactDetailsView?: boolean;
        }
    >;
}

const MultiQR: React.FC<MultiQRProps> = (props: MultiQRProps) => {
    const [addressData, setAddressData] = useState(['']);
    const { navigation, route } = props;

    const ref = useRef<ICarouselInstance>(null);
    const progress = useSharedValue<number>(0);

    useEffect(() => {
        const { contactData, addressData } = route.params ?? {};
        let parsedContact: any = null;

        if (
            typeof contactData === 'string' &&
            contactData.startsWith('zeuscontact:')
        ) {
            try {
                parsedContact = JSON.parse(
                    contactData.replace(/^zeuscontact:/, '')
                );
            } catch (err) {
                console.error('Failed to parse contactData:', err);
            }
        }

        if (parsedContact) {
            const essentialContact = {
                contactId: parsedContact.contactId ?? '',
                name: parsedContact.name ?? '',
                description: parsedContact.description ?? '',
                lnAddress: parsedContact.lnAddress ?? [],
                bolt12Address: parsedContact.bolt12Address ?? [],
                bolt12Offer: parsedContact.bolt12Offer ?? [],
                onchainAddress: parsedContact.onchainAddress ?? [],
                nip05: parsedContact.nip05 ?? [],
                nostrNpub: parsedContact.nostrNpub ?? [],
                pubkey: parsedContact.pubkey ?? []
            };

            setAddressData([
                `zeuscontact:${JSON.stringify(essentialContact)}`,
                ...addressData
            ]);
        } else {
            setAddressData(addressData ?? []);
        }
    }, [route]);

    const screenWidth = Dimensions.get('window').width;

    const onPressPagination = (index: number) => {
        ref.current?.scrollTo({
            count: index - progress.value,
            animated: true
        });
    };

    const renderItem = ({ item, index }: { item: any; index: number }) => (
        <CollapsedQR
            showShare={true}
            value={item}
            expanded
            hideText={route.params?.fromContactDetailsView && index === 0}
            iconOnly={true}
        />
    );

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
                    ref={ref}
                    withAnimation={{
                        type: 'spring',
                        config: {
                            damping: 13
                        }
                    }}
                    data={addressData}
                    width={screenWidth}
                    renderItem={renderItem}
                    onProgressChange={progress}
                    loop={false}
                    scrollAnimationDuration={500}
                    snapEnabled={true}
                    pagingEnabled={false}
                    overscrollEnabled={false}
                    mode="parallax"
                    modeConfig={{
                        parallaxScrollingScale: 0.9,
                        parallaxScrollingOffset: 0
                    }}
                    onConfigurePanGesture={(gesture) => {
                        'worklet';
                        gesture.activeOffsetX([-10, 10]);
                    }}
                />
            </View>
            {addressData.length > 1 && (
                <Pagination.Basic
                    progress={progress}
                    data={addressData}
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
            )}
        </SafeAreaView>
    );
};

export default MultiQR;
