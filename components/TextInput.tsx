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
    locked?: boolean;
    keyboardType?: string;
    autoCapitalize?: string;
    autoCorrect?: boolean;
    multiline?: boolean;
    autoFocus?: boolean;
    secureTextEntry?: boolean;
    prefix?: string;
    suffix?: string;
    toggleUnits?: any;
    onPressIn?: any;
    right?: number;
}

export default function TextInput(props: TextInputProps) {
    const {
        placeholder,
        value,
        onChangeText,
        numberOfLines,
        style,
        placeholderTextColor,
        locked,
        keyboardType,
        autoCapitalize,
        autoCorrect,
        multiline,
        autoFocus,
        secureTextEntry,
        prefix,
        suffix,
        toggleUnits,
        onPressIn,
        right
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
        // style={
        //     {
        //         ...style
        //        // ...defaultStyle,
        //        // ...styles.wrapper,
        //         backgroundColor: themeColor('secondary')
        // }}
        >
            {prefix && (
                <TouchableOpacity onPress={() => toggleUnits && toggleUnits()}>
                    <Text
                        style={
                            toggleUnits
                                ? {
                                      ...styles.unit,
                                      marginRight: 5,
                                      color: themeColor('text'),
                                      backgroundColor: themeColor('background')
                                  }
                                : {
                                      ...styles.unit,
                                      marginRight: 5,
                                      color: themeColor('text')
                                  }
                        }
                        onPress={() => toggleUnits && toggleUnits()}
                    >
                        {prefix}
                    </Text>
                </TouchableOpacity>
            )}
            <TextInputRN
                placeholder={placeholder}
                value={value}
                onChangeText={onChangeText}
                numberOfLines={numberOfLines || 1}
                style={{ ...styles.input, color: themeColor('text') }}
                placeholderTextColor={
                    placeholderTextColor || themeColor('secondaryText')
                }
                editable={!locked}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                autoCorrect={autoCorrect}
                multiline={multiline}
                autoFocus={autoFocus}
                secureTextEntry={secureTextEntry}
                onPressIn={onPressIn}
            />
            {suffix && (
                <TouchableOpacity onPress={() => toggleUnits && toggleUnits()}>
                    <Text
                        style={
                            toggleUnits
                                ? {
                                      ...styles.unit,
                                      right: right || 45,
                                      color: themeColor('text'),
                                      backgroundColor: themeColor('background')
                                  }
                                : {
                                      ...styles.unit,
                                      right: right || 45,
                                      color: themeColor('text')
                                  }
                        }
                        onPress={() => toggleUnits && toggleUnits()}
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
        overflow: 'hidden'
    },
    unit: {
        fontSize: 20,
        borderRadius: 6,
        padding: 5
    },
    input: {
        fontSize: 20,
        width: '100%',
        fontFamily: 'Lato-Regular',
        top: 3
    }
});
