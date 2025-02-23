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
import { Avatar } from 'react-native-elements';
import { launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import AddIcon from '../../assets/images/SVG/Add.svg';

import { getPhoto } from '../../utils/PhotoUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Screen from '../../components/Screen';
import Header from '../../components/Header';
import Button from '../../components/Button';

import { localeString } from '../../utils/LocaleUtils';

interface SetWalletPictureProps {
    navigation: StackNavigationProp<any, any>;
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
        const implementationImagesMap: { [key: string]: any[] } = {
            lndhub: [require('../../assets/images/Alby.jpg')],
            'nostr-wallet-connect': [
                require('../../assets/images/Alby.jpg'),
                require('../../assets/images/AlbyHub.jpg'),
                require('../../assets/images/Cashu.jpg'),
                require('../../assets/images/Nostr.jpg'),
                require('../../assets/images/NostrWalletConnect.jpg')
            ],
            lnd: [
                require('../../assets/images/BTCpay.jpg'),
                require('../../assets/images/LND.jpg')
            ],
            'embedded-lnd': [require('../../assets/images/LND.jpg')],
            'lightning-node-connect': [require('../../assets/images/LND.jpg')],
            'cln-rest': [
                require('../../assets/images/CLN.jpg'),
                require('../../assets/images/BTCpay.jpg')
            ]
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
        let presetImageUri = Image.resolveAssetSource(item).uri;
        presetImageUri = presetImageUri
            .replace('.png', '')
            .replace('.jpg', '')
            .replace(/-/g, '')
            .replace(/\//g, '_')
            .toLowerCase();

        const splitDash = presetImageUri.split('_').reverse()[0];
        const split = splitDash.split('?')[0];

        const photo = `preset://${split}`;

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
                                    ...styles.avatarContainer,
                                    backgroundColor: themeColor('secondaryText')
                                }}
                            >
                                <Avatar
                                    rounded
                                    size={
                                        Dimensions.get('window').width / 3 - 20
                                    }
                                    source={
                                        typeof item === 'string'
                                            ? { uri: item } // If item is a URL, use { uri: item }
                                            : (item as ImageSourcePropType) // If it's an image object, cast it
                                    }
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
