import * as React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { launchImageLibrary } from 'react-native-image-picker';

import AddIcon from '../../assets/images/SVG/Add.svg';

import Button from '../../components/Button';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import { ErrorMessage } from '../../components/SuccessErrorMessage';

import LightningAddressStore from '../../stores/LightningAddressStore';

const MAX_BIO_LENGTH = 500;

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface EditProfileProps {
    navigation: StackNavigationProp<any, any>;
    LightningAddressStore: LightningAddressStore;
}

interface EditProfileState {
    imageBase64: string | null;
    bio: string;
    currentImage: string | null;
    currentBio: string;
}

@inject('LightningAddressStore')
@observer
export default class EditProfile extends React.Component<
    EditProfileProps,
    EditProfileState
> {
    state = {
        imageBase64: this.props.LightningAddressStore.image,
        bio: this.props.LightningAddressStore.bio || '',
        currentImage: this.props.LightningAddressStore.image,
        currentBio: this.props.LightningAddressStore.bio || ''
    };

    selectPhoto = () => {
        launchImageLibrary(
            {
                mediaType: 'photo',
                quality: 1.0,
                maxWidth: 1024,
                maxHeight: 1024,
                includeBase64: true
            },
            (response: any) => {
                if (!response.didCancel && response.assets?.[0]?.base64) {
                    this.setState({
                        imageBase64: response.assets[0].base64
                    });
                }
            }
        );
    };

    clearImage = () => {
        this.setState({ imageBase64: '' });
    };

    hasChanges = () => {
        const { imageBase64, bio, currentImage, currentBio } = this.state;
        return imageBase64 !== currentImage || bio !== currentBio;
    };

    save = async () => {
        const { navigation, LightningAddressStore } = this.props;
        const { imageBase64, bio, currentImage, currentBio } = this.state;

        const updates: any = {};
        if (imageBase64 !== currentImage) {
            updates.image = imageBase64 || '';
        }
        if (bio !== currentBio) {
            updates.bio = bio || '';
        }

        try {
            await LightningAddressStore.update(updates);
            await LightningAddressStore.status();
            navigation.goBack();
        } catch (e) {
            // Error state is set by the store and displayed via ErrorMessage
        }
    };

    render() {
        const { navigation, LightningAddressStore } = this.props;
        const { imageBase64, bio } = this.state;
        const { loading, error_msg } = LightningAddressStore;

        const imageUri = imageBase64
            ? `data:image/png;base64,${imageBase64}`
            : null;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.LightningAddress.editProfile'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <View style={{ flex: 1, margin: 5 }}>
                        {loading && <LoadingIndicator />}
                        {!loading && !!error_msg && (
                            <ErrorMessage message={error_msg} dismissable />
                        )}
                        {!loading && (
                            <>
                                <View
                                    style={{
                                        flex: 1,
                                        paddingHorizontal: 15,
                                        paddingTop: 10
                                    }}
                                >
                                    <Text
                                        style={{
                                            ...styles.label,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.LightningAddress.profileImage'
                                        )}
                                    </Text>
                                    <View
                                        style={{
                                            alignItems: 'center',
                                            marginVertical: 15
                                        }}
                                    >
                                        <TouchableOpacity
                                            onPress={this.selectPhoto}
                                        >
                                            <View
                                                style={{
                                                    ...styles.photoContainer,
                                                    backgroundColor:
                                                        themeColor(
                                                            'secondaryText'
                                                        ),
                                                    borderColor:
                                                        themeColor('separator')
                                                }}
                                            >
                                                {imageUri ? (
                                                    <Image
                                                        source={{
                                                            uri: imageUri
                                                        }}
                                                        style={styles.photo}
                                                    />
                                                ) : (
                                                    <AddIcon
                                                        fill={themeColor(
                                                            'background'
                                                        )}
                                                        width="30"
                                                        height="30"
                                                        style={{
                                                            alignSelf: 'center'
                                                        }}
                                                    />
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                        {imageBase64 ? (
                                            <Button
                                                title={localeString(
                                                    'general.clear'
                                                )}
                                                onPress={this.clearImage}
                                                quaternary
                                                noUppercase
                                                containerStyle={{
                                                    marginTop: 10
                                                }}
                                            />
                                        ) : null}
                                    </View>

                                    <Text
                                        style={{
                                            ...styles.label,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.LightningAddress.bio'
                                        )}
                                    </Text>
                                    <TextInput
                                        value={bio}
                                        onChangeText={(text: string) =>
                                            this.setState({
                                                bio: text.slice(
                                                    0,
                                                    MAX_BIO_LENGTH
                                                )
                                            })
                                        }
                                        placeholder={localeString(
                                            'views.Settings.LightningAddress.bioPlaceholder'
                                        )}
                                        multiline
                                        autoCapitalize="sentences"
                                        autoCorrect={true}
                                        style={{ minHeight: 100 }}
                                    />
                                </View>
                                <View style={{ margin: 10, marginBottom: 15 }}>
                                    <Button
                                        title={localeString(
                                            'views.Settings.LightningAddress.saveProfile'
                                        )}
                                        onPress={this.save}
                                        disabled={!this.hasChanges()}
                                    />
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    label: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 16,
        marginBottom: 5
    },
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
        borderRadius: 64
    }
});
