import * as React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadingIndicator from './LoadingIndicator';

import { themeColor } from '../utils/ThemeUtils';

import Gift from '../assets/images/SVG/gift.svg';

interface DonationGiftIconProps {
    payingDonation: boolean;
    donationHandled: boolean;
    onPress: () => void;
}

export default function DonationGiftIcon({
    payingDonation,
    donationHandled,
    onPress
}: DonationGiftIconProps) {
    const insets = useSafeAreaInsets();
    return (
        <View
            style={{
                alignItems: 'flex-end',
                paddingTop: insets.top,
                paddingRight: 10
            }}
        >
            {payingDonation ? (
                <LoadingIndicator />
            ) : (
                <TouchableOpacity onPress={onPress}>
                    <Gift
                        fill={
                            donationHandled
                                ? themeColor('highlight')
                                : themeColor('error')
                        }
                        width={30}
                        height={30}
                    />
                </TouchableOpacity>
            )}
        </View>
    );
}
