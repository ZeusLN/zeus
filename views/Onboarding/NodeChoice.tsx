import * as React from 'react';
import {
    ImageBackground,
    View,
    StyleSheet,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Text from '../../components/Text';

import ModalStore from '../../stores/ModalStore';

import { font } from '../../utils/FontUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface NodeChoiceProps {
    navigation: StackNavigationProp<any, any>;
    ModalStore: ModalStore;
    route: Route<'NodeChoice', { enableCashu: boolean; returnTo?: string }>;
}

@inject('ModalStore')
@observer
export default class NodeChoice extends React.Component<NodeChoiceProps, {}> {
    showLdkNodeInfo = () => {
        const { ModalStore } = this.props;
        ModalStore!.toggleInfoModal({
            text: [
                localeString('views.NodeChoice.ldkNode.info1'),
                localeString('views.NodeChoice.ldkNode.info2'),
                localeString('views.NodeChoice.ldkNode.info3')
            ]
        });
    };

    showEmbeddedLndInfo = () => {
        const { ModalStore } = this.props;
        ModalStore!.toggleInfoModal({
            text: [
                localeString('views.NodeChoice.embeddedLnd.info1'),
                localeString('views.NodeChoice.embeddedLnd.info2'),
                localeString('views.NodeChoice.embeddedLnd.info3')
            ]
        });
    };

    handleSelect = (implementation: 'embedded-ldk-node' | 'embedded-lnd') => {
        const { navigation, route } = this.props;
        const enableCashu = route.params?.enableCashu ?? false;
        const returnTo = route.params?.returnTo;

        if (returnTo) {
            navigation.navigate(returnTo, { enableCashu, implementation });
        } else {
            navigation.navigate('RecommendedSettings', {
                enableCashu,
                implementation
            });
        }
    };

    render() {
        const { navigation } = this.props;

        return (
            <Screen>
                <ImageBackground
                    source={require('../../assets/images/onboarding/eagle.jpeg')}
                    resizeMode="cover"
                    style={styles.backgroundImage}
                >
                    <View style={styles.container}>
                        <Header leftComponent="Back" navigation={navigation} />
                        <View style={styles.contentContainer}>
                            <View style={styles.headerContainer}>
                                <Text
                                    style={{
                                        fontSize: 32,
                                        fontFamily: font('marlideBold'),
                                        color: themeColor('text'),
                                        textAlign: 'center'
                                    }}
                                >
                                    {localeString(
                                        'views.NodeChoice.whatMatters'
                                    )}
                                </Text>
                            </View>

                            <View style={styles.buttonsContainer}>
                                <View style={styles.optionContainer}>
                                    <View style={styles.buttonWithInfo}>
                                        <View style={styles.buttonFlex}>
                                            <Button
                                                title={localeString(
                                                    'views.NodeChoice.speedReliability'
                                                )}
                                                onPress={() =>
                                                    this.handleSelect(
                                                        'embedded-ldk-node'
                                                    )
                                                }
                                            />
                                        </View>
                                        <TouchableOpacity
                                            onPress={this.showLdkNodeInfo}
                                            style={styles.infoButton}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 20,
                                                    color: themeColor('text'),
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                {'  ?'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.optionContainer}>
                                    <View style={styles.buttonWithInfo}>
                                        <View style={styles.buttonFlex}>
                                            <Button
                                                title={localeString(
                                                    'views.NodeChoice.privacyPower'
                                                )}
                                                onPress={() =>
                                                    this.handleSelect(
                                                        'embedded-lnd'
                                                    )
                                                }
                                                secondary
                                            />
                                        </View>
                                        <TouchableOpacity
                                            onPress={this.showEmbeddedLndInfo}
                                            style={styles.infoButton}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 20,
                                                    color: themeColor('text'),
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                {'  ?'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                </ImageBackground>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    backgroundImage: {
        flex: 1,
        justifyContent: 'center'
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: 40
    },
    headerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20
    },
    buttonsContainer: {
        paddingHorizontal: 10,
        paddingBottom: 20
    },
    optionContainer: {
        padding: 10
    },
    buttonWithInfo: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    buttonFlex: {
        flex: 1
    },
    infoButton: {
        padding: 10,
        marginLeft: 5
    }
});
