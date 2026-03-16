import * as React from 'react';
import { Dimensions, Text, View } from 'react-native';

import LightningLoadingPattern from './LightningLoadingPattern';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

export default function SendingLoadingView() {
    const windowSize = Dimensions.get('window');

    return (
        <View
            style={{
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                marginTop: 25
            }}
        >
            <LightningLoadingPattern />
            <Text
                style={{
                    color: themeColor('text'),
                    fontFamily: 'PPNeueMontreal-Book',
                    // paddingBottom for centering
                    paddingBottom: windowSize.height / 10,
                    fontSize: windowSize.width * windowSize.scale * 0.014
                }}
            >
                {localeString('views.SendingLightning.sending')}
            </Text>
        </View>
    );
}
