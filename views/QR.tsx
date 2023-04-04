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
}

export default class QR extends React.PureComponent<QRProps, QRState> {
    constructor(props: any) {
        super(props);
        const value: string = this.props.navigation.getParam('value', '');
        this.state = {
            value
        };
    }

    render() {
        const { navigation } = this.props;
        const { value } = this.state;

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
                        top: 5,
                        padding: 15
                    }}
                >
                    <CollapsedQR value={value} expanded textBottom />
                </View>
            </Screen>
        );
    }
}
