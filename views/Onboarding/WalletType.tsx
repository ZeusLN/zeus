import * as React from 'react';
import {
    ImageBackground,
    View,
    StyleSheet,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Route } from '@react-navigation/native';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Text from '../../components/Text';

import ModalStore from '../../stores/ModalStore';

import { font } from '../../utils/FontUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface WalletTypeProps {
    navigation: NativeStackNavigationProp<any, any>;
    ModalStore: ModalStore;
    route: Route<'WalletType', { returnTo?: string }>;
}

@inject('ModalStore')
@observer
export default class WalletType extends React.Component<WalletTypeProps, {}> {
    showSelfCustodyInfo = () => {
        const { ModalStore } = this.props;
        ModalStore!.toggleInfoModal({
            text: [
                localeString('views.WalletType.selfCustody.info1'),
                localeString('views.WalletType.selfCustody.info2'),
                localeString('views.WalletType.selfCustody.info3')
            ]
        });
    };

    showCashuInfo = () => {
        const { ModalStore } = this.props;
        ModalStore!.toggleInfoModal({
            text: [
                localeString('views.WalletType.cashu.info1'),
                localeString('views.WalletType.cashu.info2'),
                localeString('views.WalletType.cashu.info3')
            ]
        });
    };

    handleSelect = (enableCashu: boolean) => {
        const { navigation, route } = this.props;
        const returnTo = route.params?.returnTo;

        if (returnTo) {
            navigation.navigate(returnTo, { enableCashu });
        } else {
            navigation.navigate('NodeChoice', { enableCashu });
        }
    };

    render() {
        const { navigation } = this.props;

        return (
            <Screen>
                <ImageBackground
                    source={require('../../assets/images/onboarding/journey.jpeg')}
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
                                        'views.WalletType.whatsImportant'
                                    )}
                                </Text>
                            </View>

                            <View style={styles.buttonsContainer}>
                                <View style={styles.optionContainer}>
                                    <View style={styles.buttonWithInfo}>
                                        <View style={styles.buttonFlex}>
                                            <Button
                                                title={localeString(
                                                    'views.WalletType.control'
                                                )}
                                                onPress={() =>
                                                    this.handleSelect(false)
                                                }
                                            />
                                        </View>
                                        <TouchableOpacity
                                            onPress={this.showSelfCustodyInfo}
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
                                                    'views.WalletType.lowFees'
                                                )}
                                                onPress={() =>
                                                    this.handleSelect(true)
                                                }
                                                secondary
                                            />
                                        </View>
                                        <TouchableOpacity
                                            onPress={this.showCashuInfo}
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
