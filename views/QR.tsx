import * as React from 'react';
import { View } from 'react-native';

import CollapsedQR from '../components/CollapsedQR';
import Header from '../components/Header';
import Screen from '../components/Screen';

interface QRProps {
    navigation: any;
}

interface QRState {
    value: string;
    satAmount?: number;
}

export default class QR extends React.PureComponent<QRProps, QRState> {
    constructor(props: any) {
        super(props);
        const value: string = this.props.navigation.getParam('value', '');
        const satAmount: number | undefined =
            this.props.navigation.getParam('satAmount');

        this.state = {
            value,
            satAmount
        };
    }

    render() {
        const { navigation } = this.props;
        const { value, satAmount } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    backgroundColor="transparent"
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                    navigation={navigation}
                />
                <View
                    style={{
                        paddingLeft: 15,
                        paddingRight: 15
                    }}
                >
                    <CollapsedQR
                        value={value}
                        satAmount={satAmount}
                        expanded
                        textBottom
                    />
                </View>
            </Screen>
        );
    }
}
