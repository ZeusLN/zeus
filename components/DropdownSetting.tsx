import * as React from 'react';
import {
    ActionSheetIOS,
    Platform,
    View,
    StyleSheet,
    Text,
    TouchableOpacity,
    StyleProp,
    ViewStyle
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { themeColor } from './../utils/ThemeUtils';
import CaretDown from './../assets/images/SVG/Caret Down.svg';

interface DropdownSettingProps {
    title: string;
    selectedValue: string | boolean;
    onValueChange: (value: any) => void;
    values: Array<any>;
    titlePosition?: 'above' | 'left';
}

export default class DropdownSetting extends React.Component<
    DropdownSettingProps,
    {}
> {
    render() {
        const { title, selectedValue, onValueChange, values, titlePosition } =
            this.props;

        const pickerValuesAndroid: Array<any> = [];
        const pickerValuesIOS: Array<string> = ['Cancel'];
        values.forEach((value: { key: string; value: string }) => {
            pickerValuesAndroid.push(
                <Picker.Item
                    key={value.key}
                    label={value.key}
                    value={value.value}
                />
            );
            pickerValuesIOS.push(value.key);
        });

        const displayItem = values.filter(
            (value: any) => value.value === selectedValue
        )[0];

        const display = displayItem ? displayItem.key : null;
        const viewStyle: StyleProp<ViewStyle> =
            titlePosition === 'left' ? styles.titlePositionLeftViewStyle : {};
        const textStyle: StyleProp<ViewStyle> =
            titlePosition === 'left' ? styles.titlePositionLeftTextStyle : {};

        return (
            <React.Fragment>
                {Platform.OS === 'android' && (
                    <View style={viewStyle}>
                        <Text
                            style={{
                                ...styles.secondaryText,
                                color: themeColor('secondaryText'),
                                ...textStyle
                            }}
                        >
                            {title}
                        </Text>
                        <Picker
                            selectedValue={`${selectedValue}`}
                            onValueChange={(itemValue: string) =>
                                onValueChange(itemValue)
                            }
                            style={{
                                color: themeColor('text'),
                                backgroundColor: themeColor('secondary'),
                                ...styles.field
                            }}
                            dropdownIconColor={themeColor('text')}
                        >
                            {pickerValuesAndroid}
                        </Picker>
                    </View>
                )}

                {Platform.OS === 'ios' && (
                    <View style={viewStyle}>
                        <Text
                            style={{
                                ...styles.secondaryText,
                                color: themeColor('secondaryText'),
                                ...styles.field
                            }}
                        >
                            {title}
                        </Text>
                        <TouchableOpacity
                            onPress={() =>
                                ActionSheetIOS.showActionSheetWithOptions(
                                    {
                                        options: pickerValuesIOS,
                                        cancelButtonIndex: 0
                                    },
                                    (buttonIndex) => {
                                        if (buttonIndex) {
                                            onValueChange(
                                                values[buttonIndex - 1].value
                                            );
                                        }
                                    }
                                )
                            }
                        >
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    backgroundColor: themeColor('secondary'),
                                    ...styles.field
                                }}
                            >
                                {display ? display : selectedValue}
                            </Text>
                            <View
                                style={{
                                    position: 'absolute',
                                    right: 10,
                                    top: '33%'
                                }}
                            >
                                <CaretDown
                                    stroke={themeColor('text')}
                                    fill={themeColor('text')}
                                />
                            </View>
                        </TouchableOpacity>
                    </View>
                )}
            </React.Fragment>
        );
    }
}

const styles = StyleSheet.create({
    secondaryText: {
        fontFamily: 'Lato-Regular'
    },
    field: {
        fontSize: 20,
        flexGrow: 1,
        height: 55,
        top: 10,
        paddingTop: 15,
        borderRadius: 6,
        borderBottomWidth: 20,
        marginBottom: 20,
        paddingLeft: 10,
        overflow: 'hidden',
        fontFamily: 'Lato-Regular'
    },
    titlePositionLeftViewStyle: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    titlePositionLeftTextStyle: {
        marginRight: 10
    }
});
