import * as React from 'react';
import { View } from 'react-native';
import Identicon from 'identicon.js';
import { sha1 } from '@noble/hashes/legacy';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { SvgXml } from 'react-native-svg';

import Base64Utils from './../utils/Base64Utils';
import PrivacyUtils from './../utils/PrivacyUtils';

export const NodeTitle = (selectedNode: any, overrideSensitivity = false) => {
    const displayName =
        selectedNode && selectedNode.nickname
            ? selectedNode.nickname
            : selectedNode && selectedNode.implementation === 'lndhub'
            ? selectedNode.lndhubUrl
                  .replace('https://', '')
                  .replace('http://', '')
            : selectedNode && selectedNode.url
            ? selectedNode.url.replace('https://', '').replace('http://', '')
            : selectedNode && selectedNode.port
            ? `${selectedNode.host}:${selectedNode.port}`
            : (selectedNode && selectedNode.host) || 'Unknown';

    return overrideSensitivity
        ? displayName
        : PrivacyUtils.sensitiveValue({ input: displayName, fixedLength: 8 });
};

export default function NodeIdenticon({
    selectedNode,
    width,
    rounded
}: {
    selectedNode: any;
    width?: number;
    rounded?: boolean;
}) {
    // Build hash from stable connection identity fields so the identicon
    // doesn't change when the user edits the nickname.
    const stableIdentity = (() => {
        if (!selectedNode) {
            return 'unknown';
        }
        switch (selectedNode.implementation) {
            case 'lndhub':
                return `lndhub-${selectedNode.lndhubUrl || ''}-${
                    selectedNode.username || ''
                }`;
            case 'nostr-wallet-connect':
                return `nwc-${selectedNode.nostrWalletConnectUrl || ''}`;
            case 'embedded-lnd':
                return `embedded-lnd-${selectedNode.lndDir || 'lnd'}`;
            case 'ldk-node':
                return `ldk-node-${selectedNode.ldkNodeDir || 'ldk'}`;
            default:
                return selectedNode.url
                    ? `${selectedNode.implementation || ''}-${selectedNode.url}`
                    : `${selectedNode.implementation || ''}-${
                          selectedNode.host || ''
                      }:${selectedNode.port || ''}`;
        }
    })();

    const data = new Identicon(
        bytesToHex(
            sha1(
                utf8ToBytes(`string:${stableIdentity.length}:${stableIdentity}`)
            )
        ),
        // @ts-ignore:next-line
        {
            background: [255, 255, 255, 255],
            size: width,
            format: 'svg'
        }
    ).toString();

    return (
        <View style={{ borderRadius: rounded ? width : 0, overflow: 'hidden' }}>
            <SvgXml xml={Base64Utils.base64ToUtf8(data)} />
        </View>
    );
}
