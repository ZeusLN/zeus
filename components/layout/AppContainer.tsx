import React from 'react';
import { SafeAreaView } from 'react-native';
import { Observer } from 'mobx-react';

import Screen from '../../components/Screen';

export function AppContainer({
    style = {},
    children
}: {
    style?: any;
    children?: React.ReactNode;
}) {
    return (
        <Observer>
            {() => {
                return (
                    <Screen>
                        <SafeAreaView
                            style={{
                                flex: 1,
                                ...style
                            }}
                        >
                            {children}
                        </SafeAreaView>
                    </Screen>
                );
            }}
        </Observer>
    );
}
