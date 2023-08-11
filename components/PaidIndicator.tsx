import * as React from 'react';
import { Dimensions, Vibration, View } from 'react-native';
import Lottie from 'lottie-react-native';
import { themeColor } from '../utils/ThemeUtils';

const lightning1 = require('../assets/images/Lottie/lightning1.json');
const lightning2 = require('../assets/images/Lottie/lightning2.json');
const lightning3 = require('../assets/images/Lottie/lightning3.json');

const lightning = [lightning1, lightning2, lightning3];

interface PaidIndicatorProps {
    size?: number;
}

function PaidIndicator(props: PaidIndicatorProps) {
    const { size } = props;
    const randomNumber = Math.ceil(Math.random() * 3) - 1;

    // vibrate upon payment completion
    Vibration.vibrate([250, 250, 1000]);

    return (
        <View
            style={{
                position: 'absolute',
                alignSelf: 'center',
                width: size || Dimensions.get('window').width,
                height: size || Dimensions.get('window').height
            }}
        >
            <Lottie
                source={lightning[randomNumber]}
                autoPlay
                loop={false}
                colorFilters={[
                    {
                        keypath: '81 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '79 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '77 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '75 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '72 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '70 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '68 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '66 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '64 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '46 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '44 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '43 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '42 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '41 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '40 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '39 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '38 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '37 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '36 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '35 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '34 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '33 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '32 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '25 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '23 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '21 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '19 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '16 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '14 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '12 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '10 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '08 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '06 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '33 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '04 Outlines 2',
                        color: themeColor('highlight')
                    },
                    {
                        keypath: '02 Outlines 2',
                        color: themeColor('highlight')
                    }
                ]}
            />
        </View>
    );
}

export default PaidIndicator;
