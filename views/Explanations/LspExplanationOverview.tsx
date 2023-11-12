import React from 'react';
import { Text, ScrollView } from 'react-native';

import NavigationService from '../../NavigationService';
import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface LspExplanationOverviewProps {
    navigation: any;
}

const FONT_SIZE = 17;

export default class LspExplanationOverview extends React.PureComponent<
    LspExplanationOverviewProps,
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
                            'views.LspExplanationOverview.title'
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
                        {localeString('views.LspExplanationOverview.text1')}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: FONT_SIZE,
                            marginBottom: FONT_SIZE
                        }}
                    >
                        {localeString(
                            'views.LspExplanationOverview.text2'
                        ).replace('Zeus', 'ZEUS')}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: FONT_SIZE,
                            marginBottom: FONT_SIZE + 10
                        }}
                    >
                        {`\u2022 ${localeString(
                            'views.LspExplanationOverview.step1'
                        )}`}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: FONT_SIZE,
                            marginBottom: FONT_SIZE + 10
                        }}
                    >
                        {`\u2022 ${localeString(
                            'views.LspExplanationOverview.step2'
                        )}`}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: FONT_SIZE,
                            marginBottom: FONT_SIZE + 10
                        }}
                    >
                        {`\u2022 ${localeString(
                            'views.LspExplanationOverview.step3'
                        )}`}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: FONT_SIZE,
                            marginBottom: FONT_SIZE + 10
                        }}
                    >
                        {`\u2022 ${localeString(
                            'views.LspExplanationOverview.step4'
                        )}`}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: FONT_SIZE,
                            marginBottom: FONT_SIZE + 10
                        }}
                    >
                        {`\u2022 ${localeString(
                            'views.LspExplanationOverview.step5'
                        )}`}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: FONT_SIZE,
                            marginBottom: FONT_SIZE + 10
                        }}
                    >
                        {`\u2022 ${localeString(
                            'views.LspExplanationOverview.step6'
                        )}`}
                    </Text>
                    <Button
                        title={localeString(
                            'views.LspExplanationOverview.buttonText'
                        )}
                        onPress={() =>
                            NavigationService.navigate(
                                'LspExplanationWrappedInvoices'
                            )
                        }
                    />
                </ScrollView>
            </Screen>
        );
    }
}
