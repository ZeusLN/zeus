import * as React from 'react';
import { View } from 'react-native';
import { Header, Icon } from 'react-native-elements';

import CollapsedQR from '../components/CollapsedQR';

import { themeColor } from '../utils/ThemeUtils';

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

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <View
                style={{ flex: 1, backgroundColor: themeColor('background') }}
            >
                <Header
                    leftComponent={<BackButton />}
                    backgroundColor="transparent"
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <View
                    style={{
                        top: 5,
                        padding: 15
                    }}
                >
                    <CollapsedQR value={value} expanded textBottom />
                </View>
            </View>
        );
    }
}
