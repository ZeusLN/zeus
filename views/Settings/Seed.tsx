import React, { useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import RNFS from 'react-native-fs';
import { Icon } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';

import { Row } from '../../components/layout/Row';
import { ErrorMessage } from '../../components/SuccessErrorMessage';

import Button from '../../components/Button';
import CopyButton from '../../components/CopyButton';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import ModalBox from '../../components/ModalBox';

import SettingsStore from '../../stores/SettingsStore';

import {
    SWAPS_KEY,
    REVERSE_SWAPS_KEY,
    SWAPS_LAST_USED_KEY,
    SWAPS_RESCUE_KEY
} from '../../utils/SwapUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';
import { IS_BACKED_UP_KEY } from '../../utils/MigrationUtils';

import Storage from '../../storage';

import Skull from '../../assets/images/SVG/Skull.svg';
import QR from '../../assets/images/SVG/QR.svg';

interface SeedProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    route: Route<
        'Seed',
        {
            seedPhrase?: string[];
        }
    >;
}

interface SeedState {
    understood: boolean;
    showModal: boolean;
    isDeleteModalVisible: boolean;
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

@inject('SettingsStore')
@observer
export default class Seed extends React.PureComponent<SeedProps, SeedState> {
    state = {
        understood: false,
        showModal: false,
        isDeleteModalVisible: false
    };

    componentDidMount() {
        // make sure we have latest settings and the seed phrase is accessible
        this.props.SettingsStore.getSettings();
    }

    renderDeleteModal = () => {
        const { navigation } = this.props;
        return (
            <ModalBox
                isOpen={this.state.isDeleteModalVisible}
                onClosed={() => this.setState({ isDeleteModalVisible: false })}
                style={{
                    backgroundColor: 'transparent'
                }}
                position="center"
                backdropOpacity={0.6}
            >
                <View
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                >
                    <View
                        style={{
                            backgroundColor: themeColor('background'),
                            borderRadius: 20,
                            padding: 20,
                            alignItems: 'center',
                            width: '90%'
                        }}
                    >
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 18,
                                textAlign: 'center',
                                marginBottom: 20
                            }}
                        >
                            {localeString(
                                'views.Swaps.rescueKey.deleteConfirmation'
                            )}
                        </Text>

