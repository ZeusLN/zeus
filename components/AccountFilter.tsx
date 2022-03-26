import React, { useState, useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import Pill from './Pill';
import { themeColor } from './../utils/ThemeUtils';

interface PillProps {
    title: string;
    textColor?: string;
    borderColor?: string;
    backgroundColor?: string;
}

interface AccountFilterProps {
    items: Array<PillProps>;
    refresh: Function;
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
            <View style={{ padding: 2 }}>
                <Pill
                    key="all"
                    title="All"
                    textColor={themeColor('background')}
                    borderColor={!selectedPin ? themeColor('highlight') : null}
                    backgroundColor={
                        !selectedPin
                            ? themeColor('highlight')
                            : themeColor('text')
                    }
                    onPress={() => setPin('')}
                />
            </View>
        );
    }

    pills.push(
        <View style={{ padding: 2 }}>
            <Pill
                key="default"
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
                onPress={() => setPin('default')}
            />
        </View>
    );

    for (const item in props.items) {
        const account = props.items[item];
        const { name } = account;

        pills.push(
            <View style={{ padding: 2 }}>
                <Pill
                    key={name}
                    title={name}
                    textColor={themeColor('background')}
                    borderColor={
                        selectedPin === name ? themeColor('highlight') : null
                    }
                    backgroundColor={
                        selectedPin === name
                            ? themeColor('highlight')
                            : themeColor('text')
                    }
                    onPress={() => setPin(name)}
                />
            </View>
        );
    }

    return <View style={{ height: 55, flexDirection: 'row' }}>{pills}</View>;
}

export default AccountFilter;
