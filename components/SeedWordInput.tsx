import React, { useEffect, useRef, useState } from 'react';
import {
    Keyboard,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    TextInput as TextInputRN
} from 'react-native';

import TextInput from './TextInput';

import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';
import { BIP39_WORD_LIST } from '../utils/Bip39Utils';

interface SeedWordInputProps {
    wordCount: 12 | 24;
    seedArray: string[];
    onSeedArrayChange: (seedArray: string[]) => void;
    channelBackup?: string;
    onChannelBackupChange?: (text: string) => void;
    onErrorMsgChange?: (msg: string) => void;
    onShowSuggestionsChange?: (showing: boolean) => void;
}

const filterBip39 = (text: string) =>
    BIP39_WORD_LIST.filter((val: string) =>
        val?.toLowerCase()?.startsWith(text?.toLowerCase())
    );

const SeedWordInput = ({
    wordCount,
    seedArray,
    onSeedArrayChange,
    channelBackup,
    onChannelBackupChange,
    onErrorMsgChange,
    onShowSuggestionsChange
}: SeedWordInputProps) => {
    const textInputRef = useRef<TextInputRN>(null);
    const [selectedInputType, setSelectedInputType] = useState<
        'word' | 'scb' | null
    >(null);
    const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(
        null
    );
    const [selectedText, setSelectedText] = useState('');
    const [filteredData, setFilteredData] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [invalidInput, setInvalidInput] = useState(false);

    const hasScb = onChannelBackupChange != null;
    const half = wordCount / 2;

    useEffect(() => {
        onShowSuggestionsChange?.(showSuggestions);
    }, [showSuggestions]);

    const setFocus = () => {
        if (!Keyboard.isVisible()) {
            textInputRef.current?.blur();
            textInputRef.current?.focus();
        }
    };

    const handleLabelPress = (
        type: 'mnemonicWord' | 'scb',
        index?: number,
        text?: string
    ) => {
        if (showSuggestions) {
            if (type === 'scb') {
                onChannelBackupChange?.(text || '');
                setSelectedText(text || '');
            } else if (selectedWordIndex != null) {
                const updated = [...seedArray];
                updated[selectedWordIndex] = text || '';
                onSeedArrayChange(updated);
                if (selectedWordIndex < wordCount - 1) {
                    setSelectedWordIndex(selectedWordIndex + 1);
                    setSelectedText(updated[selectedWordIndex + 1] || '');
                } else {
                    setSelectedText(text || '');
                    Keyboard.dismiss();
                }
            }
        } else {
            setSelectedText(text || '');
            if (index != null) {
                setSelectedInputType('word');
                setSelectedWordIndex(index);
            } else {
                setSelectedInputType('scb');
            }
        }

        setShowSuggestions(false);
        setFocus();
    };

    const handleChangeText = (text: string) => {
        onErrorMsgChange?.('');
        setSelectedText(text);

        if (selectedInputType === 'word') {
            setShowSuggestions(text.length > 0);
        }

        if (text.length > 0) {
            const filtered = filterBip39(text);
            setFilteredData(filtered);
            setInvalidInput(
                selectedInputType === 'word' && filtered.length === 0
            );
        } else {
            setFilteredData(BIP39_WORD_LIST);
            setInvalidInput(false);
        }

        if (selectedInputType === 'scb') {
            onChannelBackupChange?.(text);
        }
        if (selectedWordIndex != null) {
            const updated = [...seedArray];
            updated[selectedWordIndex] = text;
            onSeedArrayChange(updated);
        }
    };

    const RecoveryLabel = ({
        type,
        index,
        text
    }: {
        type: 'mnemonicWord' | 'scb';
        index?: number;
        text?: string;
    }) => (
        <TouchableOpacity
            onPress={() => handleLabelPress(type, index, text)}
            style={{
                padding: 8,
                backgroundColor: themeColor('secondary'),
                borderRadius: 5,
                marginTop: 4,
                marginBottom: 4,
                marginLeft: 6,
                marginRight: 6,
                flexDirection: 'row',
                maxHeight: type === 'scb' ? 60 : undefined
            }}
        >
            {!showSuggestions && index != null && (
                <View>
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            color:
                                selectedInputType === 'word' &&
                                selectedWordIndex === index
                                    ? themeColor('highlight')
                                    : themeColor('secondaryText'),
                            fontSize: 18,
                            alignSelf: 'flex-start'
                        }}
                    >
                        {index + 1}
                    </Text>
                </View>
            )}
            {!showSuggestions && type === 'scb' && (
                <Text
                    style={{
                        fontFamily: 'PPNeueMontreal-Book',
                        color:
                            selectedInputType === 'scb'
                                ? themeColor('highlight')
                                : themeColor('secondaryText'),
                        fontSize: 18,
                        alignSelf: 'flex-start'
                    }}
                >
                    {localeString(
                        'views.Settings.AddEditNode.disasterRecoveryBase64'
                    )}
                </Text>
            )}
            <Text
                style={{
                    flex: 1,
                    fontFamily: 'PPNeueMontreal-Medium',
                    color: themeColor('text'),
                    fontSize: 18,
                    alignSelf: type === 'mnemonicWord' ? 'flex-end' : undefined,
                    margin: 0,
                    marginLeft: showSuggestions ? 0 : 10,
                    padding: 0
                }}
            >
                {index != null &&
                text &&
                !(selectedInputType === 'word' && selectedWordIndex === index)
                    ? '********'
                    : text}
            </Text>
        </TouchableOpacity>
    );

    const renderTwoColumns = (
        leftItems: { key: string | number; el: React.ReactNode }[],
        rightItems: { key: string | number; el: React.ReactNode }[],
        centerWhenNoInput?: boolean
    ) => (
        <ScrollView
            contentContainerStyle={{ flexGrow: 1, flexDirection: 'row' }}
            keyboardShouldPersistTaps="handled"
        >
            <View
                style={{
                    ...styles.column,
                    alignSelf:
                        centerWhenNoInput && !selectedInputType
                            ? 'center'
                            : undefined
                }}
            >
                {leftItems.map((item) => (
                    <React.Fragment key={item.key}>{item.el}</React.Fragment>
                ))}
            </View>
            <View
                style={{
                    ...styles.column,
                    alignSelf:
                        centerWhenNoInput && !selectedInputType
                            ? 'center'
                            : undefined
                }}
            >
                {rightItems.map((item) => (
                    <React.Fragment key={item.key}>{item.el}</React.Fragment>
                ))}
            </View>
        </ScrollView>
    );

    const wordLabel = (index: number) => ({
        key: index,
        el: (
            <RecoveryLabel
                type="mnemonicWord"
                index={index}
                text={seedArray[index]}
            />
        )
    });

    const suggestionLabel = (word: string) => ({
        key: word,
        el: <RecoveryLabel type="mnemonicWord" text={word} />
    });

    const halfFiltered = Math.ceil(filteredData.length / 2);

    return (
        <>
            <View>
                {selectedInputType != null && (
                    <TextInput
                        ref={textInputRef}
                        onFocus={() => {
                            if (selectedText?.length === 0) {
                                setShowSuggestions(true);
                            }
                        }}
                        value={selectedText}
                        prefix={
                            selectedInputType === 'word'
                                ? (selectedWordIndex as number) + 1
                                : 'SCB'
                        }
                        prefixStyle={{ color: themeColor('highlight') }}
                        textColor={
                            invalidInput ? themeColor('error') : undefined
                        }
                        style={{
                            margin: 20,
                            marginLeft: 10,
                            marginRight: 10,
                            width: '90%',
                            alignSelf: 'center'
                        }}
                        autoCapitalize="none"
                        autoFocus
                        onChangeText={handleChangeText}
                    />
                )}
                {selectedInputType === 'word' && invalidInput && (
                    <Text
                        style={{
                            color: themeColor('error'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: 14,
                            marginTop: 5,
                            marginLeft: 30
                        }}
                    >
                        {localeString(
                            'views.Settings.NodeConfiguration.invalidSeedWord'
                        )}
                    </Text>
                )}
            </View>
            {!showSuggestions && (
                <>
                    {renderTwoColumns(
                        Array.from({ length: half }, (_, i) => wordLabel(i)),
                        Array.from({ length: half }, (_, i) =>
                            wordLabel(i + half)
                        ),
                        true
                    )}
                    {hasScb && (
                        <View style={{ flexGrow: 1, flexDirection: 'row' }}>
                            <View style={styles.scb}>
                                <RecoveryLabel
                                    type="scb"
                                    text={channelBackup}
                                />
                            </View>
                        </View>
                    )}
                </>
            )}
            {showSuggestions &&
                renderTwoColumns(
                    filteredData.slice(0, halfFiltered).map(suggestionLabel),
                    filteredData.slice(halfFiltered).map(suggestionLabel)
                )}
        </>
    );
};

const styles = StyleSheet.create({
    column: {
        marginTop: 8,
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        flexDirection: 'row',
        width: '50%'
    },
    scb: {
        alignItems: 'flex-start',
        flexDirection: 'column',
        marginTop: 8,
        width: '100%',
        lineHeight: 1
    }
});

export default SeedWordInput;
