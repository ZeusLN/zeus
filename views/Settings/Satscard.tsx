import React from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { ButtonGroup, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import TextInput from '../../components/TextInput';

import Button from '../../components/Button';
import CollapsedQR from '../../components/CollapsedQR';
import KeyValue from '../../components/KeyValue';
import { ErrorMessage } from '../../components/SuccessErrorMessage';

import { CKTapCard } from 'cktap-protocol-react-native';

import ModalStore from '../../stores/ModalStore';
import SettingsStore from './../../stores/SettingsStore';

interface SatscardProps {
    navigation: any;
    ModalStore: ModalStore;
    SettingsStore: SettingsStore;
}

interface SatscardState {
    selectedIndex: number;
    card: CKTapCard;
    cardStatus: any;
    pubkey: string;
    privkey: string;
    tapsignerError: boolean;
    error: string;
    slotStatus: string;
    cvv: string;
    selectedSlot: number;
    selectedSlotIndex: number;
    selectedSlotStatus: string;
}

interface CardStatus {
    card_ident: string;
    active_slot: number;
    birth_height: number;
    is_tapsigner: boolean;
    applet_version: string;
    num_slots: number;
}

@inject('ModalStore', 'SettingsStore')
@observer
export default class Satscard extends React.Component<
    SatscardProps,
    SatscardState
> {
    constructor(props) {
        super(props);
        const card = new CKTapCard();
        this.state = {
            cvv: '',
            selectedIndex: 0,
            selectedSlot: 0,
            card,
            cardStatus: null,
            pubkey: '',
            privkey: '',
            slotStatus: '',
            tapsignerError: false,
            error: ''
        };
    }

    renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    render() {
        const { navigation, ModalStore } = this.props;
        const {
            cvv,
            card,
            cardStatus,
            pubkey,
            privkey,
            slotStatus,
            selectedIndex,
            tapsignerError,
            error,
            selectedSlot,
            selectedSlotIndex,
            selectedSlotStatus
        } = this.state;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() =>
                    navigation.navigate('Settings', {
                        refresh: true
                    })
                }
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        const infoButton = () => (
            <Text
                style={{
                    fontFamily: 'Lato-Regular',
                    color:
                        selectedIndex === 0
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                Info
            </Text>
        );

        const addressButton = () => (
            <Text
                style={{
                    fontFamily: 'Lato-Regular',
                    color:
                        selectedIndex === 1
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                Address
            </Text>
        );

        const slotButton = (index: number) => (
            <Text
                style={{
                    fontFamily: 'Lato-Regular',
                    color:
                        selectedSlot === index
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {index.toString()}
            </Text>
        );

        const ClearButton = () => (
            <Icon
                name="cancel"
                onPress={() =>
                    this.setState({
                        pubkey: '',
                        cardStatus: null,
                        error: ''
                    })
                }
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        const buttons = [{ element: infoButton }, { element: addressButton }];
        const slotButtons =
            cardStatus && cardStatus.num_slots
                ? [...Array(cardStatus.num_slots)].map((_, i) => {
                      return slotButton(i);
                  })
                : null;

        const awaitNfc = () => {
            // enable NFC
            if (Platform.OS === 'android') {
                ModalStore.toggleAndroidNfcModal(true);
            }

            this.setState({
                error: ''
            });
        };

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
                        text: 'Satscard',
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    rightComponent={cardStatus ? <ClearButton /> : null}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <ScrollView style={{ flex: 1, padding: 15 }}>
                    {tapsignerError && (
                        <ErrorMessage
                            message={localeString(
                                'views.Satscard.tapsignerNotSupported'
                            )}
                        />
                    )}
                    {error && (
                        <TouchableOpacity
                            onPress={() => this.setState({ error: '' })}
                        >
                            <ErrorMessage message={error} />
                        </TouchableOpacity>
                    )}
                    {cardStatus && (
                        <ButtonGroup
                            onPress={(selectedIndex: number) => {
                                this.setState({ selectedIndex });
                            }}
                            selectedIndex={selectedIndex}
                            buttons={buttons}
                            selectedButtonStyle={{
                                backgroundColor: themeColor('highlight'),
                                borderRadius: 12
                            }}
                            containerStyle={{
                                backgroundColor: themeColor('secondary'),
                                borderRadius: 12,
                                borderColor: themeColor('secondary')
                            }}
                            innerBorderStyle={{
                                color: themeColor('secondary')
                            }}
                        />
                    )}
                    {selectedIndex === 0 && cardStatus && (
                        <>
                            {false && (
                                <KeyValue
                                    keyValue="Card type"
                                    value={
                                        cardStatus.is_tapsigner
                                            ? 'Tapsigner'
                                            : 'Satscard'
                                    }
                                />
                            )}
                            <KeyValue
                                keyValue={localeString('general.id')}
                                value={cardStatus.card_ident}
                            />
                            <KeyValue
                                keyValue={localeString('general.version')}
                                value={cardStatus.applet_version}
                            />
                            <KeyValue
                                keyValue={localeString(
                                    'views.Satscard.birthHeight'
                                )}
                                value={cardStatus.birth_height}
                            />
                            <KeyValue
                                keyValue={localeString(
                                    'views.Satscard.totalSlots'
                                )}
                                value={cardStatus.num_slots}
                            />
                            <KeyValue
                                keyValue={localeString(
                                    'views.Satscard.activeSlot'
                                )}
                                value={cardStatus.active_slot}
                            />
                            <KeyValue
                                keyValue={localeString(
                                    'views.Satscard.slotStatus'
                                )}
                                value={slotStatus}
                            />
                            <TextInput
                                keyboardType="numeric"
                                placeholder="000000"
                                value={cvv}
                                onChangeText={(text: string) => {
                                    if (text.length === 7) return;
                                    this.setState({
                                        cvv: text
                                    });
                                }}
                            />
                            <Button
                                title={localeString('views.Satscard.unseal')}
                                onPress={async () => {
                                    try {
                                        awaitNfc();
                                        const { pk, target } =
                                            await card.nfcWrapper(async () => {
                                                // interact with the card here
                                                const res =
                                                    await card.unseal_slot(cvv); // scans the card for basic details and initialises with it
                                                if (Platform.OS === 'android') {
                                                    ModalStore.toggleAndroidNfcModal(
                                                        false
                                                    );
                                                }
                                                // return {
                                                //     pk,
                                                //     target
                                                // };
                                            });
                                    } catch (err) {
                                        // close NFC

                                        this.setState({
                                            error:
                                                err.error ||
                                                err.message ||
                                                err.toString()
                                        });
                                    }

                                    if (Platform.OS === 'android') {
                                        await card.endNfcSession();
                                        ModalStore.toggleAndroidNfcModal(false);
                                    }
                                }}
                            />
                        </>
                    )}
                    {cardStatus && selectedIndex === 1 && (
                        <View>
                            <View style={{ marginBottom: 20 }}>
                                <ButtonGroup
                                    onPress={async (index: number) => {
                                        this.setState({
                                            selectedSlot: index
                                        });
                                        try {
                                            awaitNfc();
                                            const { address, status, resp } =
                                                await card.nfcWrapper(
                                                    async () => {
                                                        const {
                                                            address,
                                                            status,
                                                            resp
                                                        } = await card.get_slot_usage(
                                                            index
                                                        );
                                                        return {
                                                            address,
                                                            status,
                                                            resp
                                                        };
                                                    }
                                                );
                                            this.setState({
                                                selectedSlotIndex: resp.slot,
                                                pubkey: address,
                                                selectedSlotStatus: status
                                            });
                                            if (Platform.OS === 'android') {
                                                ModalStore.toggleAndroidNfcModal(
                                                    false
                                                );
                                            }
                                        } catch (err) {
                                            this.setState({
                                                error:
                                                    err.error ||
                                                    err.message ||
                                                    err.toString()
                                            });
                                            if (Platform.OS === 'android') {
                                                ModalStore.toggleAndroidNfcModal(
                                                    false
                                                );
                                            }
                                        }

                                        if (Platform.OS === 'android')
                                            await card.endNfcSession();
                                    }}
                                    selectedIndex={selectedSlot}
                                    buttons={slotButtons}
                                    selectedButtonStyle={{
                                        backgroundColor:
                                            themeColor('highlight'),
                                        borderRadius: 12
                                    }}
                                    containerStyle={{
                                        backgroundColor:
                                            themeColor('secondary'),
                                        borderRadius: 12,
                                        borderColor: themeColor('secondary')
                                    }}
                                    innerBorderStyle={{
                                        color: themeColor('secondary')
                                    }}
                                />
                            </View>
                            {selectedSlot === selectedSlotIndex && (
                                <>
                                    <KeyValue
                                        keyValue="Status"
                                        value={selectedSlotStatus}
                                    />

                                    {pubkey && (
                                        <View style={{ marginTop: 10 }}>
                                            <CollapsedQR
                                                value={pubkey}
                                                expanded
                                            />
                                        </View>
                                    )}

                                    {selectedSlotStatus === 'UNUSED' &&
                                        cardStatus.active_slot ===
                                            selectedSlotIndex && (
                                            <View style={{ marginTop: 10 }}>
                                                <Button
                                                    title={localeString(
                                                        'views.Satscard.generateAddress'
                                                    )}
                                                    onPress={async () => {
                                                        try {
                                                            awaitNfc();
                                                            const address =
                                                                await card.nfcWrapper(
                                                                    async () => {
                                                                        const address =
                                                                            await card.setup(
                                                                                cvv
                                                                            );
                                                                        return address;
                                                                    }
                                                                );
                                                            if (address) {
                                                                this.setState({
                                                                    pubkey: address,
                                                                    selectedSlotStatus:
                                                                        'SEALED'
                                                                });
                                                            }
                                                        } catch (err) {
                                                            this.setState({
                                                                error:
                                                                    err.error ||
                                                                    err.message ||
                                                                    err.toString()
                                                            });
                                                            if (
                                                                Platform.OS ===
                                                                'android'
                                                            ) {
                                                                ModalStore.toggleAndroidNfcModal(
                                                                    false
                                                                );
                                                            }
                                                        }

                                                        await card.endNfcSession();
                                                        if (
                                                            Platform.OS ===
                                                            'android'
                                                        ) {
                                                            await card.endNfcSession();
                                                            ModalStore.toggleAndroidNfcModal(
                                                                false
                                                            );
                                                        }
                                                    }}
                                                />
                                            </View>
                                        )}
                                </>
                            )}
                        </View>
                    )}
                    {!cardStatus && (
                        <View style={styles.button}>
                            <Button
                                title={localeString('views.Satscard.load')}
                                onPress={async () => {
                                    try {
                                        awaitNfc();
                                        const {
                                            cardStatus,
                                            pubkey,
                                            slotStatus
                                        }: {
                                            cardStatus: CardStatus;
                                            pubkey: string;
                                            slotStatus: string;
                                        } = await card.nfcWrapper(async () => {
                                            // scans the card for basic details and initialises with it
                                            const cardStatus =
                                                await card.first_look();
                                            const { address, status } =
                                                await card.get_slot_usage(
                                                    cardStatus.active_slot
                                                );

                                            if (Platform.OS === 'android') {
                                                ModalStore.toggleAndroidNfcModal(
                                                    false
                                                );
                                            }

                                            return {
                                                cardStatus,
                                                pubkey: address,
                                                slotStatus: status
                                            };
                                        });
                                        if (cardStatus.is_tapsigner) {
                                            this.setState({
                                                tapsignerError: true
                                            });
                                        } else {
                                            this.setState({
                                                cardStatus,
                                                pubkey,
                                                slotStatus,
                                                tapsignerError: false,
                                                error: '',
                                                selectedSlot:
                                                    cardStatus.active_slot,
                                                selectedSlotIndex:
                                                    cardStatus.active_slot,
                                                selectedSlotStatus: slotStatus
                                            });

                                            if (Platform.OS === 'android') {
                                                ModalStore.toggleAndroidNfcModal(
                                                    false
                                                );
                                            }
                                        }
                                    } catch (err) {
                                        this.setState({
                                            error:
                                                err.error ||
                                                err.message ||
                                                err.toString()
                                        });
                                    }

                                    if (Platform.OS === 'android') {
                                        await card.endNfcSession();
                                        ModalStore.toggleAndroidNfcModal(false);
                                    }
                                }}
                            />
                        </View>
                    )}
                </ScrollView>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    button: {
        marginTop: 10
    }
});
