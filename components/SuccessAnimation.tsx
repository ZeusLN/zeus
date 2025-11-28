import React, { useEffect, useRef } from 'react';
import { Dimensions } from 'react-native';
import Lottie from 'lottie-react-native';

const success = require('../assets/images/Lottie/payment-sent-bounce.json');

function SuccessAnimation() {
    const windowSize = Dimensions.get('window');

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
                width: windowSize.width * 0.4,
                height: windowSize.width * 0.4
            }}
        />
    );
}

export default SuccessAnimation;
