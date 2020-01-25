import * as React from 'react';
import {
    ActionSheetIOS,
    Platform,
    StyleSheet,
    View,
    Text,
    Picker,
    TouchableOpacity
} from 'react-native';

interface DropdownSettingProps {
    title: string;
    selectedValue: string | boolean;
    theme?: string;
    onValueChange: (value: any) => void;
    values: Array<any>;
}

export default class DropdownSetting extends React.Component<
    DropdownSettingProps,
    {}
> {
    render() {
        const {
            theme,
            title,
            selectedValue,
            onValueChange,
            values
        } = this.props;

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
                    <View>
                        <Text
                            style={{
                                color: theme === 'dark' ? 'white' : 'black',
                                paddingLeft: 10
                            }}
                        >
                            {title}
                        </Text>
                        <Picker
                            selectedValue={selectedValue}
                            onValueChange={(itemValue: string) =>
                                onValueChange(itemValue)
                            }
                            style={
                                theme === 'dark'
                                    ? styles.pickerDark
                                    : styles.picker
                            }
                        >
                            {pickerValuesAndroid}
                        </Picker>
                    </View>
                )}

                {Platform.OS === 'ios' && (
                    <View>
                        <Text
                            style={{
                                color: theme === 'dark' ? 'white' : 'black',
                                paddingLeft: 10,
                                paddingTop: 10
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
                                    buttonIndex =>
                                        onValueChange(
                                            values[buttonIndex - 1].value
                                        )
                                )
                            }
                        >
                            <Text
                                style={{
                                    color: theme === 'dark' ? 'white' : 'black',
                                    paddingLeft: 10
                                }}
                            >
                                {selectedValue}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </React.Fragment>
        );
    }
}

const styles = StyleSheet.create({
    picker: {
        height: 50,
        width: 100
    },
    pickerDark: {
        height: 50,
        width: 100,
        color: 'white'
    }
});
