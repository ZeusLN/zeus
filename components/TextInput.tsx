import * as React from 'react';
import {
    KeyboardTypeOptions,
    StyleProp,
    StyleSheet,
    Text,
    TextInput as TextInputRN,
    TextStyle,
    TouchableOpacity,
    View,
    ViewStyle
} from 'react-native';
import { themeColor } from './../utils/ThemeUtils';

interface TextInputProps {
    placeholder?: string;
    value?: string;
    onChangeText?: any;
    numberOfLines?: number;
    style?: ViewStyle;
    textInputStyle?: StyleProp<TextStyle>;
    placeholderTextColor?: string;
    locked?: boolean;
    keyboardType?: KeyboardTypeOptions;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    autoCorrect?: boolean;
    multiline?: boolean;
    autoFocus?: boolean;
    secureTextEntry?: boolean;
    prefix?: string | number;
    prefixStyle?: any;
    suffix?: string;
    toggleUnits?: any;
    onPressIn?: any;
    right?: number;
    ref?: React.Ref<TextInputRN>;
    error?: boolean;
    onFocus?: any;
    onBlur?: any;
    onSubmitEditing?: () => void;
}

const TextInput = React.forwardRef<TextInputRN, TextInputProps>(
    (props, ref) => {
        const {
            placeholder,
            value,
            onChangeText,
            numberOfLines,
            style,
            textInputStyle,
            placeholderTextColor,
            locked,
            keyboardType,
            autoCapitalize,
            autoCorrect,
            multiline,
            autoFocus,
            secureTextEntry,
            prefix,
            prefixStyle,
            suffix,
            toggleUnits,
            onPressIn,
            right,
            error,
            onFocus,
            onBlur
        } = props;
        const defaultStyle = numberOfLines
            ? {
                  paddingTop: 10
              }
            : multiline
            ? {}
            : {
                  height: 60
              };

        const Prefix = () => (
            <Text
                style={
                    toggleUnits
                        ? {
                              ...styles.unit,
                              paddingLeft: 5,
                              paddingRight: 5,
                              marginRight: 5,
                              color: themeColor('text'),
                              backgroundColor: themeColor('background'),
                              ...prefixStyle
                          }
                        : {
                              ...styles.unit,
                              marginRight: 5,
                              color: themeColor('text'),
                              ...prefixStyle
                          }
                }
            >
                {prefix}
            </Text>
        );

        const Suffix = () => (
            <Text
                style={
                    toggleUnits
                        ? {
                              ...styles.unit,
                              paddingLeft: 5,
                              paddingRight: 5,
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
            >
                {suffix}
            </Text>
        );

        return (
            <View
                style={{
                    backgroundColor: themeColor('secondary'),
                    opacity: locked ? 0.8 : 1,
                    ...defaultStyle,
                    ...styles.wrapper,
                    ...style,
                    borderWidth: error ? 1.0 : 0,
                    borderColor: error ? themeColor('error') : undefined
                }}
            >
                {prefix ? (
                    toggleUnits ? (
                        <TouchableOpacity
                            onPress={() => toggleUnits && toggleUnits()}
                        >
                            <Prefix />
                        </TouchableOpacity>
                    ) : (
                        <Prefix />
                    )
                ) : null}
                <TextInputRN
                    placeholder={placeholder}
                    value={value}
                    onChangeText={onChangeText}
                    numberOfLines={numberOfLines || 1}
                    style={{
                        ...StyleSheet.flatten(textInputStyle),
                        ...styles.input,
                        color: locked
                            ? themeColor('secondaryText')
                            : themeColor('text')
                    }}
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
                    onSubmitEditing={props.onSubmitEditing}
                    ref={ref}
                    onFocus={onFocus}
                    onBlur={onBlur}
                />
                {suffix ? (
                    toggleUnits ? (
                        <TouchableOpacity
                            onPress={() => toggleUnits && toggleUnits()}
                        >
                            <Suffix />
                        </TouchableOpacity>
                    ) : (
                        <Suffix />
                    )
                ) : null}
            </View>
        );
    }
) as React.ForwardRefExoticComponent<
    TextInputProps & React.RefAttributes<TextInputRN>
>;

const styles = StyleSheet.create({
    wrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        top: 10,
        borderRadius: 6,
        marginBottom: 20,
        paddingLeft: 10,
        paddingRight: 10,
        overflow: 'hidden'
    },
    unit: {
        fontSize: 20,
        borderRadius: 6
    },
    input: {
        fontSize: 20,
        width: '100%',
        fontFamily: 'PPNeueMontreal-Book'
    }
});

export default TextInput;
