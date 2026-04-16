import * as React from 'react';

import {
    TouchableOpacity,
    View,
    Image,
    StyleSheet,
    FlatList,
    Dimensions,
    ImageSourcePropType
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import AddIcon from '../../assets/images/SVG/Add.svg';

import { getPhoto, getPresetName } from '../../utils/PhotoUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Screen from '../../components/Screen';
import Header from '../../components/Header';
import Button from '../../components/Button';

import { localeString } from '../../utils/LocaleUtils';

interface SetWalletPictureProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<'SetWalletPicture', { implementation: string }>;
}

interface SetWalletPictureState {
    images: string[];
    photo: string;
}

export default class SetWalletPicture extends React.Component<
    SetWalletPictureProps,
    SetWalletPictureState
> {
    constructor(props: SetWalletPictureProps) {
        super(props);
        const implementation = this.props.route.params?.implementation;
        let images: string[] = [
            require('../../assets/images/zeus_illustration_1a.jpg'),
            require('../../assets/images/zeus_illustration_1b.jpg'),
            require('../../assets/images/zeus_illustration_2a.jpg'),
            require('../../assets/images/zeus_illustration_2b.jpg'),
            require('../../assets/images/zeus_illustration_3a.jpg'),
            require('../../assets/images/zeus_illustration_3b.jpg'),
            require('../../assets/images/zeus_illustration_4a.jpg'),
            require('../../assets/images/zeus_illustration_4b.jpg'),
            require('../../assets/images/zeus_illustration_5a.jpg'),
            require('../../assets/images/zeus_illustration_5b.jpg'),
            require('../../assets/images/zeus_illustration_6a.jpg'),
            require('../../assets/images/zeus_illustration_6b.jpg'),
            require('../../assets/images/zeus_illustration_7a.jpg'),
            require('../../assets/images/zeus_illustration_7b.jpg')
        ];

        // Map implementations to corresponding images
        const implementationImagesMap: { [key: string]: any[] } = {
            lndhub: [require('../../assets/images/alby.jpg')],
            'nostr-wallet-connect': [
                require('../../assets/images/alby.jpg'),
                require('../../assets/images/albyhub.jpg'),
                require('../../assets/images/cashu.jpg'),
                require('../../assets/images/nostr.jpg'),
                require('../../assets/images/nostrwalletconnect.jpg')
            ],
            lnd: [
                require('../../assets/images/btcpay.jpg'),
                require('../../assets/images/lnd.jpg')
            ],
            'embedded-lnd': [require('../../assets/images/lnd.jpg')],
            'lightning-node-connect': [require('../../assets/images/lnd.jpg')],
            'cln-rest': [
                require('../../assets/images/cln.jpg'),
                require('../../assets/images/btcpay.jpg')
            ],
            'ldk-node': [require('../../assets/images/ldk.png')]
        };

        if (implementation && implementation in implementationImagesMap) {
            images.push(...implementationImagesMap[implementation]);
        }

        this.state = {
            images,
            photo: ''
        };
    }

    selectPhoto = () => {
        launchImageLibrary(
            {
                mediaType: 'photo',
                quality: 1.0,
                maxWidth: 500,
                maxHeight: 500,
                includeBase64: true
            },
            async (response: any) => {
                if (!response.didCancel) {
                    const asset = response?.assets[0];
                    if (asset.base64) {
                        // Generate a unique name for the image
                        const timestamp = new Date().getTime(); // Timestamp
                        const fileName = `photo_${timestamp}.png`;

                        const filePath =
                            RNFS.DocumentDirectoryPath + '/' + fileName;

                        try {
                            // Write the base64 data to the file
                            await RNFS.writeFile(
                                filePath,
                                asset.base64,
                                'base64'
                            );
                            console.log('File saved to ', filePath);

                            // Set the local file path in the state
                            this.setState({
                                photo: 'rnfs://' + fileName
                            });
                        } catch (error) {
                            console.error('Error saving file: ', error);
                        }
                    }
                }
            }
        );
    };

    handleImageTap = async (item: any) => {
        const presetImageUri = Image.resolveAssetSource(item).uri;
        const photo = `preset://${getPresetName(presetImageUri)}`;

        this.setState({
            photo
        });
    };

    onChoosePicturePress = async () => {
        const { navigation } = this.props;

        navigation.popTo('WalletConfiguration', {
            photo: this.state.photo,
            saved: false
        });
    };

    render() {
        const { navigation } = this.props;
        const { photo } = this.state;

        const AddPhotos = () => (
            <AddIcon
                fill={themeColor('background')}
                width="30"
                height="30"
                style={{ alignSelf: 'center' }}
            />
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'views.SetWalletPicture.choosePicture'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View
                    style={{
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                >
                    <TouchableOpacity onPress={this.selectPhoto}>
                        <View
                            style={{
                                ...styles.photoContainer,
                                backgroundColor: themeColor('secondaryText'),
                                borderColor: themeColor('separator')
                            }}
                        >
                            {photo ? (
                                <Image
                                    source={{
                                        uri: getPhoto(photo)
                                    }}
                                    style={styles.photo}
                                />
                            ) : (
                                <AddPhotos />
                            )}
                        </View>
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={this.state.images}
                    style={{ marginVertical: 10 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => this.handleImageTap(item)}
                        >
                            <View
                                style={{
                                    ...styles.presetContainer,
                                    backgroundColor: themeColor('secondaryText')
                                }}
                            >
                                <Image
                                    source={
                                        typeof item === 'string'
                                            ? { uri: item }
                                            : (item as ImageSourcePropType)
                                    }
                                    style={styles.presetImage}
                                    resizeMode="contain"
                                />
                            </View>
                        </TouchableOpacity>
                    )}
                    numColumns={3}
                    keyExtractor={(_item, index) => index.toString()}
                    contentContainerStyle={{
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                />

                <Button
                    title={localeString('views.SetNodePicture.choosePicture')}
                    onPress={() => {
                        this.onChoosePicturePress();
                    }}
                    containerStyle={{ paddingBottom: 10 }}
                />
            </Screen>
        );
    }
}

const presetSize = Dimensions.get('window').width / 3 - 20;

const styles = StyleSheet.create({
    photoContainer: {
        width: 136,
        height: 136,
        borderRadius: 68,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4
    },
    photo: {
        alignSelf: 'center',
        width: 128,
        height: 128,
        borderRadius: 68
    },
    presetContainer: {
        width: presetSize,
        height: presetSize,
        borderRadius: presetSize / 2,
        margin: 8,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center'
    },
    presetImage: {
        width: presetSize,
        height: presetSize
    }
});
