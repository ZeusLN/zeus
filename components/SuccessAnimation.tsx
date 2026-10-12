import React, { useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import Lottie from 'lottie-react-native';

import { getContentWidth } from '../utils/LayoutUtils';

const success = require('../assets/images/Lottie/payment-sent-bounce.json');

function SuccessAnimation() {
    const contentWidth = getContentWidth(useWindowDimensions().width);

    const animationRef = useRef<Lottie>(null);

    useEffect(() => {
        // Start the animation only when desired
        const timer = setTimeout(() => {
            animationRef.current?.play();
        }, 1);
        return () => clearTimeout(timer);
    }, []); // Empty dependency means it runs only on first mount

    return (
        <Lottie
            ref={animationRef}
            source={success}
            autoPlay={false}
            loop={false}
            resizeMode="contain"
            style={{
                width: contentWidth * 0.4,
                height: contentWidth * 0.4
            }}
        />
    );
}

export default SuccessAnimation;
