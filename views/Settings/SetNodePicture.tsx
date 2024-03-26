import * as React from 'react';

import {
    TouchableOpacity,
    View,
    Image,
    StyleSheet,
    FlatList,
    Dimensions,
    ScrollView
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

    getPhoto(photo: string | null): string {
        if (typeof photo === 'string' && photo.includes('rnfs://')) {
            const fileName = photo.replace('rnfs://', '');
            return `file://${RNFS.DocumentDirectoryPath}/${fileName}`;
        }
        return photo || '';
    }

    handleImageTap = async (item) => {
        try {
            // Fetch the local image
            let imageUri = Image.resolveAssetSource(item).uri;

            // Convert the local image to Base64
            let response = await fetch(imageUri);
            let blob = await response.blob();

            let reader = new FileReader();
            reader.onload = async () => {
                const dataUrl = reader.result;
                // Set Base64 representation to state
                this.setState({ photo: dataUrl });
            };
            reader.readAsDataURL(blob);
        } catch (error) {
            console.error('Error converting image to Base64:', error);
        }
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
                            {photo ? (
                                <Image
                                    source={{ uri: this.getPhoto(photo) }}
                                    style={styles.photo}
                                />
                            ) : (
                                <AddPhotos />
                            )}
                        </View>
                    </TouchableOpacity>
                </View>
                <ScrollView style={{ marginVertical: 10 }}>
                    <FlatList
                        data={this.state.images}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => this.handleImageTap(item)}
                            >
                                <View
                                    style={{
                                        ...styles.avatarContainer,
                                        backgroundColor:
                                            themeColor('secondaryText')
                                    }}
                                >
                                    <Avatar
                                        rounded
                                        size={
                                            Dimensions.get('window').width / 3 -
                                            20
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
                </ScrollView>

                <Button
                    title={localeString('views.SetNodePicture.choosePicture')}
                    onPress={() => {
                        navigation.navigate('NodeConfiguration', {
                            photo,
                            saved: false
                        });
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
