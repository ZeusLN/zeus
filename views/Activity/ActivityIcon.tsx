import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { inject, observer } from 'mobx-react';

import LightningSvg from '../../components/SVG/LightningSvg';
import OnChainSvg from '../../components/SVG/OnChainSvg';
import EcashSvg from '../../components/SVG/EcashSvg';
import Payment from '../../models/Payment';
import ContactStore from '../../stores/ContactStore';
import LnurlPayStore, { LnurlPayTransaction } from '../../stores/LnurlPayStore';
import { getActivityLayer } from '../../utils/ActivityIconUtils';
import {
    getActivityContactPhoto,
    getActivityLnurlImage
} from '../../utils/ActivityImageUtils';
import { themeColor } from '../../utils/ThemeUtils';

export type ActivityImageCache = Map<
    string,
    Promise<LnurlPayTransaction | undefined>
>;

interface Props {
    item: any;
    imageCache: ActivityImageCache;
    colorTheme: string;
    ContactStore?: ContactStore;
    LnurlPayStore?: LnurlPayStore;
}

const ActivityIcon = inject(
    'ContactStore',
    'LnurlPayStore'
)(
    observer(
        ({
            item,
            imageCache,
            colorTheme,
            ContactStore,
            LnurlPayStore
        }: Props) => {
            const hash =
                item instanceof Payment ? item.resolvedPaymentHash : '';
            const [history, setHistory] = useState<{
                hash: string;
                transaction?: LnurlPayTransaction;
            }>();
            const [failedImages, setFailedImages] = useState<string[]>([]);

            useEffect(() => {
                if (!hash || !LnurlPayStore) return;
                let active = true;
                let lookup = imageCache.get(hash);
                if (!lookup) {
                    lookup = LnurlPayStore.load(hash)
                        .then((transaction) => {
                            if (!transaction) imageCache.delete(hash);
                            return transaction || undefined;
                        })
                        .catch(() => {
                            imageCache.delete(hash);
                            return undefined;
                        });
                    imageCache.set(hash, lookup);
                }
                lookup.then((transaction) => {
                    if (active) setHistory({ hash, transaction });
                });
                return () => {
                    active = false;
                };
            }, [hash, imageCache, LnurlPayStore]);

            const transaction =
                history?.hash === hash ? history?.transaction : undefined;
            // Wait for history before matching pubkeys: an LNURL service can host many recipients.
            const contactPhoto =
                !hash || history?.hash === hash
                    ? getActivityContactPhoto(
                          item,
                          ContactStore?.contacts || [],
                          transaction
                      )
                    : undefined;
            const lnurlImage = getActivityLnurlImage(
                transaction?.metadata?.metadata
            );
            const uri = [contactPhoto, lnurlImage].find(
                (image): image is string =>
                    !!image && !failedImages.includes(image)
            );
            const layer = getActivityLayer(item);
            const color = themeColor(colorTheme);
            const LayerIcon =
                layer === 'onchain'
                    ? OnChainSvg
                    : layer === 'ecash'
                    ? EcashSvg
                    : LightningSvg;

            return (
                <View
                    accessible={false}
                    style={[styles.circle, { borderColor: color }]}
                >
                    <View
                        pointerEvents="none"
                        style={[
                            StyleSheet.absoluteFill,
                            styles.tint,
                            { backgroundColor: color, opacity: 0.1 }
                        ]}
                    />
                    {uri ? (
                        <>
                            <Image
                                key={uri}
                                source={{ uri }}
                                style={styles.image}
                                onError={() =>
                                    setFailedImages((images) => [
                                        ...images,
                                        uri
                                    ])
                                }
                                accessible={false}
                            />
                            <View
                                pointerEvents="none"
                                style={[
                                    styles.badge,
                                    {
                                        backgroundColor:
                                            themeColor('background'),
                                        borderColor: color
                                    }
                                ]}
                            >
                                <LayerIcon
                                    width={layer === 'ecash' ? 38 : 26}
                                    height={layer === 'ecash' ? 38 : 26}
                                    circle={false}
                                    color={color}
                                />
                            </View>
                        </>
                    ) : (
                        <LayerIcon
                            width={layer === 'ecash' ? 58 : 40}
                            height={layer === 'ecash' ? 58 : 40}
                            circle={false}
                            color={color}
                        />
                    )}
                </View>
            );
        }
    )
);

export default ActivityIcon;

const styles = StyleSheet.create({
    circle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
    },
    tint: {
        borderRadius: 19
    },
    badge: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
    },
    image: {
        width: 38,
        height: 38,
        borderRadius: 19
    }
});
