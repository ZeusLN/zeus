import React, { useState } from 'react';
import { TouchableOpacity } from 'react-native';

import stores from '../stores/Stores';

import { themeColor } from '../utils/ThemeUtils';

import LoadingIndicator from '../components/LoadingIndicator';
import NostrichNotLoaded from '../assets/images/SVG/Nostrich_not-loaded.svg';
import NostrichValid from '../assets/images/SVG/Nostrich_valid.svg';
import NostrichInvalid from '../assets/images/SVG/Nostrich_invalid.svg';
import NostrichNotFound from '../assets/images/SVG/Nostrich_not-found.svg';

export default function AttestationButton(props: any) {
    const { navigation, hash, amount_msat } = props;
    const [attestationStatus, setAttestationStatus] = useState('neutral');
    const [loading, setLoading] = useState(false);
    const [attestations, setAttestations] = useState([]);

    return (
        <TouchableOpacity
            onPress={async () => {
                if (attestationStatus === 'neutral') {
                    setLoading(true);
                    try {
                        const { attestations, status } =
                            await stores.lightningAddressStore.lookupAttestations(
                                hash,
                                amount_msat
                            );
                        setAttestations(attestations);
                        setAttestationStatus(status || '' || 'error');
                    } catch (error) {
                        console.error('Error fetching attestations:', error);
                        setAttestationStatus('error' || '');
                    } finally {
                        setLoading(false);
                    }
                } else {
                    if (attestationStatus === 'success') {
                        navigation.navigate('Attestation', {
                            attestation: attestations[0]
                        });
                    } else {
                        navigation.navigate('Attestations', {
                            attestations
                        });
                    }
                }
            }}
            style={{ marginRight: 15 }}
        >
            {loading ? (
                <LoadingIndicator size={32} />
            ) : attestationStatus === 'warning' ? (
                <NostrichNotFound fill="#FFC300" width={32} height={32} />
            ) : attestationStatus === 'neutral' ? (
                <NostrichNotLoaded
                    fill={themeColor('text')}
                    width={32}
                    height={32}
                />
            ) : attestationStatus === 'success' ? (
                <NostrichValid
                    fill={themeColor(attestationStatus)}
                    width={32}
                    height={32}
                />
            ) : (
                <NostrichInvalid
                    fill={themeColor(attestationStatus)}
                    width={32}
                    height={32}
                />
            )}
        </TouchableOpacity>
    );
}
