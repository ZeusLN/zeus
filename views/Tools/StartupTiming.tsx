import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Header from '../../components/Header';
import Screen from '../../components/Screen';
import CopyButton from '../../components/CopyButton';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { getStartupTimingReport } from '../../utils/StartupTimingUtils';

interface StartupTimingProps {
    navigation: NativeStackNavigationProp<any, any>;
}

export default class StartupTiming extends React.Component<
    StartupTimingProps,
    {}
> {
    render() {
        const { navigation } = this.props;
        const report = getStartupTimingReport();

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Tools.startupTiming.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView contentContainerStyle={styles.container}>
                    <Text
                        style={[
                            styles.explainer,
                            { color: themeColor('secondaryText') }
                        ]}
                    >
                        {localeString('views.Tools.startupTiming.explainer')}
                    </Text>
                    <View
                        style={[
                            styles.reportContainer,
                            { backgroundColor: themeColor('secondary') }
                        ]}
                    >
                        <View style={styles.reportHeaderRow}>
                            <CopyButton
                                copyValue={report}
                                iconOnly={true}
                                iconSize={20}
                            />
                        </View>
                        <Text
                            style={[
                                styles.reportText,
                                { color: themeColor('text') }
                            ]}
                        >
                            {report}
                        </Text>
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        gap: 10,
        marginTop: 15,
        width: '90%',
        alignSelf: 'center',
        paddingBottom: 20
    },
    explainer: {
        fontSize: 13,
        fontFamily: 'PPNeueMontreal-Book'
    },
    reportContainer: {
        padding: 16,
        borderRadius: 10
    },
    reportHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end'
    },
    reportText: {
        fontSize: 12,
        fontFamily: 'DroidSansMono'
    }
});
