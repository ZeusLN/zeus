import * as React from 'react';
import {
    ScrollView,
    Text,
    View,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert
} from 'react-native';
import { CheckBox, Icon } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Amount from '../../components/Amount';
import AnimatedQRDisplay from '../../components/AnimatedQRDisplay';
import Button from '../../components/Button';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import {
    SuccessMessage,
    ErrorMessage,
    WarningMessage
} from '../../components/SuccessErrorMessage';

import CashuStore from '../../stores/CashuStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import { CDKProofWithY, CDKPreparedSend } from '../../cashu-cdk';

interface DenominationGroup {
    amount: number;
    count: number;
    total: number;
    proofs: CDKProofWithY[];
}

function groupByDenomination(proofs: CDKProofWithY[]): DenominationGroup[] {
    const map = new Map<number, CDKProofWithY[]>();
    for (const p of proofs) {
        const list = map.get(p.amount) || [];
        list.push(p);
        map.set(p.amount, list);
    }
    return Array.from(map.entries())
        .sort(([a], [b]) => b - a)
        .map(([amount, proofs]) => ({
            amount,
            count: proofs.length,
            total: amount * proofs.length,
            proofs
        }));
}

interface TokenVaultProps {
    navigation: NativeStackNavigationProp<any, any>;
    CashuStore: CashuStore;
    route: Route<'TokenVault', { mintUrl?: string }>;
}

interface TokenVaultState {
    loading: boolean;
    proofsByMint: { [mintUrl: string]: CDKProofWithY[] };
    expandedMint: string | null;
    expandedDenomination: string | null; // "mintUrl:amount"
    multiSelectMode: boolean;
    selectedProofs: { [mintUrl: string]: string[] }; // proof.y values
    showQR: boolean;
    qrTokenData: string;
    qrProofYs: string[];
    consolidating: boolean;
    preparedSend: CDKPreparedSend | null;
    successMessage: string;
    errorMessage: string;
}

@inject('CashuStore')
@observer
export default class TokenVault extends React.Component<
    TokenVaultProps,
    TokenVaultState
