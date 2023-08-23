import React from 'react';
import { Text, View } from 'react-native';

import Screen from '../components/Screen';
import Header from '../components/Header';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface LspExplanationProps {
    navigation: any;
}

const FONT_SIZE = 18;

export default class LspExplanation extends React.PureComponent<
    LspExplanationProps,
    {}
> {
    render() {
        const { navigation } = this.props;
        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.LspExplanation.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={{ margin: 20 }}>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular',
                            fontSize: FONT_SIZE,
                            marginBottom: FONT_SIZE
                        }}
                    >
                        {localeString('views.LspExplanationRouting.text1')}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular',
                            fontSize: FONT_SIZE,
                            marginBottom: FONT_SIZE + 10
                        }}
                    >
                        {localeString('views.LspExplanationRouting.text2')}
                    </Text>
                </View>
            </Screen>
        );
    }
}
