import * as React from 'react';
import { Dimensions, Vibration, View } from 'react-native';
import Lottie from 'lottie-react-native';
import { themeColor } from '../utils/ThemeUtils';

const lightning1 = require('../assets/images/Lottie/lightning1.json');
const lightning2 = require('../assets/images/Lottie/lightning2.json');
const lightning3 = require('../assets/images/Lottie/lightning3.json');

const lightning = [lightning1, lightning2, lightning3];

function PaidIndicator() {
    // vibrate upon payment completion
    Vibration.vibrate([250, 250, 1000]);

    const randomNumber = Math.ceil(Math.random() * 3) - 1;
    const indicatorSize = Dimensions.get('window').height * 0.4;

    return (
        <View
            style={{
                position: 'absolute',
                top: 0,
                zIndex: 1000,
                width: indicatorSize,
                height: indicatorSize
            }}
        >
            <Lottie
                source={lightning[randomNumber]}
                autoPlay
                loop={false}
                resizeMode="cover"
                colorFilters={[
                    {
                        keypath: '81 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '79 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '77 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '75 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '72 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '70 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '68 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '66 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '64 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '46 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '44 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '43 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '42 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '41 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '40 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '39 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '38 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '37 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '36 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '35 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '34 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '33 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '32 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '25 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '23 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '21 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '19 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '16 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '14 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '12 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '10 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '08 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '06 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '33 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '04 Outlines 2',
                        color: themeColor('text')
                    },
                    {
                        keypath: '02 Outlines 2',
                        color: themeColor('text')
                    }
                ]}
            />
        </View>
    );
}

export default PaidIndicator;