> {
    state: TokenVaultState = {
        loading: true,
        proofsByMint: {},
        expandedMint: null,
        expandedDenomination: null,
        multiSelectMode: false,
        selectedProofs: {},
        showQR: false,
        qrTokenData: '',
        qrProofYs: [],
        consolidating: false,
        preparedSend: null,
        successMessage: '',
        errorMessage: ''
    };

    focusListener: any = null;

    componentDidMount(): void {
        const { navigation, route } = this.props;
        this.focusListener = navigation.addListener('focus', this.loadProofs);
        this.loadProofs();

        if (route.params?.mintUrl) {
            this.setState({ expandedMint: route.params.mintUrl });
        }
    }

    componentWillUnmount(): void {
        if (this.focusListener) {
            this.focusListener();
        }
        // Cancel any pending consolidation to unlock proofs
        const { preparedSend } = this.state;
        if (preparedSend) {
            this.props.CashuStore.cancelConsolidation(preparedSend.id).catch(
                () => {}
            );
        }
    }

    loadProofs = async () => {
        const { CashuStore } = this.props;
        this.setState({ loading: true });

        const proofsByMint: { [mintUrl: string]: CDKProofWithY[] } = {};
        for (const mintUrl of CashuStore.mintUrls) {
            try {
                proofsByMint[mintUrl] = await CashuStore.getProofsByMint(
                    mintUrl
                );
            } catch (e) {
                console.error(
                    `TokenVault: Failed to load proofs for ${mintUrl}:`,
                    e
                );
                proofsByMint[mintUrl] = [];
            }
        }

        this.setState({ loading: false, proofsByMint });
    };

    toggleMint = (mintUrl: string) => {
        this.setState((prev) => ({
            expandedMint: prev.expandedMint === mintUrl ? null : mintUrl,
            expandedDenomination: null,
            multiSelectMode: false,
            selectedProofs: {}
        }));
    };

    toggleDenomination = (mintUrl: string, amount: number) => {
        const key = `${mintUrl}:${amount}`;
        this.setState((prev) => ({
            expandedDenomination: prev.expandedDenomination === key ? null : key
        }));
    };

    toggleMultiSelect = () => {
        this.setState((prev) => ({
            multiSelectMode: !prev.multiSelectMode,
            selectedProofs: {}
        }));
    };

    toggleProofSelection = (mintUrl: string, proofY: string) => {
        this.setState((prev) => {
            const selected = { ...prev.selectedProofs };
            const current = selected[mintUrl] || [];
            if (current.includes(proofY)) {
                selected[mintUrl] = current.filter((y) => y !== proofY);
            } else {
                selected[mintUrl] = [...current, proofY];
            }
            return { selectedProofs: selected };
        });
    };

    getSelectedCount = (mintUrl: string): number => {
        return this.state.selectedProofs[mintUrl]?.length || 0;
    };

    getSelectedProofs = (mintUrl: string): CDKProofWithY[] => {
        const { proofsByMint, selectedProofs } = this.state;
        const proofs = proofsByMint[mintUrl] || [];
        const yValues = selectedProofs[mintUrl];
        if (!yValues || yValues.length === 0) return [];
        return proofs.filter((p) => yValues.includes(p.y));
    };

    shareProofAsQR = (mintUrl: string, proof: CDKProofWithY) => {
        const { CashuStore } = this.props;
        const encoded = CashuStore.buildCashuToken(mintUrl, [proof]);
        this.setState({
            showQR: true,
            qrTokenData: encoded,
            qrProofYs: [proof.y]
        });
    };

    shareSelectedAsQR = (mintUrl: string) => {
        const { CashuStore } = this.props;
        const proofs = this.getSelectedProofs(mintUrl);
        if (proofs.length === 0) return;
        const encoded = CashuStore.buildCashuToken(mintUrl, proofs);
        this.setState({
            showQR: true,
            qrTokenData: encoded,
            qrProofYs: proofs.map((p) => p.y)
        });
    };

    confirmShared = async () => {
        const { CashuStore } = this.props;
        const { qrProofYs } = this.state;

        Alert.alert(
            localeString('cashu.tokenVault.confirmShared'),
            localeString('cashu.tokenVault.confirmSharedWarning'),
            [
                {
                    text: localeString('general.cancel'),
                    style: 'cancel'
                },
                {
                    text: localeString('cashu.tokenVault.confirmShared'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await CashuStore.removeSelectedProofs(qrProofYs);
                            this.setState({
                                showQR: false,
                                qrTokenData: '',
                                qrProofYs: [],
                                multiSelectMode: false,
                                selectedProofs: {},
                                successMessage: localeString(
                                    'cashu.tokenVault.shareSuccess'
                                )
                            });
                            await this.loadProofs();
                        } catch (e: any) {
                            this.setState({
                                errorMessage:
                                    e.message ||
                                    localeString('cashu.tokenVault.shareError')
                            });
                        }
                    }
                }
            ]
        );
    };

    cancelQR = () => {
        this.setState({
            showQR: false,
            qrTokenData: '',
            qrProofYs: []
        });
    };

    startConsolidation = async (mintUrl: string) => {
        const { CashuStore } = this.props;
        this.setState({
            consolidating: true,
            errorMessage: '',
            successMessage: ''
        });

        try {
            const prepared = await CashuStore.prepareConsolidation(mintUrl);
            this.setState({
                consolidating: false,
                preparedSend: prepared
            });
        } catch (e: any) {
            this.setState({
                consolidating: false,
                errorMessage:
                    e.message || localeString('cashu.consolidation.failure')
            });
        }
    };

    executeConsolidation = async () => {
        const { CashuStore } = this.props;
        const { preparedSend } = this.state;
        if (!preparedSend) return;

        this.setState({ consolidating: true });

        try {
            await CashuStore.executeConsolidation(preparedSend.id);
            this.setState({
                consolidating: false,
                preparedSend: null,
                successMessage: localeString('cashu.consolidation.success')
            });
            await this.loadProofs();
        } catch (e: any) {
            this.setState({
                consolidating: false,
                errorMessage:
                    e.message || localeString('cashu.consolidation.failure')
            });
        }
    };

    cancelConsolidation = async () => {
        const { CashuStore } = this.props;
        const { preparedSend } = this.state;
        if (preparedSend) {
            try {
                await CashuStore.cancelConsolidation(preparedSend.id);
            } catch (e) {
                // ignore cancel errors
            }
        }
        this.setState({
            preparedSend: null
        });
    };

    shortenMintUrl = (mintUrl: string): string => {
        try {
            const u = new URL(mintUrl);
            return u.hostname;
        } catch {
            return mintUrl.length > 30 ? mintUrl.slice(0, 30) + '...' : mintUrl;
        }
    };

    renderMintSection = (mintUrl: string) => {
        const { proofsByMint, expandedMint, multiSelectMode } = this.state;
        const { CashuStore } = this.props;

        const proofs = proofsByMint[mintUrl] || [];
        const isExpanded = expandedMint === mintUrl;
        const groups = groupByDenomination(proofs);
        const totalBalance = proofs.reduce((sum, p) => sum + p.amount, 0);

        return (
            <View key={mintUrl} style={styles.mintSection}>
                <TouchableOpacity
                    style={styles.mintHeader}
                    onPress={() => this.toggleMint(mintUrl)}
                >
                    <View style={{ flex: 1 }}>
                        <Text
                            style={[
                                styles.mintUrl,
                                { color: themeColor('text') }
                            ]}
                            numberOfLines={1}
                        >
                            {this.shortenMintUrl(mintUrl)}
                        </Text>
                        <Text
                            style={[
                                styles.mintSubtext,
                                { color: themeColor('secondaryText') }
                            ]}
                        >
                            {proofs.length}{' '}
                            {localeString('cashu.tokenVault.proofs')}
                        </Text>
                    </View>
                    <Amount sats={totalBalance} sensitive />
                    <Icon
                        name={
                            isExpanded
                                ? 'keyboard-arrow-up'
                                : 'keyboard-arrow-down'
                        }
                        color={themeColor('secondaryText')}
                        size={24}
                    />
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.mintContent}>
                        {proofs.length === 0 ? (
                            <Text
                                style={[
                                    styles.emptyText,
                                    { color: themeColor('secondaryText') }
                                ]}
                            >
                                {localeString('cashu.tokenVault.noProofs')}
                            </Text>
                        ) : (
                            <>
                                <View style={styles.selectRow}>
                                    <Text
                                        style={[
                                            styles.selectLabel,
                                            {
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }
                                        ]}
                                    >
                                        {localeString(
                                            'cashu.tokenVault.selectMode'
                                        )}
                                    </Text>
                                    <Switch
                                        value={multiSelectMode}
                                        onValueChange={this.toggleMultiSelect}
                                    />
                                </View>

                                {groups.map((group) =>
                                    this.renderDenominationGroup(mintUrl, group)
                                )}

                                {multiSelectMode &&
                                    this.getSelectedCount(mintUrl) > 0 && (
                                        <View style={styles.actionButton}>
                                            <Button
                                                title={`${localeString(
                                                    'cashu.tokenVault.shareSelected'
                                                )} (${this.getSelectedCount(
                                                    mintUrl
                                                )})`}
                                                onPress={() =>
                                                    this.shareSelectedAsQR(
                                                        mintUrl
                                                    )
                                                }
                                            />
                                        </View>
                                    )}

                                <View style={styles.actionButton}>
                                    <Button
                                        title={localeString(
                                            'cashu.consolidation.title'
                                        )}
                                        onPress={() =>
                                            this.startConsolidation(mintUrl)
                                        }
                                        disabled={CashuStore.isOffline}
                                        secondary
                                    />
                                </View>
                            </>
                        )}
                    </View>
                )}
            </View>
        );
    };

    renderDenominationGroup = (mintUrl: string, group: DenominationGroup) => {
        const { expandedDenomination, multiSelectMode, selectedProofs } =
            this.state;
        const denomKey = `${mintUrl}:${group.amount}`;
        const isExpanded = expandedDenomination === denomKey;

        return (
            <View key={denomKey} style={styles.denomSection}>
                <TouchableOpacity
                    style={styles.denomHeader}
                    onPress={() =>
                        this.toggleDenomination(mintUrl, group.amount)
                    }
                >
                    <Text
                        style={[
                            styles.denomText,
                            { color: themeColor('text') }
                        ]}
                    >
                        {group.amount} sats x {group.count} = {group.total} sats
                    </Text>
                    <Icon
                        name={
                            isExpanded
                                ? 'keyboard-arrow-up'
                                : 'keyboard-arrow-down'
                        }
                        color={themeColor('secondaryText')}
                        size={20}
                    />
                </TouchableOpacity>

                {isExpanded &&
                    group.proofs.map((proof) => {
                        const isSelected =
                            selectedProofs[mintUrl]?.includes(proof.y) || false;

                        return (
                            <TouchableOpacity
                                key={proof.y}
                                style={styles.proofRow}
                                onPress={() => {
                                    if (multiSelectMode) {
                                        this.toggleProofSelection(
                                            mintUrl,
                                            proof.y
                                        );
                                    }
                                }}
                            >
                                {multiSelectMode && (
                                    <CheckBox
                                        checked={isSelected}
                                        onPress={() =>
                                            this.toggleProofSelection(
                                                mintUrl,
                                                proof.y
                                            )
                                        }
                                        containerStyle={
                                            styles.checkboxContainer
                                        }
                                        checkedColor={themeColor('highlight')}
                                        uncheckedColor={themeColor(
                                            'secondaryText'
                                        )}
                                    />
                                )}
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={[
                                            styles.proofAmount,
                                            { color: themeColor('text') }
                                        ]}
                                    >
                                        {proof.amount} sats
                                    </Text>
                                    <Text
                                        style={[
                                            styles.proofId,
                                            {
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }
                                        ]}
                                        numberOfLines={1}
                                    >
                                        ...{proof.y.slice(-16)}
                                    </Text>
                                </View>
                                {!multiSelectMode && (
                                    <TouchableOpacity
                                        onPress={() =>
                                            this.shareProofAsQR(mintUrl, proof)
                                        }
                                        style={styles.qrButton}
                                    >
                                        <Icon
                                            name="qr-code"
                                            color={themeColor('highlight')}
                                            size={24}
                                        />
                                    </TouchableOpacity>
                                )}
                            </TouchableOpacity>
                        );
                    })}
            </View>
        );
    };

    renderQROverlay = () => {
        const { qrTokenData } = this.state;
        return (
            <View
                style={[
                    styles.overlay,
                    { backgroundColor: themeColor('background') }
                ]}
            >
                <Header
                    leftComponent="Back"
                    navigateBackOnBackPress={false}
                    onBack={this.cancelQR}
                    centerComponent={{
                        text: localeString('cashu.tokenVault.shareToken'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                />

                <View style={styles.qrContainer}>
                    <AnimatedQRDisplay
                        data={qrTokenData}
                        encoderType="generic"
                        fileType="U"
                        valuePrefix="cashu:"
                        copyValue={qrTokenData}
                    />
                </View>

                <View style={styles.qrActions}>
                    <WarningMessage
                        message={localeString(
                            'cashu.tokenVault.confirmSharedWarning'
                        )}
                    />
                    <View style={{ marginTop: 15 }}>
                        <Button
                            title={localeString(
                                'cashu.tokenVault.confirmShared'
                            )}
                            onPress={this.confirmShared}
                            warning
                        />
                    </View>
                    <View style={{ marginTop: 10 }}>
                        <Button
                            title={localeString('general.cancel')}
                            onPress={this.cancelQR}
                            secondary
                        />
                    </View>
                </View>
            </View>
        );
    };

    renderConsolidationConfirmation = () => {
        const { preparedSend, consolidating } = this.state;
        if (!preparedSend) return null;

        return (
            <View
                style={[
                    styles.consolidationCard,
                    { backgroundColor: themeColor('secondary') }
                ]}
            >
                <Text
                    style={[
                        styles.consolidationTitle,
                        { color: themeColor('text') }
                    ]}
                >
                    {localeString('cashu.consolidation.title')}
                </Text>
                <Text
                    style={[
                        styles.consolidationDesc,
                        { color: themeColor('secondaryText') }
                    ]}
                >
                    {localeString('cashu.consolidation.description')}
                </Text>

                <View style={styles.feeRow}>
                    <Text style={{ color: themeColor('secondaryText') }}>
                        {localeString('cashu.consolidation.fee')}
                    </Text>
                    <Text style={{ color: themeColor('text') }}>
                        {preparedSend.fee} sats
                    </Text>
                </View>
                <View style={styles.feeRow}>
                    <Text style={{ color: themeColor('secondaryText') }}>
                        {localeString('cashu.consolidation.amountAfterFee')}
                    </Text>
                    <Text style={{ color: themeColor('text') }}>
                        {preparedSend.amount - preparedSend.fee} sats
                    </Text>
                </View>

                {consolidating ? (
                    <ActivityIndicator
                        color={themeColor('highlight')}
                        style={{ marginTop: 15 }}
                    />
                ) : (
                    <View style={{ marginTop: 15 }}>
                        <Button
                            title={localeString('cashu.consolidation.confirm')}
                            onPress={this.executeConsolidation}
                        />
                        <View style={{ marginTop: 10 }}>
                            <Button
                                title={localeString(
                                    'cashu.consolidation.cancel'
                                )}
                                onPress={this.cancelConsolidation}
                                secondary
                            />
                        </View>
                    </View>
                )}
            </View>
        );
    };

    render() {
        const { navigation } = this.props;
        const { CashuStore } = this.props;
        const {
            loading,
            showQR,
            preparedSend,
            successMessage,
            errorMessage,
            consolidating
        } = this.state;

        if (showQR) {
            return <Screen>{this.renderQROverlay()}</Screen>;
        }

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('cashu.tokenVault.title'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />

                    {successMessage ? (
                        <SuccessMessage message={successMessage} dismissable />
                    ) : null}
                    {errorMessage ? (
                        <ErrorMessage message={errorMessage} dismissable />
                    ) : null}

                    {loading ? (
                        <LoadingIndicator />
                    ) : (
                        <ScrollView
                            contentContainerStyle={styles.scrollContent}
                        >
                            {preparedSend &&
                                this.renderConsolidationConfirmation()}

                            {consolidating && !preparedSend && (
                                <ActivityIndicator
                                    color={themeColor('highlight')}
                                    style={{ marginVertical: 20 }}
                                />
                            )}

                            {CashuStore.mintUrls.map((mintUrl) =>
                                this.renderMintSection(mintUrl)
                            )}
                        </ScrollView>
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    scrollContent: {
        padding: 15,
        paddingBottom: 40
    },
    mintSection: {
        marginBottom: 15,
        borderRadius: 10,
        overflow: 'hidden'
    },
    mintHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderRadius: 10
    },
    mintUrl: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book'
    },
    mintSubtext: {
        fontSize: 13,
        fontFamily: 'PPNeueMontreal-Book',
        marginTop: 2
    },
    mintContent: {
        paddingHorizontal: 15,
        paddingBottom: 15
    },
    selectRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        paddingVertical: 5
    },
    selectLabel: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book'
    },
    denomSection: {
        marginBottom: 5
    },
    denomHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 5
    },
    denomText: {
        fontSize: 15,
        fontFamily: 'PPNeueMontreal-Book'
    },
    proofRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 15,
        marginLeft: 10
    },
    proofAmount: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book'
    },
    proofId: {
        fontSize: 11,
        fontFamily: 'PPNeueMontreal-Book',
        marginTop: 2
    },
    qrButton: {
        padding: 8
    },
    checkboxContainer: {
        padding: 0,
        margin: 0,
        marginRight: 8,
        backgroundColor: 'transparent',
        borderWidth: 0
    },
    emptyText: {
        textAlign: 'center',
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book',
        paddingVertical: 20
    },
    actionButton: {
        marginTop: 15
    },
    overlay: {
        flex: 1
    },
    qrContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    qrActions: {
        padding: 20
    },
    consolidationCard: {
        borderRadius: 10,
        padding: 20,
        marginBottom: 15
    },
    consolidationTitle: {
        fontSize: 18,
        fontFamily: 'PPNeueMontreal-Book',
        marginBottom: 8
    },
    consolidationDesc: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book',
        marginBottom: 15
    },
    feeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 5
    }
});
