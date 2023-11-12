import * as React from 'react';
import { Dimensions, View } from 'react-native';
import Lottie from 'lottie-react-native';
import { themeColor } from '../utils/ThemeUtils';

const loader = require('../assets/images/Lottie/columns.json');

function LoadingColumns() {
    return (
        <View
            style={{
                position: 'absolute',
                alignSelf: 'center',
                height: Dimensions.get('window').height * 2,
                width: Dimensions.get('window').width * 2.3
            }}
        >
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
            />
        </View>
    );
}

export default LoadingColumns;