                        <Button
                            title={localeString('general.confirm')}
                            onPress={async () => {
                                await Storage.removeItem(SWAPS_RESCUE_KEY);
                                await Storage.removeItem(SWAPS_KEY);
                                await Storage.removeItem(REVERSE_SWAPS_KEY);
                                await Storage.removeItem(SWAPS_LAST_USED_KEY);
                                this.setState({ isDeleteModalVisible: false });
                                navigation.popTo('Swaps');
                            }}
                            containerStyle={{ marginBottom: 10 }}
                            warning
                        />
                        <Button
                            title={localeString('general.cancel')}
                            onPress={() =>
                                this.setState({ isDeleteModalVisible: false })
                            }
                            secondary
                        />
                    </View>
                </View>
            </ModalBox>
        );
    };

    render() {
        const { navigation, SettingsStore, route } = this.props;
        const { understood, showModal } = this.state;
        // Get seed phrase based on implementation
        let seedPhrase: string[] | undefined;
        if (route.params?.seedPhrase) {
            seedPhrase = route.params.seedPhrase;
        } else if (SettingsStore.implementation === 'embedded-ldk-node') {
            // LDK Node stores mnemonic as a string, convert to array
            seedPhrase = SettingsStore.ldkMnemonic?.split(' ');
        } else {
            seedPhrase = SettingsStore.seedPhrase;
        }
        const isRefundRescueKey = !!route.params?.seedPhrase;
        const isTwelveWords = seedPhrase?.length === 12;

        const DangerouslyCopySeed = () => (
            <TouchableOpacity
                onPress={() => this.setState({ showModal: true })}
                style={{ marginLeft: 10 }}
            >
                <Skull fill={themeColor('text')} />
            </TouchableOpacity>
        );

        const QRExport = () => (
            <TouchableOpacity
                onPress={() => navigation.navigate('SeedQRExport')}
                style={{ marginLeft: isRefundRescueKey ? 20 : 14 }}
            >
                <QR fill={themeColor('text')} />
            </TouchableOpacity>
        );

        const DownloadRescueKey = ({
            seedPhrase
        }: {
            seedPhrase: string[];
        }) => {
            const handleDownload = async () => {
                try {
                    const mnemonic = seedPhrase.join(' ');
                    const jsonData = JSON.stringify({ mnemonic }, null, 2);

                    const path =
                        Platform.OS === 'android'
                            ? `${RNFS.DownloadDirectoryPath}/rescue_key.json`
                            : `${RNFS.DocumentDirectoryPath}/rescue_key.json`;

                    await RNFS.writeFile(path, jsonData, 'utf8');

                    Alert.alert(
                        localeString('general.success'),
                        `${localeString('views.Swaps.rescueKey.download')}\n\n${
                            Platform.OS === 'android'
                                ? localeString('views.Swaps.rescueKey.android')
                                : localeString('views.Swaps.rescueKey.ios')
                        }`
                    );

                    console.log('File written to:', path);
                } catch (error) {
                    console.error('Download failed:', error);
                }
            };

            return (
                <TouchableOpacity onPress={handleDownload}>
                    <Icon
                        name="download"
                        type="feather"
                        color={themeColor('text')}
                        underlayColor="transparent"
                        size={26}
                    />
                </TouchableOpacity>
            );
        };

        return (
            <Screen>
                {this.renderDeleteModal()}
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: isRefundRescueKey
                            ? localeString('views.Swaps.rescueKey')
                            : localeString('views.Settings.Seed.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        understood && seedPhrase ? (
                            <Row>
                                {isRefundRescueKey ? (
                                    <DownloadRescueKey
                                        seedPhrase={seedPhrase}
                                    />
                                ) : (
                                    <></>
                                )}
                                <DangerouslyCopySeed />
                                {isRefundRescueKey ? <></> : <QRExport />}
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
                                        {(() => {
                                            const text = isRefundRescueKey
                                                ? localeString(
                                                      'views.Swaps.rescueKey.dangerousText'
                                                  )
                                                : localeString(
                                                      'views.Settings.Seed.dangerousText1'
                                                  );
                                            // Show correct word count based on seed length
                                            if (isTwelveWords) {
                                                return text.replace('24', '12');
                                            }
                                            return text;
                                        })()}
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
                                            copyValue={
                                                seedPhrase?.join(' ') || ''
                                            }
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
                            {(() => {
                                const text = localeString(
                                    isRefundRescueKey
                                        ? 'views.Swaps.rescueKey.text1'
                                        : 'views.Settings.Seed.text1'
                                );
                                // Show correct word count based on seed length
                                if (isTwelveWords) {
                                    return text.replace('24', '12');
                                }
                                return text;
                            })()}
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
                            {localeString(
                                isRefundRescueKey
                                    ? 'views.Swaps.rescueKey.text2'
                                    : 'views.Settings.Seed.text2'
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
                                        .slice(
                                            0,
                                            Math.ceil(seedPhrase.length / 2)
                                        )
                                        .map((word: string, index: number) => (
                                            <MnemonicWord
                                                index={index}
                                                word={word}
                                                key={`mnemonic-${index}`}
                                            />
                                        ))}
                            </View>
                            <View style={styles.column}>
                                {seedPhrase &&
                                    seedPhrase
                                        .slice(Math.ceil(seedPhrase.length / 2))
                                        .map((word: string, index: number) => (
                                            <MnemonicWord
                                                index={
                                                    index +
                                                    Math.ceil(
                                                        seedPhrase.length / 2
                                                    )
                                                }
                                                word={word}
                                                key={`mnemonic-${
                                                    index +
                                                    Math.ceil(
                                                        seedPhrase.length / 2
                                                    )
                                                }`}
                                            />
                                        ))}
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
                                    if (isRefundRescueKey) navigation.goBack();
                                    else {
                                        await Storage.setItem(
                                            IS_BACKED_UP_KEY,
                                            true
                                        );
                                        navigation.popTo('Wallet');
                                    }
                                }}
                                title={(() => {
                                    const text = isRefundRescueKey
                                        ? localeString(
                                              'views.Swaps.rescueKey.backupComplete'
                                          )
                                        : localeString(
                                              'views.Settings.Seed.backupComplete'
                                          );
                                    // Show correct word count based on seed length
                                    if (isTwelveWords) {
                                        return text.replace('24', '12');
                                    }
                                    return text;
                                })()}
                                containerStyle={{ marginBottom: 10 }}
                            />
                            {isRefundRescueKey && (
                                <Button
                                    onPress={() =>
                                        this.setState({
                                            isDeleteModalVisible: true
                                        })
                                    }
                                    title={localeString(
                                        'views.Swaps.rescueKey.delete'
                                    )}
                                    warning
                                />
                            )}
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
