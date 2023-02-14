import * as React from 'react';
import { View } from 'react-native';
import Lottie from 'lottie-react-native';
import { themeColor } from '../utils/ThemeUtils';

const loader = require('../assets/images/Lottie/loader.json');

interface LoadingIndicatorProps {
    size?: number;
}

function LoadingIndicator(props: LoadingIndicatorProps) {
    const { size } = props;

    return (
        <View
            style={{
                alignSelf: 'center',
                width: size || 40,
                height: size || 40
            }}
        >
            <Lottie
                source={loader}
                autoPlay
                loop
                colorFilters={[
                    {
                        keypath: 'Comp 2',
                        color: themeColor('highlight')
                    }
                ]}
            />
        </View>
    );
}

export default LoadingIndicator;
