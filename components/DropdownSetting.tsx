import * as React from 'react';
import {
    ActionSheetIOS,
    Platform,
    View,
    StyleSheet,
    Text,
    TouchableOpacity
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { themeColor } from './../utils/ThemeUtils';

interface DropdownSettingProps {
    title: string;
    selectedValue: string | boolean;
    displayValue?: string;
    onValueChange: (value: any) => void;
    values: Array<any>;
}

export default class DropdownSetting extends React.Component<
    DropdownSettingProps,
    {}
> {
    render() {
        const { title, selectedValue, displayValue, onValueChange, values } =
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

        return (
            <React.Fragment>
                {Platform.OS !== 'ios' && (
                    <View style={{ height: 75 }}>
                        <Text
                            style={{
                                color: themeColor('secondaryText')
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
                                color: themeColor('text')
                            }}
                        >
                            {pickerValuesAndroid}
                        </Picker>
                    </View>
                )}

                {Platform.OS === 'ios' && (
                    <View>
                        <Text
                            style={{
                                color: themeColor('secondaryText')
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
                                    ...styles.field
                                }}
                            >
                                {displayValue ? displayValue : selectedValue}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </React.Fragment>
        );
    }
}

const styles = StyleSheet.create({
    field: {
        fontSize: 20,
        width: '100%',
        height: 55,
        top: 10,
        paddingTop: 15,
        backgroundColor: '#31363F',
        borderRadius: 6,
        borderBottomWidth: 20,
        marginBottom: 20,
        paddingLeft: 10,
        overflow: 'hidden'
    }
});
