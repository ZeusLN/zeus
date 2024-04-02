import * as React from 'react';

import {
    TouchableOpacity,
    View,
    Image,
    StyleSheet,
    FlatList,
    Dimensions
} from 'react-native';
import { Avatar } from 'react-native-elements';
import { launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';

import AddIcon from '../../assets/images/SVG/Add.svg';
import { themeColor } from '../../utils/ThemeUtils';

import Screen from '../../components/Screen';
import Header from '../../components/Header';
import Button from '../../components/Button';

import { localeString } from '../../utils/LocaleUtils';

interface SetNodePictureProps {
    navigation: any;
}

interface SetNodePictureState {
    images: string[];
    photo: string;
    presetImageUri: string;
}

export default class SetNodePicture extends React.Component<
    SetNodePictureProps,
    SetNodePictureState
> {
    constructor(props: SetNodePictureProps) {
        super(props);
        const implementation = this.props.navigation.getParam(
            'implementation',
            null
        );
        let images: string[] = [
            require('../../assets/images/zeus-illustration-1a.jpg'),
            require('../../assets/images/zeus-illustration-1b.jpg'),
            require('../../assets/images/zeus-illustration-2a.jpg'),
            require('../../assets/images/zeus-illustration-2b.jpg'),
            require('../../assets/images/zeus-illustration-3a.jpg'),
            require('../../assets/images/zeus-illustration-3b.jpg'),
            require('../../assets/images/zeus-illustration-4a.jpg'),
            require('../../assets/images/zeus-illustration-4b.jpg'),
            require('../../assets/images/zeus-illustration-5a.jpg'),
            require('../../assets/images/zeus-illustration-5b.jpg'),
            require('../../assets/images/zeus-illustration-6a.jpg'),
            require('../../assets/images/zeus-illustration-6b.jpg'),
            require('../../assets/images/zeus-illustration-7a.jpg'),
            require('../../assets/images/zeus-illustration-7b.jpg')
        ];

        // Map implementations to corresponding images
        const implementationImagesMap = {
            lndhub: [require('../../assets/images/Alby.jpg')],
            spark: [require('../../assets/images/CLN.jpg')],
            'c-lightning-REST': [
                require('../../assets/images/CLN.jpg'),
                require('../../assets/images/BTCpay.jpg')
            ],
            lnd: [
                require('../../assets/images/BTCpay.jpg'),
                require('../../assets/images/LND.jpg')
            ],
            'embedded-lnd': [require('../../assets/images/LND.jpg')],
            'lightning-node-connect': [require('../../assets/images/LND.jpg')]
        };

        if (implementation && implementation in implementationImagesMap) {
            images.push(...implementationImagesMap[implementation]);
        }

        this.state = {
            images,
            photo: '',
            presetImageUri: ''
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
                                photo: 'rnfs://' + fileName,
                                presetImageUri: ''
                            });
                        } catch (error) {
                            console.error('Error saving file: ', error);
                        }
                    }
                }
            }
        );
    };

    getPhoto(photo: string | null): string {
        if (typeof photo === 'string' && photo.includes('rnfs://')) {
            const fileName = photo.replace('rnfs://', '');
            return `file://${RNFS.DocumentDirectoryPath}/${fileName}`;
        }
        return photo || '';
    }

    handleImageTap = async (item) => {
        let presetImageUri = Image.resolveAssetSource(item).uri;
        this.setState({
            presetImageUri
        });
    };

    onChoosePicturePress = async () => {
        const { presetImageUri } = this.state;
        const { navigation } = this.props;
        if (presetImageUri) {
            const timestamp = new Date().getTime();
            const fileName = `photo_${timestamp}.jpg`;
            const filePath = RNFS.DocumentDirectoryPath + '/' + fileName;

            try {
                const downloadResult = await RNFS.downloadFile({
                    fromUrl: presetImageUri,
                    toFile: filePath
                }).promise;

                if (downloadResult.statusCode === 200) {
                    console.log('File downloaded to ', filePath);
                    this.setState({
                        photo: 'rnfs://' + fileName
                    });
                } else {
                    console.error(
                        'Download failed:',
                        downloadResult.statusCode
                    );
                }
            } catch (error) {
                console.error('Error downloading image:', error);
            }
        }
        navigation.navigate('NodeConfiguration', {
            photo: this.state.photo,
            saved: false
        });
    };

    render() {
        const { navigation } = this.props;
        const { photo, presetImageUri } = this.state;

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
                            'views.SetNodePicture.choosePicture'
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
                            {photo || presetImageUri ? (
                                <Image
                                    source={{
                                        uri:
                                            this.getPhoto(presetImageUri) ||
                                            this.getPhoto(photo)
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
                                    ...styles.avatarContainer,
                                    backgroundColor: themeColor('secondaryText')
                                }}
                            >
                                <Avatar
                                    rounded
                                    size={
                                        Dimensions.get('window').width / 3 - 20
                                    }
                                    source={item}
                                />
                            </View>
                        </TouchableOpacity>
                    )}
                    numColumns={3}
                    keyExtractor={(item, index) => index.toString()}
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
    avatarContainer: {
        margin: 8,
        borderRadius: 68
    }
});
