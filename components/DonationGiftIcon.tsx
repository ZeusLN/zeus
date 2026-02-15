import * as React from 'react';
import { TouchableOpacity, View } from 'react-native';

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
    return (
        <View
            style={{
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 1
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
