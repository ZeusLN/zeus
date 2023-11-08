import React from 'react';
import { Text, ScrollView } from 'react-native';
import Screen from '../../components/Screen';
import Header from '../../components/Header';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface LspExplanationWrappedInvoicesProps {
    navigation: any;
}

const FONT_SIZE = 18;

export default class LspExplanationWrappedInvoices extends React.PureComponent<
    LspExplanationWrappedInvoicesProps,
    {}
> {
    render() {
        const { navigation } = this.props;
        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'views.LspExplanationWrappedInvoices.title'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView style={{ margin: 20 }}>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: FONT_SIZE,
                            marginBottom: FONT_SIZE
                        }}
                    >
                        {localeString(
                            'views.LspExplanationWrappedInvoices.text1'
                        )}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: FONT_SIZE,
                            marginBottom: FONT_SIZE + 10
                        }}
                    >
                        {localeString(
                            'views.LspExplanationWrappedInvoices.text2'
                        )}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: FONT_SIZE,
                            marginBottom: FONT_SIZE + 10
                        }}
                    >
                        {localeString(
                            'views.LspExplanationWrappedInvoices.text3'
                        )}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: FONT_SIZE,
                            marginBottom: FONT_SIZE + 10
                        }}
                    >
                        {localeString(
                            'views.LspExplanationWrappedInvoices.text4'
                        )}
                    </Text>
                </ScrollView>
            </Screen>
        );
    }
}
