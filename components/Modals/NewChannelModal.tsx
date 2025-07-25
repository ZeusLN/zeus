import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';

import Text from '../../components/Text';
import { Row } from '../../components/layout/Row';
import ModalBox from '../ModalBox';

import ModalStore from '../../stores/ModalStore';
import NodeInfoStore from '../../stores/NodeInfoStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

import Olympus from '../../assets/images/SVG/Olympus.svg';
import OnChain from '../../assets/images/SVG//OnChain.svg';

import NavigationService from '../../NavigationService';

interface NewChannelModalProps {
    ModalStore: ModalStore;
    NodeInfoStore: NodeInfoStore;
}

@inject('ModalStore', 'NodeInfoStore')
@observer
export default class NewChannelModal extends React.Component<
    NewChannelModalProps,
    {}
> {
    render() {
        const { ModalStore, NodeInfoStore } = this.props;
        const {
            showNewChannelModal,
            toggleNewChannelModal,
            closeVisibleModalDialog
        } = ModalStore;

        const supportsLSPS1 =
            BackendUtils.supportsLSPScustomMessage() ||
            BackendUtils.supportsLSPS1rest();

        const { flowLspNotConfigured } = NodeInfoStore.flowLspNotConfigured();
        const supportsFlow =
            BackendUtils.supportsFlowLSP() && !flowLspNotConfigured;

        return (
            <ModalBox
                style={{
                    ...styles.modal,
                    backgroundColor: themeColor('background'),
                    height: supportsFlow ? 325 : 250
                }}
                swipeToClose={true}
                backButtonClose={true}
                backdropPressToClose={true}
                backdrop={true}
                position="bottom"
                isOpen={showNewChannelModal}
                onClosed={() => toggleNewChannelModal()}
            >
                <View>
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            color: themeColor('text'),
                            fontSize: 16,
                            paddingTop: 24,
                            paddingBottom: 12
                        }}
                    >
                        {localeString('components.NewChannelModal.title')}
                    </Text>
                    {supportsFlow && (
                        <Row justify="center">
                            <TouchableOpacity
                                key="jit"
                                onPress={async () => {
                                    NavigationService.navigate('Receive');
                                    closeVisibleModalDialog();
                                }}
                                style={{
                                    ...styles.option,
                                    backgroundColor: themeColor('secondary'),
                                    width: '88%',
                                    marginRight: '2%'
                                }}
                            >
                                <Row>
                                    <View style={{ marginRight: 15 }}>
                                        <Olympus fill={themeColor('text')} />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.optionLabel,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'components.NewChannelModal.jit'
                                        )}
                                    </Text>
                                </Row>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    closeVisibleModalDialog();
                                    ModalStore.toggleInfoModal({
                                        title: localeString(
                                            'components.NewChannelModal.jit'
                                        ),
                                        text: [
                                            localeString(
                                                'components.NewChannelModal.jit.info1'
                                            ),
                                            localeString(
                                                'components.NewChannelModal.jit.info2'
                                            )
                                        ],
                                        buttons: [
                                            {
                                                title: localeString(
                                                    'cashu.upgradePrompt.purchaseChannel'
                                                ),
                                                callback: () => {
                                                    ModalStore.toggleInfoModal(
                                                        {}
                                                    ); // Close current modal first
                                                    NavigationService.navigate(
                                                        'Receive'
                                                    );
                                                }
                                            },
                                            {
                                                title: localeString(
                                                    'components.NewChannelModal.learnMore'
                                                ),
                                                callback: () => {
                                                    ModalStore.toggleInfoModal(
                                                        {}
                                                    ); // Close current modal first
                                                    UrlUtils.goToUrl(
                                                        'https://docs.zeusln.app/lsp/channel-differences/'
                                                    );
                                                }
                                            },
                                            {
                                                title: localeString(
                                                    'views.LspExplanation.buttonText'
                                                ),
                                                callback: () => {
                                                    ModalStore.toggleInfoModal(
                                                        {}
                                                    ); // Close current modal first
                                                    UrlUtils.goToUrl(
                                                        'https://bitcoin.design/guide/how-it-works/liquidity/'
                                                    );
                                                }
                                            }
                                        ]
                                    });
                                }}
                                style={styles.infoIcon}
                            >
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontWeight: 'bold',
                                        fontSize: 25,
                                        textAlign: 'center',
                                        includeFontPadding: false
                                    }}
                                >
                                    {'ⓘ'}
                                </Text>
                            </TouchableOpacity>
                        </Row>
                    )}
                    {supportsLSPS1 && (
                        <Row>
                            <TouchableOpacity
                                key="lsps1"
                                onPress={async () => {
                                    NavigationService.navigate('LSPS1');
                                    closeVisibleModalDialog();
                                }}
                                style={{
                                    ...styles.option,
                                    backgroundColor: themeColor('secondary'),
                                    width: '88%',
                                    marginRight: '2%'
                                }}
                            >
                                <Row>
                                    <View style={{ marginRight: 15 }}>
                                        <Olympus fill={themeColor('text')} />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.optionLabel,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'components.NewChannelModal.lsps1'
                                        )}
                                    </Text>
                                </Row>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    closeVisibleModalDialog();
                                    ModalStore.toggleInfoModal({
                                        title: localeString(
                                            'components.NewChannelModal.lsps1'
                                        ),
                                        text: [
                                            localeString(
                                                'components.NewChannelModal.lsps1.info1'
                                            ),
                                            localeString(
                                                'components.NewChannelModal.lsps1.info2'
                                            )
                                        ],
                                        buttons: [
                                            {
                                                title: localeString(
                                                    'cashu.upgradePrompt.purchaseChannel'
                                                ),
                                                callback: () => {
                                                    ModalStore.toggleInfoModal(
                                                        {}
                                                    ); // Close current modal first
                                                    NavigationService.navigate(
                                                        'LSPS1'
                                                    );
                                                }
                                            },
                                            {
                                                title: localeString(
                                                    'components.NewChannelModal.learnMore'
                                                ),
                                                callback: () => {
                                                    ModalStore.toggleInfoModal(
                                                        {}
                                                    ); // Close current modal first
                                                    UrlUtils.goToUrl(
                                                        'https://docs.zeusln.app/lsp/channel-differences/'
                                                    );
                                                }
                                            },
                                            {
                                                title: localeString(
                                                    'views.LspExplanation.buttonText'
                                                ),
                                                callback: () => {
                                                    ModalStore.toggleInfoModal(
                                                        {}
                                                    ); // Close current modal first
                                                    UrlUtils.goToUrl(
                                                        'https://bitcoin.design/guide/how-it-works/liquidity/'
                                                    );
                                                }
                                            }
                                        ]
                                    });
                                }}
                                style={styles.infoIcon}
                            >
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontWeight: 'bold',
                                        fontSize: 25,
                                        textAlign: 'center',
                                        includeFontPadding: false
                                    }}
                                >
                                    {'ⓘ'}
                                </Text>
                            </TouchableOpacity>
                        </Row>
                    )}
                    <Row>
                        <TouchableOpacity
                            key="on-chain"
                            onPress={async () => {
                                NavigationService.navigate('OpenChannel');
                                closeVisibleModalDialog();
                            }}
                            style={{
                                ...styles.option,
                                backgroundColor: themeColor('secondary'),
                                width: '88%',
                                marginRight: '2%'
                            }}
                        >
                            <Row>
                                <View
                                    style={{ marginLeft: 4, marginRight: 18 }}
                                >
                                    <OnChain
                                        width={30}
                                        height={30}
                                        fill={themeColor('text')}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.optionLabel,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'components.NewChannelModal.onchain'
                                    )}
                                </Text>
                            </Row>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                closeVisibleModalDialog();
                                ModalStore.toggleInfoModal({
                                    title: localeString(
                                        'components.NewChannelModal.onchain'
                                    ),
                                    text: [
                                        localeString(
                                            'components.NewChannelModal.onchain.info1'
                                        ),
                                        localeString(
                                            'components.NewChannelModal.onchain.info2'
                                        )
                                    ],
                                    buttons: [
                                        {
                                            title: localeString(
                                                'views.Wallet.Channels.open'
                                            ),
                                            callback: () => {
                                                ModalStore.toggleInfoModal({}); // Close current modal first
                                                NavigationService.navigate(
                                                    'OpenChannel'
                                                );
                                            }
                                        },
                                        {
                                            title: localeString(
                                                'components.NewChannelModal.learnMore'
                                            ),
                                            callback: () => {
                                                ModalStore.toggleInfoModal({}); // Close current modal first
                                                UrlUtils.goToUrl(
                                                    'https://docs.zeusln.app/lsp/channel-differences/'
                                                );
                                            }
                                        },
                                        {
                                            title: localeString(
                                                'views.LspExplanation.buttonText'
                                            ),
                                            callback: () => {
                                                ModalStore.toggleInfoModal({}); // Close current modal first
                                                UrlUtils.goToUrl(
                                                    'https://bitcoin.design/guide/how-it-works/liquidity/'
                                                );
                                            }
                                        }
                                    ]
                                });
                            }}
                            style={styles.infoIcon}
                        >
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontWeight: 'bold',
                                    fontSize: 25,
                                    textAlign: 'center',
                                    includeFontPadding: false
                                }}
                            >
                                {'ⓘ'}
                            </Text>
                        </TouchableOpacity>
                    </Row>
                </View>
            </ModalBox>
        );
    }
}

const styles = StyleSheet.create({
    modal: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingLeft: 24,
        paddingRight: 24
    },
    option: {
        borderRadius: 5,
        padding: 16,
        marginTop: 12,
        marginBottom: 12,
        height: 58,
        width: '90%'
    },
    optionLabel: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 18
    },
    infoIcon: {
        width: '10%',
        justifyContent: 'center',
        alignItems: 'center'
    }
});
