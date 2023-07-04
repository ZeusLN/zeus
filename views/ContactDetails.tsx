import * as React from 'react';
import { Text, View, Image, StyleSheet } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import Button from '../components/Button';
import Screen from '../components/Screen';

import { themeColor } from '../utils/ThemeUtils';

interface ContactDetailsProps {
    navigation: any;
}

interface ContactItem {
    lnAddress: string;
    onchainAddress: string;
    nip05: string;
    nostrNpub: string;
    name: string;
    description: string;
    photo: string | null;
}
interface ContactDetailsState {
    contact: ContactItem;
}
export default class ContactDetails extends React.Component<
    ContactDetailsProps,
    ContactDetailsState
> {
    constructor(props: ContactDetailsProps) {
        super(props);
        const contact: ContactItem = this.props.navigation.getParam(
            'contact',
            null
        );

        this.state = {
            contact
        };
    }
    render() {
        const { contact } = this.state;
        const { navigation } = this.props;
        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => {
                    navigation.navigate('Settings', {
                        refresh: true
                    });
                }}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );
        return (
            <Screen>
                <Header
                    leftComponent={<BackButton />}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <View
                    style={{
                        backgroundColor: themeColor('background'),
                        alignItems: 'center',
                        marginTop: 60
                    }}
                >
                    {contact.photo && (
                        <Image
                            source={{ uri: contact.photo }}
                            style={{
                                width: 150,
                                height: 150,
                                borderRadius: 75,
                                marginBottom: 20
                            }}
                        />
                    )}
                    <Text
                        style={{
                            fontSize: 44,
                            fontWeight: 'bold',
                            marginBottom: 10,
                            color: 'white'
                        }}
                    >
                        {contact.name}
                    </Text>
                    <Text
                        style={{
                            fontSize: 20,
                            marginBottom: 6,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {contact.description}
                    </Text>
                    <Text style={styles.contactFields}>
                        {contact.lnAddress[0]}
                    </Text>
                    <Text style={styles.contactFields}>
                        {contact.onchainAddress[0]}
                    </Text>
                    <Text style={styles.contactFields}>{contact.nip05[0]}</Text>
                    <Text style={styles.contactFields}>
                        {contact.nostrNpub[0]}
                    </Text>
                </View>
                <Button
                    containerStyle={{ position: 'absolute', bottom: 30 }}
                    buttonStyle={{ padding: 18 }}
                    title="MAKE PAYMENT"
                    onPress={() => {
                        navigation.navigate('Send', {
                            destination: contact.onchainAddress[0]
                        });
                    }}
                />
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    contactFields: {
        fontSize: 20,
        marginBottom: 4,
        color: themeColor('chain')
    }
});
