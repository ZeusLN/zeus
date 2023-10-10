import * as React from 'react';
import { View } from 'react-native';

import CollapsedQR from '../components/CollapsedQR';
import Header from '../components/Header';
import Screen from '../components/Screen';
import Text from '../components/Text';

import { themeColor } from '../utils/ThemeUtils';

interface QRProps {
    navigation: any;
}

interface QRState {
    value: string;
    hideText: boolean;
    jumboLabel: boolean;
    logo: any;
}

export default class QR extends React.PureComponent<QRProps, QRState> {
    constructor(props: any) {
        super(props);

        const value: string = this.props.navigation.getParam('value', '');
        const hideText: boolean = this.props.navigation.getParam(
            'hideText',
            false
        );
        const jumboLabel: boolean = this.props.navigation.getParam(
            'jumboLabel',
            false
        );

        const logo: any = this.props.navigation.getParam('logo', null);

        this.state = {
            value,
            hideText,
            jumboLabel,
            logo
        };
    }

    render() {
        const { navigation } = this.props;
        const { value, hideText, jumboLabel, logo } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                    navigation={navigation}
                />
                <View
                    style={{
                        top: 5,
                        padding: 15,
                        alignItems: 'center'
                    }}
                >
                    {jumboLabel && (
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular',
                                fontSize: 16,
                                marginBottom: 20
                            }}
                        >
                            {value}
                        </Text>
                    )}
                    <CollapsedQR
                        value={value}
                        expanded
                        textBottom
                        hideText={hideText}
                        logo={logo}
                    />
                </View>
            </Screen>
        );
    }
}
