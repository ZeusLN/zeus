import * as React from 'react';
import { Dimensions } from 'react-native';
import Lottie from 'lottie-react-native';
import { themeColor } from '../utils/ThemeUtils';

const loader = require('../assets/images/Lottie/columns.json');

function LoadingColumns() {
    return (
        <Lottie
            source={loader}
            autoPlay
            colorFilters={[
                {
                    keypath: 'Layer 14 Outlines',
                    color: themeColor('highlight')
                }
            ]}
            resizeMode="contain"
            style={{
                position: 'absolute',
                alignSelf: 'center',
                height: Dimensions.get('window').height * 2,
                width: Dimensions.get('window').width * 2.3
            }}
        />
    );
}

export default LoadingColumns;
