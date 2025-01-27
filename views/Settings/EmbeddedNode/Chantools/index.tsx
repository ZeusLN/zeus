import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { StackNavigationProp } from '@react-navigation/stack';

import Header from '../../../../components/Header';
import Screen from '../../../../components/Screen';

import { themeColor } from '../../../../utils/ThemeUtils';

interface ChantoolsProps {
    navigation: StackNavigationProp<any, any>;
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
                            text: 'chantools',
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
                                        sweepremoteclosed
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
