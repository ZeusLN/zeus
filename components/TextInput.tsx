import * as React from 'react';
import { TextInput as TextInputRN } from 'react-native';
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
}

function TextInput(props: TextInputProps) {
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
        secureTextEntry
    } = props;

    const defaultStyle = numberOfLines
        ? {
              paddingTop: 10
          }
        : {
              height: 60
          };

    return (
        <TextInputRN
            placeholder={placeholder}
            value={value}
            onChangeText={onChangeText}
            numberOfLines={numberOfLines || 1}
            style={{
                ...style,
                ...defaultStyle,
                color: themeColor('text'),
                backgroundColor: themeColor('secondary'),
                fontSize: 20,
                width: '100%',
                top: 10,
                borderRadius: 6,
                marginBottom: 20,
                padding: 10,
                fontFamily: 'Lato-Regular'
            }}
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
    );
}

export default TextInput;
