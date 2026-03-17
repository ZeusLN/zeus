import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { Icon, ListItem } from '@rneui/themed';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Header from '../../../../components/Header';
import Screen from '../../../../components/Screen';

import { localeString } from '../../../../utils/LocaleUtils';
import { themeColor } from '../../../../utils/ThemeUtils';

interface ChantoolsProps {
    navigation: NativeStackNavigationProp<any, any>;
}

export default class Chantools extends React.Component<ChantoolsProps, {}> {
    render() {
        const { navigation } = this.props;
        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.Chantools.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <ScrollView>
                        <>
                            <ListItem
                                containerStyle={{
                                    backgroundColor: 'transparent'
                                }}
                                onPress={() =>
                                    navigation.navigate('Sweepremoteclosed')
                                }
                            >
                                <ListItem.Content>
                                    <ListItem.Title
                                        style={{
                                            color: themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.EmbeddedNode.Chantools.Sweepremoteclosed.title'
                                        )}
                                    </ListItem.Title>
                                </ListItem.Content>
                                <Icon
                                    name="keyboard-arrow-right"
                                    color={themeColor('secondaryText')}
                                />
                            </ListItem>
                        </>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
