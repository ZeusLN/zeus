import * as React from 'react';
import { Dimensions, View } from 'react-native';
import Lottie from 'lottie-react-native';
import { themeColor } from '../utils/ThemeUtils';

const loader = require('../assets/images/Lottie/lightning-pattern-full-random-loop.json');

interface LightningLoadingPatternProps {
    color?: string;
}

function LightningLoadingPattern(props: LightningLoadingPatternProps) {
    const { color } = props;
    return (
        <View
            style={{
                position: 'absolute',
                alignSelf: 'center',
                height: Dimensions.get('window').height,
                width: Dimensions.get('window').width
            }}
        >
            <Lottie
                source={loader}
                autoPlay
                colorFilters={[
                    {
                        keypath: 'Layer 36 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 41 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 46 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 51 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 55 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 60 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 64 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 69 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 73 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 78 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 36 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 41 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 46 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 51 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 55 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 60 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 64 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 69 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 73 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 78 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 25 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 30 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 35 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 40 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 44 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 49 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 54 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 59 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 63 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 68 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 17 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 21 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 26 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 31 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 34 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 39 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 45 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 50 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 53 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 58 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 11 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 14 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 16 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 20 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 24 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 29 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 33 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 38 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 42 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 48 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 5 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 7 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 9 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 12 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 15 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 19 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 23 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 28 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 32 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 37 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 2 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 3 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 4 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 6 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 8 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 10 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 13 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 18 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 22 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 27 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 47 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 52 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 56 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 61 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 65 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 70 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 74 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 79 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 83 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 88 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 57 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 62 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 67 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 72 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 75 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 80 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 85 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 90 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 93 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 97 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 66 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 71 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 76 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 81 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 84 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 89 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 94 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 98 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 101 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 104 Outlines 2',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 66 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 71 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 76 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 81 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 84 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 89 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 94 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 98 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 101 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 104 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 77 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 82 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 86 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 91 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 95 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 99 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 102 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 105 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 107 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 109 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 87 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 92 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 96 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 100 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 103 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 106 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 108 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 110 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 111 Outlines',
                        color: color || themeColor('highlight')
                    },
                    {
                        keypath: 'Layer 112 Outlines',
                        color: color || themeColor('highlight')
                    }
                ]}
                resizeMode="contain"
            />
        </View>
    );
}

export default LightningLoadingPattern;
