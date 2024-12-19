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
                // highlighted wordmark
                {
                    keypath: 'Layer 14 Outlines',
                    color: themeColor('highlight')
                },
                // surrounding wordmarks
                {
                    keypath: 'Layer 1 Outlines',
                    color: themeColor('text')
                },
                {
                    keypath: 'Layer 2 Outlines',
                    color: themeColor('text')
                },
                {
                    keypath: 'Layer 3 Outlines',
                    color: themeColor('text')
                },
                {
                    keypath: 'Layer 4 Outlines',
                    color: themeColor('text')
                },
                {
                    keypath: 'Layer 5 Outlines',
                    color: themeColor('text')
                },
                {
                    keypath: 'Layer 6 Outlines',
                    color: themeColor('text')
                },
                {
                    keypath: 'Layer 7 Outlines',
                    color: themeColor('text')
                },
                {
                    keypath: 'Layer 8 Outlines',
                    color: themeColor('text')
                },
                {
                    keypath: 'Layer 9 Outlines',
                    color: themeColor('text')
                },
                {
                    keypath: 'Layer 10 Outlines',
                    color: themeColor('text')
                },
                {
                    keypath: 'Layer 11 Outlines',
                    color: themeColor('text')
                },
                {
                    keypath: 'Layer 12 Outlines',
                    color: themeColor('text')
                },
                {
                    keypath: 'Layer 13 Outlines',
                    color: themeColor('text')
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
