import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { themeColor } from './../utils/ThemeUtils';
import Copy from './../assets/images/SVG/Copy';

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
    return (
        <TouchableOpacity
            style={{
                ...styles.container,
                borderColor:
                    theme === 'dark'
                        ? themeColor('text')
                        : theme === 'light'
                        ? themeColor('background')
                        : themeColor('text'),
                backgroundColor:
                    theme === 'dark'
                        ? themeColor('background')
                        : theme === 'light'
                        ? themeColor('text')
                        : themeColor('background')
            }}
            onPress={() => {
                Clipboard.setString(URL);
                setCopied(true);
            }}
        >
            <Text
                style={{
                    ...styles.headingText,
                    color:
                        theme === 'dark'
                            ? themeColor('text')
                            : theme === 'light'
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
                        theme === 'dark'
                            ? themeColor('text')
                            : theme === 'light'
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
                        theme === 'dark'
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
        marginLeft: -25,
        marginRight: -25
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
