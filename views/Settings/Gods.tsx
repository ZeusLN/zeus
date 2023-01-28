import * as React from 'react';
import { Dimensions, FlatList, Text, View } from 'react-native';
import { Avatar, Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Button from './../../components/Button';
import LoadingIndicator from './../../components/LoadingIndicator';

import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';
import UrlUtils from './../../utils/UrlUtils';

import SettingsStore from './../../stores/SettingsStore';

interface GodsProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

@inject('SettingsStore')
@observer
export default class Gods extends React.Component<GodsProps, {}> {
    UNSAFE_componentWillMount() {
        this.props.SettingsStore.fetchSponsors();
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { sponsorsError, gods, loading } = SettingsStore;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Gods.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                {loading && <LoadingIndicator />}
                {!loading && !sponsorsError && (
                    <>
                        <FlatList
                            data={gods.slice().reverse()}
                            renderItem={({ item }) => (
                                <ListItem
                                    containerStyle={{
                                        backgroundColor:
                                            themeColor('background'),
                                        padding: 0
                                    }}
                                    onPress={() =>
                                        UrlUtils.goToUrl(
                                            `https://${
                                                item.type === 'Twitter'
                                                    ? 'twitter.com/'
                                                    : 'iris.to/#/profile/'
                                            }${item.handle}`
                                        )
                                    }
                                >
                                    <Avatar
                                        size={
                                            Dimensions.get('window').width / 4 -
                                            13
                                        }
                                        rounded
                                        source={{
                                            uri: `https://zeusln.app/api/${
                                                item.type === 'Twitter'
                                                    ? 'twitter-images/'
                                                    : 'nostr-images/'
                                            }${item.handle}.jpg`
                                        }}
                                        key={1}
                                        containerStyle={{ margin: 5 }}
                                    />
                                </ListItem>
                            )}
                            numColumns={4}
                            keyExtractor={(item, index) => index}
                            style={{ alignSelf: 'center' }}
                        />
                        <Button
                            title={localeString(
                                'views.Olympians.becomeASponsor'
                            )}
                            containerStyle={{
                                margin: 10
                            }}
                            onPress={() =>
                                UrlUtils.goToUrl('https://zeusln.app/sponsor')
                            }
                        />
                    </>
                )}
                {sponsorsError && (
                    <Text
                        style={{
                            color: 'red',
                            margin: 10,
                            alignSelf: 'center',
                            fontSize: 20
                        }}
                    >
                        {sponsorsError}
                    </Text>
                )}
            </View>
        );
    }
}
