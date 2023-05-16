import * as React from 'react';
import { View } from 'react-native';
import Identicon from 'identicon.js';
import { SvgXml } from 'react-native-svg';

import Base64Utils from './../utils/Base64Utils';
import PrivacyUtils from './../utils/PrivacyUtils';
import { Implementation } from '../enums';

const hash = require('object-hash');

export const NodeTitle = (
    selectedNode: any,
    maxLength = 24,
    overrideSensitivity = false
) => {
    const displayName =
        selectedNode && selectedNode.nickname
            ? selectedNode.nickname
            : selectedNode &&
              selectedNode.implementation === Implementation.lndhub
            ? selectedNode.lndhubUrl
                  .replace('https://', '')
                  .replace('http://', '')
            : selectedNode && selectedNode.url
            ? selectedNode.url.replace('https://', '').replace('http://', '')
            : selectedNode && selectedNode.port
            ? `${selectedNode.host}:${selectedNode.port}`
            : (selectedNode && selectedNode.host) || 'Unknown';

    const title = overrideSensitivity
        ? displayName
        : PrivacyUtils.sensitiveValue(displayName, 8);
    return title.length > maxLength
        ? title.substring(0, maxLength - 3) + '...'
        : title;
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
    const title = NodeTitle(selectedNode, 24, true);

    const data = new Identicon(
        hash.sha1(
            selectedNode &&
                selectedNode.implementation === Implementation.lndhub
                ? `${title}-${selectedNode.username}`
                : title
        ),
        {
            background: [255, 255, 255, 255],
            size: width,
            format: 'svg'
        }
    ).toString();

    return (
        <View style={{ borderRadius: rounded ? width : 0, overflow: 'hidden' }}>
            <SvgXml xml={Base64Utils.atob(data)} />
        </View>
    );
}
