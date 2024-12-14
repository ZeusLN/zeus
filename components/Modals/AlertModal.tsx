import React, { createRef } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from '../Button';
import ModalBox from '../ModalBox';

import AlertStore from '../../stores/AlertStore';
import ModalStore from '../../stores/ModalStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore from '../../stores/SettingsStore';

import { NEUTRINO_PING_THRESHOLD_MS } from '../../utils/LndMobileUtils';
import { localeString } from '../../utils/LocaleUtils';
import { restartNeeded } from '../../utils/RestartUtils';
import { themeColor } from '../../utils/ThemeUtils';

import NavigationService from '../../NavigationService';

interface AlertModalProps {
    AlertStore: AlertStore;
    ModalStore: ModalStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
}

@inject('AlertStore', 'ModalStore', 'NodeInfoStore', 'SettingsStore')
@observer
export default class AlertModal extends React.Component<AlertModalProps, {}> {
    render() {
        const { AlertStore, ModalStore, NodeInfoStore, SettingsStore } =
            this.props;
        const { showAlertModal, toggleAlertModal } = ModalStore;

        const peers: any[] = [];
        AlertStore.problematicNeutrinoPeers.forEach((peer) => {
            peers.push(
                `${peer.peer} (${peer.ms}${
                    typeof peer.ms === 'number' ? 'ms' : ''
                })`
            );
        });

        const ref = createRef<ModalBox>();

        return (
            <ModalBox
                isOpen={showAlertModal}
                style={{
                    backgroundColor: 'transparent',
                    minHeight: 200
                }}
                ref={ref}
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
                            backgroundColor: themeColor('secondary'),
                            borderRadius: 30,
                            padding: 30,
                            width: '100%',
                            shadowColor: '#000',
                            shadowOffset: {
                                width: 0,
                                height: 2
                            }
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Book',
                                color: themeColor('text'),
                                fontSize: 20,
                                marginBottom: 20
                            }}
                        >
                            {localeString('components.AlertModal.zeusDetected')}
                        </Text>

                        {AlertStore.zombieError && (
                            <>
                                <Text
                                    style={{
                                        ...styles.header,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'components.AlertModal.highZombieCount'
                                    )}{' '}
                                    (
                                    {NodeInfoStore.networkInfo.num_zombie_chans}
                                    )
                                </Text>

                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'components.AlertModal.zombieExplainer'
                                    )}
                                </Text>

                                <View style={styles.button}>
                                    <Button
                                        title={localeString(
                                            'components.AlertModal.resetEGS'
                                        )}
                                        onPress={async () => {
                                            await SettingsStore.updateSettings({
                                                expressGraphSync: true,
                                                resetExpressGraphSyncOnStartup:
                                                    true
                                            });
                                            restartNeeded();
                                        }}
                                        tertiary
                                    />
                                </View>
                            </>
                        )}

                        {AlertStore.neutrinoPeerError && (
                            <>
                                <Text
                                    style={{
                                        ...styles.header,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'components.AlertModal.neutrinoPeers'
                                    )}{' '}
                                    (
                                    {AlertStore.problematicNeutrinoPeers.length}
                                    )
                                </Text>

                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('text')
                                    }}
                                >
                                    {`${localeString(
                                        'components.AlertModal.neutrinoExplainer'
                                    )} (>${NEUTRINO_PING_THRESHOLD_MS}ms)`}
                                </Text>

                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('text')
                                    }}
                                >
                                    {peers.join(', ')}
                                </Text>

                                <View style={styles.button}>
                                    <Button
                                        title={localeString(
                                            'components.AlertModal.reviewPeers'
                                        )}
                                        onPress={() => {
                                            toggleAlertModal(false);
                                            NavigationService.navigate(
                                                'NeutrinoPeers'
                                            );
                                        }}
                                        tertiary
                                    />
                                </View>
                            </>
                        )}

                        <Button
                            title={localeString('general.close')}
                            onPress={() => toggleAlertModal(false)}
                            secondary
                        />
                    </View>
                </View>
            </ModalBox>
        );
    }
}

const styles = StyleSheet.create({
    header: {
        fontFamily: 'PPNeueMontreal-Book',
        fontWeight: 'bold',
        fontSize: 20,
        marginBottom: 15
    },
    text: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 20,
        marginBottom: 10
    },
    button: {
        width: '100%',
        alignItems: 'center',
        marginVertical: 20
    }
});
