import * as React from 'react';
import {
    StyleSheet,
    Text,
    TextInput as TextInputRN,
    TouchableOpacity,
    View
} from 'react-native';
import { themeColor } from './../utils/ThemeUtils';

interface TextInputProps {
    placeholder?: string;
    value?: string;
    onChangeText?: any;
    numberOfLines?: number;
    style?: any;
    placeholderTextColor?: string;
    editable?: boolean;
    keyboardType?: string;
    autoCapitalize?: string;
    autoCorrect?: boolean;
    multiline?: boolean;
    autoFocus?: boolean;
    secureTextEntry?: boolean;
    prefix?: string;
    suffix?: string;
    toggleUnits?: any;
}

export default function TextInput(props: TextInputProps) {
    const {
        placeholder,
        value,
        onChangeText,
        numberOfLines,
        style,
        placeholderTextColor,
        editable,
        keyboardType,
        autoCapitalize,
        autoCorrect,
        multiline,
        autoFocus,
        secureTextEntry,
        prefix,
        suffix,
        toggleUnits
    } = props;

    const defaultStyle = numberOfLines
        ? {
              paddingTop: 10
          }
        : {
              height: 60
          };

    return (
        <View
            style={{
                ...style,
                ...defaultStyle,
                ...styles.wrapper
            }}
        >
            {prefix && (
                <TouchableOpacity onPress={() => toggleUnits()}>
                    <Text style={{ ...styles.unit, marginRight: 5 }}>
                        {prefix}
                    </Text>
                </TouchableOpacity>
            )}
            <TextInputRN
                placeholder={placeholder}
                value={value}
                onChangeText={onChangeText}
                numberOfLines={numberOfLines || 1}
                style={styles.input}
                placeholderTextColor={
                    placeholderTextColor || themeColor('secondaryText')
                }
                editable={editable ? editable : true}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                autoCorrect={autoCorrect}
                multiline={multiline}
                autoFocus={autoFocus}
                secureTextEntry={secureTextEntry}
            />
            {suffix && (
                <TouchableOpacity onPress={() => toggleUnits()}>
                    <Text
                        style={{
                            ...styles.unit,
                            right: 45
                        }}
                    >
                        {suffix}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        top: 10,
        borderRadius: 6,
        marginBottom: 20,
        padding: 10,
        backgroundColor: themeColor('secondary'),
        overflow: 'hidden'
    },
    unit: {
        color: themeColor('text'),
        backgroundColor: themeColor('background'),
        fontSize: 20,
        borderRadius: 6,
        padding: 5
    },
    input: {
        color: themeColor('text'),
        fontSize: 20,
        width: '100%',
        fontFamily: 'Lato-Regular',
        top: 3
    }
});
