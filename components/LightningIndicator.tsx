import * as React from 'react';
import Lottie from 'lottie-react-native';

const lightningLoading = require('../assets/images/Lottie/lightning-loading.json');

interface LightningIndicatorProps {
    size?: number;
}

function LightningIndicator(props: LightningIndicatorProps) {
    const { size } = props;

    return (
        <Lottie
            source={lightningLoading}
            autoPlay
            loop
            style={{
                alignSelf: 'center',
                width: size || 100,
                height: size || 100
            }}
            resizeMode="contain"
        />
    );
}

export default LightningIndicator;
