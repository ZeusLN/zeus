import React from 'react';
import { Text, View } from 'react-native';

import NavigationService from '../../NavigationService';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import Header from '../../components/Header';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

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
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={{ margin: 20 }}>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: FONT_SIZE,
                            marginBottom: FONT_SIZE
                        }}
                    >
                        {localeString('views.LspExplanation.text1').replace(
                            'Zeus',
                            'ZEUS'
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
                        {localeString('views.LspExplanation.text2')}
                    </Text>
                    <View style={{ marginBottom: 20 }}>
                        <Button
                            title={localeString(
                                'views.LspExplanation.buttonText'
                            )}
                            onPress={() =>
                                UrlUtils.goToUrl(
                                    'https://bitcoin.design/guide/how-it-works/liquidity/'
                                )
                            }
                        />
                    </View>
                    <Button
                        title={localeString('views.LspExplanation.buttonText2')}
                        onPress={() =>
                            NavigationService.navigate('LspExplanationOverview')
                        }
                    />
                </View>
            </Screen>
        );
    }
}
