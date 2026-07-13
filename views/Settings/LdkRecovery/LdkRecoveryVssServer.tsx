import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Route } from '@react-navigation/native';

import Button from '../../../components/Button';
import Header from '../../../components/Header';
import Screen from '../../../components/Screen';
import Text from '../../../components/Text';
import VssServerPicker, {
    resolveVssServer,
    isVssServerValid
} from '../../../components/VssServerPicker';

import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';
import { DEFAULT_VSS_SERVER } from '../../../utils/LdkNodeUtils';

interface LdkRecoveryVssServerProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<
        'LdkRecoveryVssServer',
        {
            network: string;
            nickname?: string;
            photo?: string;
            wordCount: 12 | 24;
        }
    >;
}

interface LdkRecoveryVssServerState {
    selectedValue: string;
    customServer: string;
}

export default class LdkRecoveryVssServer extends React.Component<
    LdkRecoveryVssServerProps,
    LdkRecoveryVssServerState
> {
    state = {
        selectedValue: DEFAULT_VSS_SERVER,
        customServer: ''
    };

    private continueToRecovery = () => {
        const { navigation, route } = this.props;
        const { network, nickname, photo, wordCount } = route.params ?? {};
        const { selectedValue, customServer } = this.state;

        navigation.navigate('SeedRecovery', {
            network,
            implementation: 'ldk-node',
            nickname,
            photo,
            wordCount,
            vssServer:
                resolveVssServer(selectedValue, customServer) || undefined
        });
    };

    render() {
        const { navigation } = this.props;
        const { selectedValue, customServer } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'views.Settings.EmbeddedNode.VssServer.title'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={styles.content}>
                    <Text
                        style={{
                            ...styles.subtitle,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {localeString(
                            'views.Settings.EmbeddedNode.VssServer.subtitle'
                        )}
                    </Text>

                    <VssServerPicker
                        selectedValue={selectedValue}
                        customServer={customServer}
                        onChange={(value, custom) =>
                            this.setState({
                                selectedValue: value,
                                customServer: custom
                            })
                        }
                    />

                    <View style={styles.button}>
                        <Button
                            title={localeString('general.next')}
                            onPress={this.continueToRecovery}
                            disabled={
                                !isVssServerValid(selectedValue, customServer)
                            }
                        />
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20
    },
    subtitle: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 15,
        marginBottom: 24
    },
    button: {
        marginTop: 24
    }
});
