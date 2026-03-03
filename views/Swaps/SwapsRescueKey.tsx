import React from 'react';
import { Alert, Platform, Text, TouchableOpacity, View } from 'react-native';
import RNFS from 'react-native-fs';
import { Icon } from '@rneui/themed';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';

import { Row } from '../../components/layout/Row';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import ModalBox from '../../components/ModalBox';
import DangerousCopySeedButton from '../../components/DangerousCopySeedButton';
import DangerousCopySeedModal from '../../components/Modals/DangerousCopySeedModal';
import SeedWarningDisclaimer from '../../components/SeedWarningDisclaimer';
import SeedWordGrid from '../../components/SeedWordGrid';
import { buttonContainerStyle } from '../../components/seedStyles';

import {
    SWAPS_KEY,
    REVERSE_SWAPS_KEY,
    SWAPS_LAST_USED_KEY,
    SWAPS_RESCUE_KEY
} from '../../utils/SwapUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import Storage from '../../storage';

interface SwapsRescueKeyProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'SwapsRescueKey',
        {
            seedPhrase: string[];
        }
    >;
}

interface SwapsRescueKeyState {
    understood: boolean;
    showModal: boolean;
    isDeleteModalVisible: boolean;
}

export default class SwapsRescueKey extends React.PureComponent<
    SwapsRescueKeyProps,
    SwapsRescueKeyState
> {
    state = {
        understood: false,
        showModal: false,
        isDeleteModalVisible: false
    };

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
        const { navigation, route } = this.props;
        const { understood, showModal } = this.state;
        const seedPhrase = route.params?.seedPhrase;

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
                        text: localeString('views.Swaps.rescueKey'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        understood && seedPhrase?.length > 0 ? (
                            <Row>
                                <DownloadRescueKey seedPhrase={seedPhrase} />
                                <DangerousCopySeedButton
                                    onPress={() =>
                                        this.setState({ showModal: true })
                                    }
                                    style={{ marginLeft: 10 }}
                                />
                            </Row>
                        ) : undefined
                    }
                    navigation={navigation}
                />
                <DangerousCopySeedModal
                    visible={showModal}
                    seedPhrase={seedPhrase || []}
                    onClose={() => this.setState({ showModal: false })}
                    dangerousText1Key="views.Swaps.rescueKey.dangerousText"
                />
                {!understood && (
                    <SeedWarningDisclaimer
                        text1Key="views.Swaps.rescueKey.text1"
                        text2Key="views.Swaps.rescueKey.text2"
                        onUnderstood={() => this.setState({ understood: true })}
                    />
                )}
                {understood && seedPhrase?.length > 0 && (
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <SeedWordGrid seedPhrase={seedPhrase} />
                        <View style={buttonContainerStyle()}>
                            <Button
                                onPress={() => navigation.goBack()}
                                title={localeString(
                                    'views.Swaps.rescueKey.backupComplete'
                                )}
                                containerStyle={{ marginBottom: 10 }}
                            />
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
                        </View>
                    </View>
                )}
            </Screen>
        );
    }
}
