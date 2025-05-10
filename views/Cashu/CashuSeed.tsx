import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import { Row } from '../../components/layout/Row';
import { ErrorMessage } from '../../components/SuccessErrorMessage';

import Button from '../../components/Button';
import CopyButton from '../../components/CopyButton';
import Screen from '../../components/Screen';
import Header from '../../components/Header';

import CashuStore from '../../stores/CashuStore';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import Skull from '../../assets/images/SVG/Skull.svg';

interface CashuSeedProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
}

interface CashuSeedState {
    understood: boolean;
    showModal: boolean;
    seedPhrase: string[];
}

const MnemonicWord = ({ index, word }: { index: any; word: any }) => {
    const [isRevealed, setRevealed] = useState(false);
    return (
        <TouchableOpacity
            key={index}
            onPress={() => setRevealed(!isRevealed)}
            style={{
                padding: 8,
                backgroundColor: themeColor('secondary'),
                borderRadius: 5,
                margin: 6,
                marginTop: 4,
                marginBottom: 4,
                flexDirection: 'row',
                alignSelf: 'center'
            }}
        >
            <View style={{ width: 35 }}>
                <Text
                    style={{
                        flex: 1,
                        fontFamily: 'PPNeueMontreal-Book',
                        color: themeColor('secondaryText'),
                        fontSize: 18,
                        alignSelf: 'flex-start'
                    }}
                >
                    {index + 1}
                </Text>
            </View>
            <Text
                style={{
                    flex: 1,
                    fontFamily: 'PPNeueMontreal-Medium',
                    color: themeColor('text'),
                    fontSize: 18,
                    alignSelf: 'flex-end',
                    margin: 0,
                    marginLeft: 10,
                    padding: 0
                }}
            >
                {isRevealed ? word : '********'}
            </Text>
        </TouchableOpacity>
    );
};

@inject('CashuStore')
@observer
export default class CashuSeed extends React.PureComponent<
    CashuSeedProps,
    CashuSeedState
> {
    state = {
        understood: false,
        showModal: false,
        seedPhrase: []
    };

    UNSAFE_componentWillMount() {
        const { seedPhrase } = this.props.CashuStore;
        if (seedPhrase) {
            this.setState({
                seedPhrase
            });
        }
    }

    render() {
        const { navigation } = this.props;
        const { understood, showModal, seedPhrase } = this.state;

        const DangerouslyCopySeed = () => (
            <TouchableOpacity
                onPress={() => this.setState({ showModal: true })}
            >
                <Skull fill={themeColor('text')} />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Cashu.CashuSeed.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        understood && seedPhrase ? (
                            <Row>
                                <DangerouslyCopySeed />
                            </Row>
                        ) : undefined
                    }
                    navigation={navigation}
                />
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={showModal}
                >
                    <View style={styles.centeredView}>
                        <View style={styles.modal}>
                            {showModal && (
                                <View>
                                    <Text
                                        style={{
                                            ...styles.blackText,
                                            fontSize: 40,
                                            alignSelf: 'center',
                                            marginBottom: 20
                                        }}
                                    >
                                        {localeString('general.danger')}
                                    </Text>
                                    <Text
                                        style={{
                                            color: 'black',
                                            margin: 10
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.Seed.dangerousText1'
                                        )}
                                    </Text>
                                    <Text
                                        style={{
                                            ...styles.blackText,
                                            color: 'black',
                                            margin: 10
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.Seed.dangerousText2'
                                        )}
                                    </Text>
                                    <View style={styles.button}>
                                        <CopyButton
                                            title={localeString(
                                                'views.Settings.Seed.dangerousButton'
                                            )}
                                            copyValue={seedPhrase.join(' ')}
                                            icon={{
                                                name: 'warning',
                                                size: 40
                                            }}
                                        />
                                    </View>
                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                'general.cancel'
                                            )}
                                            onPress={() =>
                                                this.setState({
                                                    showModal: false
                                                })
                                            }
                                        />
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                </Modal>
                {!understood && (
                    <>
                        <View style={{ marginLeft: 10, marginRight: 10 }}>
                            <ErrorMessage
                                message={localeString(
                                    'general.warning'
                                ).toUpperCase()}
                            />
                        </View>
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                textAlign: 'center',
                                margin: 10,
                                fontSize: 20
                            }}
                        >
                            {localeString('views.Cashu.CashuSeed.text1')}
                        </Text>
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                textAlign: 'center',
                                margin: 10,
                                fontSize: 20
                            }}
                        >
                            {localeString('views.Settings.Seed.text2')}
                        </Text>
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                textAlign: 'center',
                                margin: 10,
                                fontSize: 20
                            }}
                        >
                            {localeString('views.Settings.Seed.text3').replace(
                                'Zeus',
                                'ZEUS'
                            )}
                        </Text>
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                textAlign: 'center',
                                margin: 10,
                                fontSize: 20
                            }}
                        >
                            {localeString('views.Settings.Seed.text4')}
                        </Text>
                        <View
                            style={{
                                alignSelf: 'center',
                                position: 'absolute',
                                bottom: 35,
                                width: '100%'
                            }}
                        >
                            <Button
                                onPress={() =>
                                    this.setState({ understood: true })
                                }
                                title={localeString('general.iUnderstand')}
                            />
                        </View>
                    </>
                )}
                {understood && (
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <ScrollView
                            contentContainerStyle={{
                                flexGrow: 1,
                                flexDirection: 'row'
                            }}
                        >
                            <View style={styles.column}>
                                {seedPhrase &&
                                    seedPhrase
                                        .slice(0, 6)
                                        .map((word: string, index: number) => {
                                            return (
                                                <MnemonicWord
                                                    index={index}
                                                    word={word}
                                                    key={`mnemonic-${index}`}
                                                />
                                            );
                                        })}
                            </View>
                            <View style={styles.column}>
                                {seedPhrase &&
                                    seedPhrase
                                        .slice(6, 12)
                                        .map((word: string, index: number) => {
                                            return (
                                                <MnemonicWord
                                                    index={index + 6}
                                                    word={word}
                                                    key={`mnemonic-${index}`}
                                                />
                                            );
                                        })}
                            </View>
                        </ScrollView>
                        <View
                            style={{
                                alignSelf: 'center',
                                marginTop: 45,
                                bottom: 35,
                                backgroundColor: themeColor('background'),
                                width: '100%'
                            }}
                        >
                            <Button
                                onPress={async () => {
                                    navigation.popTo('Wallet');
                                }}
                                title={localeString(
                                    'views.SendingLightning.goToWallet'
                                )}
                            />
                        </View>
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    whiteText: {
        color: 'white',
        fontFamily: 'PPNeueMontreal-Book'
    },
    blackText: {
        color: 'black',
        fontFamily: 'PPNeueMontreal-Book'
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10,
        width: 350,
        alignSelf: 'center'
    },
    modal: {
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 35,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 22
    },
    column: {
        marginTop: 8,
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        alignSelf: 'center',
        flexDirection: 'column',
        width: '50%'
    }
});
