import * as React from 'react';
import { Dimensions } from 'react-native';
import Lottie from 'lottie-react-native';

const success = require('../assets/images/Lottie/payment-sent-bounce.json');

function SuccessAnimation() {
    const windowSize = Dimensions.get('window');
    return (
        <Lottie
            source={success}
            autoPlay
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
