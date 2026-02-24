import React from 'react';
import { Alert, Platform, Text, TouchableOpacity, View } from 'react-native';
import RNFS from 'react-native-fs';
import { Icon } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';

import { Row } from '../../components/layout/Row';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import ModalBox from '../../components/ModalBox';
import DangerousCopySeedModal from '../../components/Modals/DangerousCopySeedModal';
import SeedWarningDisclaimer from '../../components/SeedWarningDisclaimer';
import SeedWordGrid from '../../components/SeedWordGrid';

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
        const seedPhrase = route.params?.seedPhrase ?? SettingsStore.seedPhrase;
        const isRefundRescueKey = !!route.params?.seedPhrase;

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
                <DangerousCopySeedModal
                    visible={showModal}
                    seedPhrase={seedPhrase || []}
                    onClose={() => this.setState({ showModal: false })}
                    dangerousText1Key={
                        isRefundRescueKey
                            ? 'views.Swaps.rescueKey.dangerousText'
                            : 'views.Settings.Seed.dangerousText1'
                    }
                />
                {!understood && (
                    <SeedWarningDisclaimer
                        text1Key={
                            isRefundRescueKey
                                ? 'views.Swaps.rescueKey.text1'
                                : 'views.Settings.Seed.text1'
                        }
                        text2Key={
                            isRefundRescueKey
                                ? 'views.Swaps.rescueKey.text2'
                                : 'views.Settings.Seed.text2'
                        }
                        onUnderstood={() => this.setState({ understood: true })}
                    />
                )}
                {understood && seedPhrase && (
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <SeedWordGrid seedPhrase={seedPhrase} />
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
                                title={
                                    isRefundRescueKey
                                        ? localeString(
                                              'views.Swaps.rescueKey.backupComplete'
                                          )
                                        : localeString(
                                              'views.Settings.Seed.backupComplete'
                                          )
                                }
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
