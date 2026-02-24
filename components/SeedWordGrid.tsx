import React from 'react';
import { ScrollView, View } from 'react-native';

import MnemonicWord from './MnemonicWord';
import seedStyles from './seedStyles';

const SeedWordGrid = ({ seedPhrase }: { seedPhrase: string[] }) => {
    const half = Math.ceil(seedPhrase.length / 2);
    return (
        <ScrollView
            contentContainerStyle={{
                flexGrow: 1,
                flexDirection: 'row'
            }}
        >
            <View style={seedStyles.column}>
                {seedPhrase
                    .slice(0, half)
                    .map((word: string, index: number) => (
                        <MnemonicWord
                            index={index}
                            word={word}
                            key={`mnemonic-${index}`}
                        />
                    ))}
            </View>
            <View style={seedStyles.column}>
                {seedPhrase.slice(half).map((word: string, index: number) => (
                    <MnemonicWord
                        index={index + half}
                        word={word}
                        key={`mnemonic-${index + half}`}
                    />
                ))}
            </View>
        </ScrollView>
    );
};

export default SeedWordGrid;
