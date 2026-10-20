import * as React from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

import LightningLoadingPattern from './LightningLoadingPattern';

import { localeString } from '../utils/LocaleUtils';
import { getContentWidth } from '../utils/LayoutUtils';
import { themeColor } from '../utils/ThemeUtils';

export default function SendingLoadingView() {
    const windowSize = useWindowDimensions();
    const contentWidth = getContentWidth(windowSize.width);

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
                    fontSize: contentWidth * windowSize.scale * 0.014
                }}
            >
                {localeString('views.SendingLightning.sending')}
            </Text>
        </View>
    );
}
