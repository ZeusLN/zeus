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

interface SelectNodeProfileProps {
    navigation: any;
}

interface SelectNodeProfileState {
    images: string[];
    photo: string | null;
}

export default class SelectNodeProfile extends React.Component<
    SelectNodeProfileProps,
    SelectNodeProfileState
> {
    constructor(props: SelectNodeProfileProps) {
        super(props);
        this.state = {
            images: [
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
            ],
            photo: null
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

    render() {
        const { navigation } = this.props;
        const { photo } = this.state;
        console.log(photo);

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
                        text: 'Select Profile Picture',
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
                                    source={this.getPhoto(photo)}
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
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => this.setState({ photo: item })}
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
                        alignItems: 'center',
                        paddingVertical: 20
                    }}
                />

                <Button title="Upload picture" />
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
