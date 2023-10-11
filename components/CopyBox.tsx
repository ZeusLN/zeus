import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { themeColor } from '../utils/ThemeUtils';
import Copy from '../assets/images/SVG/Copy.svg';

import Clipboard from '@react-native-clipboard/clipboard';

interface CopyBoxProps {
    heading?: string;
    headingCopied?: string;
    URL?: string;
    theme?: any;
}

function CopyBox(props: CopyBoxProps) {
    const { heading, URL, headingCopied, theme } = props;
    const [copied, setCopied] = useState(false);
    const [currentTheme, setCurrentTheme] = useState(theme);
    return (
        <TouchableOpacity
            style={{
                ...styles.container,
                borderColor:
                    currentTheme === 'dark'
                        ? themeColor('text')
                        : currentTheme === 'light'
                        ? themeColor('background')
                        : themeColor('text'),
                backgroundColor:
                    currentTheme === 'dark'
                        ? themeColor('secondary')
                        : currentTheme === 'light'
                        ? themeColor('text')
                        : themeColor('background')
            }}
            onPress={() => {
                Clipboard.setString(URL);
                setCopied(true);
                setCurrentTheme('light');
                setTimeout(function () {
                    setCopied(false);
                    setCurrentTheme('dark');
                }, 3000);
            }}
        >
            <Text
                style={{
                    ...styles.headingText,
                    color:
                        currentTheme === 'dark'
                            ? themeColor('text')
                            : currentTheme === 'light'
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {copied ? headingCopied : heading}
            </Text>
            <Text
                style={{
                    ...styles.URL,
                    color:
                        currentTheme === 'dark'
                            ? themeColor('text')
                            : currentTheme === 'light'
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {URL}
            </Text>
            <View style={styles.copyIcon}>
                <Copy
                    height="30px"
                    width="30px"
                    stroke={
                        currentTheme === 'dark'
                            ? themeColor('text')
                            : themeColor('background')
                    }
                />
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        borderWidth: 1,
        borderRadius: 5,
        marginBottom: 25,
        minWidth: '100%'
    },
    headingText: {
        padding: 20,
        paddingRight: 45,
        paddingBottom: 5,
        fontWeight: 'bold'
    },
    URL: {
        padding: 20,
        paddingRight: 45
    },
    copyIcon: {
        position: 'absolute',
        right: 10,
        top: 10
    }
});

export default CopyBox;
