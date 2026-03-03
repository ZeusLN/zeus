import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { themeColor } from '../utils/ThemeUtils';

const MnemonicWord = ({ index, word }: { index: number; word: string }) => {
    const [isRevealed, setRevealed] = useState(false);
    return (
        <TouchableOpacity
            key={index}
            onPress={() => setRevealed(!isRevealed)}
            style={{
                padding: 8,
                backgroundColor: themeColor('secondary'),
                borderRadius: 5,
                margin: 6,
                marginTop: 4,
                marginBottom: 4,
                flexDirection: 'row',
                alignSelf: 'center'
            }}
        >
            <View style={{ width: 35 }}>
                <Text
                    style={{
                        flex: 1,
                        fontFamily: 'PPNeueMontreal-Book',
                        color: themeColor('secondaryText'),
                        fontSize: 18,
                        alignSelf: 'flex-start'
                    }}
                >
                    {index + 1}
                </Text>
            </View>
            <Text
                style={{
                    flex: 1,
                    fontFamily: 'PPNeueMontreal-Medium',
                    color: themeColor('text'),
                    fontSize: 18,
                    alignSelf: 'flex-end',
                    margin: 0,
                    marginLeft: 10,
                    padding: 0
                }}
            >
                {isRevealed ? word : '********'}
            </Text>
        </TouchableOpacity>
    );
};

export default MnemonicWord;
