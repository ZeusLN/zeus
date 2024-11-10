import React, { useState, useEffect } from 'react';
import { ScrollView, View } from 'react-native';

import Pill from './Pill';
import { themeColor } from './../utils/ThemeUtils';

interface PillProps {
    name: string;
    hidden?: boolean;
    textColor?: string;
    borderColor?: string;
    backgroundColor?: string;
}

interface AccountFilterProps {
    items: Array<PillProps>;
    refresh: Function;
    onChangeAccount?: Function;
    default?: string;
    showAll?: boolean;
}

function AccountFilter(props: AccountFilterProps) {
    const [selectedPin, setPin] = useState(props.default);

    useEffect(() => {
        props.refresh(selectedPin);
    }, [selectedPin]);

    const pills = [];

    if (props.showAll) {
        pills.push(
            <View key="all" style={{ padding: 2 }}>
                <Pill
                    title="All"
                    textColor={themeColor('background')}
                    borderColor={!selectedPin ? themeColor('highlight') : null}
                    backgroundColor={
                        !selectedPin
                            ? themeColor('highlight')
                            : themeColor('text')
                    }
                    onPress={() => {
                        if (props.onChangeAccount) props.onChangeAccount();
                        setPin('');
                    }}
                />
            </View>
        );
    }

    pills.push(
        <View key="default" style={{ padding: 2 }}>
            <Pill
                title="Default"
                textColor={themeColor('background')}
                borderColor={
                    selectedPin === 'default' ? themeColor('highlight') : null
                }
                backgroundColor={
                    selectedPin === 'default'
                        ? themeColor('highlight')
                        : themeColor('text')
                }
                onPress={() => {
                    if (props.onChangeAccount) props.onChangeAccount();
                    setPin('default');
                }}
            />
        </View>
    );

    for (const item in props.items) {
        const account = props.items[item];
        const { name, hidden } = account;

        if (!hidden) {
            pills.push(
                <View key={name} style={{ padding: 2 }}>
                    <Pill
                        title={name}
                        textColor={themeColor('background')}
                        borderColor={
                            selectedPin === name
                                ? themeColor('highlight')
                                : null
                        }
                        backgroundColor={
                            selectedPin === name
                                ? themeColor('highlight')
                                : themeColor('text')
                        }
                        onPress={() => {
                            if (props.onChangeAccount) props.onChangeAccount();
                            setPin(name);
                        }}
                    />
                </View>
            );
        }
    }

    return (
        <ScrollView
            style={{ minHeight: 55, maxHeight: 60, flexDirection: 'row' }}
            horizontal
        >
            {pills}
        </ScrollView>
    );
}

export default AccountFilter;
