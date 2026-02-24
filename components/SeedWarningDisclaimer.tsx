import React from 'react';
import { Text, View } from 'react-native';

import { ErrorMessage } from './SuccessErrorMessage';
import Button from './Button';

import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';

interface SeedWarningDisclaimerProps {
    text1Key: string;
    text2Key: string;
    onUnderstood: () => void;
}

const SeedWarningDisclaimer = ({
    text1Key,
    text2Key,
    onUnderstood
}: SeedWarningDisclaimerProps) => {
    const textStyle = {
        color: themeColor('text'),
        fontFamily: 'PPNeueMontreal-Book',
        textAlign: 'center' as const,
        margin: 10,
        fontSize: 20
    };

    return (
        <>
            <View style={{ marginLeft: 10, marginRight: 10 }}>
                <ErrorMessage
                    message={localeString('general.warning').toUpperCase()}
                />
            </View>
            <Text style={textStyle}>{localeString(text1Key)}</Text>
            <Text style={textStyle}>{localeString(text2Key)}</Text>
            <Text style={textStyle}>
                {localeString('views.Settings.Seed.text3').replace(
                    'Zeus',
                    'ZEUS'
                )}
            </Text>
            <Text style={textStyle}>
                {localeString('views.Settings.Seed.text4')}
            </Text>
            <View
                style={{
                    alignSelf: 'center',
                    position: 'absolute',
                    bottom: 35,
                    width: '100%'
                }}
            >
                <Button
                    onPress={onUnderstood}
                    title={localeString('general.iUnderstand')}
                />
            </View>
        </>
    );
};

export default SeedWarningDisclaimer;
