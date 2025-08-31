import { base32 } from '@scure/base';
import pako from 'pako';

export const FILETYPE_NAMES = {
    P: 'PSBT',
    T: 'Transaction',
    J: 'JSON',
    U: 'Unicode Text',
    X: 'Executable',
    B: 'Binary'
} as const;

export const FILETYPES = new Set(Object.keys(FILETYPE_NAMES));

export const QR_DATA_CAPACITY = {
    1: {
        L: { 0: 152, 1: 41, 2: 25, 4: 17, 8: 10 },
        M: { 0: 128, 1: 34, 2: 20, 4: 14, 8: 8 },
        Q: { 0: 104, 1: 27, 2: 16, 4: 11, 8: 7 },
        H: { 0: 72, 1: 17, 2: 10, 4: 7, 8: 4 }
    },
    2: {
        L: { 0: 272, 1: 77, 2: 47, 4: 32, 8: 20 },
        M: { 0: 224, 1: 63, 2: 38, 4: 26, 8: 16 },
        Q: { 0: 176, 1: 48, 2: 29, 4: 20, 8: 12 },
        H: { 0: 128, 1: 34, 2: 20, 4: 14, 8: 8 }
    },
    3: {
        L: { 0: 440, 1: 127, 2: 77, 4: 53, 8: 32 },
        M: { 0: 352, 1: 101, 2: 61, 4: 42, 8: 26 },
        Q: { 0: 272, 1: 77, 2: 47, 4: 32, 8: 20 },
        H: { 0: 208, 1: 58, 2: 35, 4: 24, 8: 15 }
    },
    4: {
        L: { 0: 640, 1: 187, 2: 114, 4: 78, 8: 48 },
        M: { 0: 512, 1: 149, 2: 90, 4: 62, 8: 38 },
        Q: { 0: 384, 1: 111, 2: 67, 4: 46, 8: 28 },
        H: { 0: 288, 1: 82, 2: 50, 4: 34, 8: 21 }
    },
    5: {
        L: { 0: 864, 1: 255, 2: 154, 4: 106, 8: 65 },
        M: { 0: 688, 1: 202, 2: 122, 4: 84, 8: 52 },
        Q: { 0: 496, 1: 144, 2: 87, 4: 60, 8: 37 },
        H: { 0: 368, 1: 106, 2: 64, 4: 44, 8: 27 }
    },
    6: {
        L: { 0: 1088, 1: 322, 2: 195, 4: 134, 8: 82 },
        M: { 0: 864, 1: 255, 2: 154, 4: 106, 8: 65 },
        Q: { 0: 608, 1: 178, 2: 108, 4: 74, 8: 45 },
        H: { 0: 480, 1: 139, 2: 84, 4: 58, 8: 36 }
    },
    7: {
        L: { 0: 1248, 1: 370, 2: 224, 4: 154, 8: 95 },
        M: { 0: 992, 1: 293, 2: 178, 4: 122, 8: 75 },
        Q: { 0: 704, 1: 207, 2: 125, 4: 86, 8: 53 },
        H: { 0: 528, 1: 154, 2: 93, 4: 64, 8: 39 }
    },
    8: {
        L: { 0: 1552, 1: 461, 2: 279, 4: 192, 8: 118 },
        M: { 0: 1232, 1: 365, 2: 221, 4: 152, 8: 93 },
        Q: { 0: 880, 1: 259, 2: 157, 4: 108, 8: 66 },
        H: { 0: 688, 1: 202, 2: 122, 4: 84, 8: 52 }
    },
    9: {
        L: { 0: 1856, 1: 552, 2: 335, 4: 230, 8: 141 },
        M: { 0: 1456, 1: 432, 2: 262, 4: 180, 8: 111 },
        Q: { 0: 1056, 1: 312, 2: 189, 4: 130, 8: 80 },
        H: { 0: 800, 1: 235, 2: 143, 4: 98, 8: 60 }
    },
    10: {
        L: { 0: 2192, 1: 652, 2: 395, 4: 271, 8: 167 },
        M: { 0: 1728, 1: 513, 2: 311, 4: 213, 8: 131 },
        Q: { 0: 1232, 1: 364, 2: 221, 4: 151, 8: 93 },
        H: { 0: 976, 1: 288, 2: 174, 4: 119, 8: 74 }
    },
    11: {
        L: { 0: 2592, 1: 772, 2: 468, 4: 321, 8: 198 },
        M: { 0: 2032, 1: 604, 2: 366, 4: 251, 8: 155 },
        Q: { 0: 1440, 1: 427, 2: 259, 4: 177, 8: 109 },
        H: { 0: 1120, 1: 331, 2: 200, 4: 137, 8: 85 }
    },
    12: {
        L: { 0: 2960, 1: 883, 2: 535, 4: 367, 8: 226 },
        M: { 0: 2320, 1: 691, 2: 419, 4: 287, 8: 177 },
        Q: { 0: 1648, 1: 489, 2: 296, 4: 203, 8: 125 },
        H: { 0: 1264, 1: 374, 2: 227, 4: 155, 8: 96 }
    },
    13: {
        L: { 0: 3424, 1: 1022, 2: 619, 4: 425, 8: 262 },
        M: { 0: 2672, 1: 796, 2: 483, 4: 331, 8: 204 },
        Q: { 0: 1952, 1: 580, 2: 352, 4: 241, 8: 149 },
        H: { 0: 1440, 1: 427, 2: 259, 4: 177, 8: 109 }
    },
    14: {
        L: { 0: 3688, 1: 1101, 2: 667, 4: 458, 8: 282 },
        M: { 0: 2920, 1: 871, 2: 528, 4: 362, 8: 223 },
        Q: { 0: 2088, 1: 621, 2: 376, 4: 258, 8: 159 },
        H: { 0: 1576, 1: 468, 2: 283, 4: 194, 8: 120 }
    },
    15: {
        L: { 0: 4184, 1: 1250, 2: 758, 4: 520, 8: 320 },
        M: { 0: 3320, 1: 991, 2: 600, 4: 412, 8: 254 },
        Q: { 0: 2360, 1: 703, 2: 426, 4: 292, 8: 180 },
        H: { 0: 1784, 1: 530, 2: 321, 4: 220, 8: 136 }
    },
    16: {
        L: { 0: 4712, 1: 1408, 2: 854, 4: 586, 8: 361 },
        M: { 0: 3624, 1: 1082, 2: 656, 4: 450, 8: 277 },
        Q: { 0: 2600, 1: 775, 2: 470, 4: 322, 8: 198 },
        H: { 0: 2024, 1: 602, 2: 365, 4: 250, 8: 154 }
    },
    17: {
        L: { 0: 5176, 1: 1548, 2: 938, 4: 644, 8: 397 },
        M: { 0: 4056, 1: 1212, 2: 734, 4: 504, 8: 310 },
        Q: { 0: 2936, 1: 876, 2: 531, 4: 364, 8: 224 },
        H: { 0: 2264, 1: 674, 2: 408, 4: 280, 8: 173 }
    },
    18: {
        L: { 0: 5768, 1: 1725, 2: 1046, 4: 718, 8: 442 },
        M: { 0: 4504, 1: 1346, 2: 816, 4: 560, 8: 345 },
        Q: { 0: 3176, 1: 948, 2: 574, 4: 394, 8: 243 },
        H: { 0: 2504, 1: 746, 2: 452, 4: 310, 8: 191 }
    },
    19: {
        L: { 0: 6360, 1: 1903, 2: 1153, 4: 792, 8: 488 },
        M: { 0: 5016, 1: 1500, 2: 909, 4: 624, 8: 384 },
        Q: { 0: 3560, 1: 1063, 2: 644, 4: 442, 8: 272 },
        H: { 0: 2728, 1: 813, 2: 493, 4: 338, 8: 208 }
    },
    20: {
        L: { 0: 6888, 1: 2061, 2: 1249, 4: 858, 8: 528 },
        M: { 0: 5352, 1: 1600, 2: 970, 4: 666, 8: 410 },
        Q: { 0: 3880, 1: 1159, 2: 702, 4: 482, 8: 297 },
        H: { 0: 3080, 1: 919, 2: 557, 4: 382, 8: 235 }
    },
    21: {
        L: { 0: 7456, 1: 2232, 2: 1352, 4: 929, 8: 572 },
        M: { 0: 5712, 1: 1708, 2: 1035, 4: 711, 8: 438 },
        Q: { 0: 4096, 1: 1224, 2: 742, 4: 509, 8: 314 },
        H: { 0: 3248, 1: 969, 2: 587, 4: 403, 8: 248 }
    },
    22: {
        L: { 0: 8048, 1: 2409, 2: 1460, 4: 1003, 8: 618 },
        M: { 0: 6256, 1: 1872, 2: 1134, 4: 779, 8: 480 },
        Q: { 0: 4544, 1: 1358, 2: 823, 4: 565, 8: 348 },
        H: { 0: 3536, 1: 1056, 2: 640, 4: 439, 8: 270 }
    },
    23: {
        L: { 0: 8752, 1: 2620, 2: 1588, 4: 1091, 8: 672 },
        M: { 0: 6880, 1: 2059, 2: 1248, 4: 857, 8: 528 },
        Q: { 0: 4912, 1: 1468, 2: 890, 4: 611, 8: 376 },
        H: { 0: 3712, 1: 1108, 2: 672, 4: 461, 8: 284 }
    },
    24: {
        L: { 0: 9392, 1: 2812, 2: 1704, 4: 1171, 8: 721 },
        M: { 0: 7312, 1: 2188, 2: 1326, 4: 911, 8: 561 },
        Q: { 0: 5312, 1: 1588, 2: 963, 4: 661, 8: 407 },
        H: { 0: 4112, 1: 1228, 2: 744, 4: 511, 8: 315 }
    },
    25: {
        L: { 0: 10208, 1: 3057, 2: 1853, 4: 1273, 8: 784 },
        M: { 0: 8000, 1: 2395, 2: 1451, 4: 997, 8: 614 },
        Q: { 0: 5744, 1: 1718, 2: 1041, 4: 715, 8: 440 },
        H: { 0: 4304, 1: 1286, 2: 779, 4: 535, 8: 330 }
    },
    26: {
        L: { 0: 10960, 1: 3283, 2: 1990, 4: 1367, 8: 842 },
        M: { 0: 8496, 1: 2544, 2: 1542, 4: 1059, 8: 652 },
        Q: { 0: 6032, 1: 1804, 2: 1094, 4: 751, 8: 462 },
        H: { 0: 4768, 1: 1425, 2: 864, 4: 593, 8: 365 }
    },
    27: {
        L: { 0: 11744, 1: 3514, 2: 2132, 4: 1465, 8: 902 },
        M: { 0: 9024, 1: 2701, 2: 1637, 4: 1125, 8: 692 },
        Q: { 0: 6464, 1: 1933, 2: 1172, 4: 805, 8: 496 },
        H: { 0: 5024, 1: 1501, 2: 910, 4: 625, 8: 385 }
    },
    28: {
        L: { 0: 12248, 1: 3669, 2: 2223, 4: 1528, 8: 940 },
        M: { 0: 9544, 1: 2857, 2: 1732, 4: 1190, 8: 732 },
        Q: { 0: 6968, 1: 2085, 2: 1263, 4: 868, 8: 534 },
        H: { 0: 5288, 1: 1581, 2: 958, 4: 658, 8: 405 }
    },
    29: {
        L: { 0: 13048, 1: 3909, 2: 2369, 4: 1628, 8: 1002 },
        M: { 0: 10136, 1: 3035, 2: 1839, 4: 1264, 8: 778 },
        Q: { 0: 7288, 1: 2181, 2: 1322, 4: 908, 8: 559 },
        H: { 0: 5608, 1: 1677, 2: 1016, 4: 698, 8: 430 }
    },
    30: {
        L: { 0: 13880, 1: 4158, 2: 2520, 4: 1732, 8: 1066 },
        M: { 0: 10984, 1: 3289, 2: 1994, 4: 1370, 8: 843 },
        Q: { 0: 7880, 1: 2358, 2: 1429, 4: 982, 8: 604 },
        H: { 0: 5960, 1: 1782, 2: 1080, 4: 742, 8: 457 }
    },
    31: {
        L: { 0: 14744, 1: 4417, 2: 2677, 4: 1840, 8: 1132 },
        M: { 0: 11640, 1: 3486, 2: 2113, 4: 1452, 8: 894 },
        Q: { 0: 8264, 1: 2473, 2: 1499, 4: 1030, 8: 634 },
        H: { 0: 6344, 1: 1897, 2: 1150, 4: 790, 8: 486 }
    },
    32: {
        L: { 0: 15640, 1: 4686, 2: 2840, 4: 1952, 8: 1201 },
        M: { 0: 12328, 1: 3693, 2: 2238, 4: 1538, 8: 947 },
        Q: { 0: 8920, 1: 2670, 2: 1618, 4: 1112, 8: 684 },
        H: { 0: 6760, 1: 2022, 2: 1226, 4: 842, 8: 518 }
    },
    33: {
        L: { 0: 16568, 1: 4965, 2: 3009, 4: 2068, 8: 1273 },
        M: { 0: 13048, 1: 3909, 2: 2369, 4: 1628, 8: 1002 },
        Q: { 0: 9368, 1: 2805, 2: 1700, 4: 1168, 8: 719 },
        H: { 0: 7208, 1: 2157, 2: 1307, 4: 898, 8: 553 }
    },
    34: {
        L: { 0: 17528, 1: 5253, 2: 3183, 4: 2188, 8: 1347 },
        M: { 0: 13800, 1: 4134, 2: 2506, 4: 1722, 8: 1060 },
        Q: { 0: 9848, 1: 2949, 2: 1787, 4: 1228, 8: 756 },
        H: { 0: 7688, 1: 2301, 2: 1394, 4: 958, 8: 590 }
    },
    35: {
        L: { 0: 18448, 1: 5529, 2: 3351, 4: 2303, 8: 1417 },
        M: { 0: 14496, 1: 4343, 2: 2632, 4: 1809, 8: 1113 },
        Q: { 0: 10288, 1: 3081, 2: 1867, 4: 1283, 8: 790 },
        H: { 0: 7888, 1: 2361, 2: 1431, 4: 983, 8: 605 }
    },
    36: {
        L: { 0: 19472, 1: 5836, 2: 3537, 4: 2431, 8: 1496 },
        M: { 0: 15312, 1: 4588, 2: 2780, 4: 1911, 8: 1176 },
        Q: { 0: 10832, 1: 3244, 2: 1966, 4: 1351, 8: 832 },
        H: { 0: 8432, 1: 2524, 2: 1530, 4: 1051, 8: 647 }
    },
    37: {
        L: { 0: 20528, 1: 6153, 2: 3729, 4: 2563, 8: 1577 },
        M: { 0: 15936, 1: 4775, 2: 2894, 4: 1989, 8: 1224 },
        Q: { 0: 11408, 1: 3417, 2: 2071, 4: 1423, 8: 876 },
        H: { 0: 8768, 1: 2625, 2: 1591, 4: 1093, 8: 673 }
    },
    38: {
        L: { 0: 21616, 1: 6479, 2: 3927, 4: 2699, 8: 1661 },
        M: { 0: 16816, 1: 5039, 2: 3054, 4: 2099, 8: 1292 },
        Q: { 0: 12016, 1: 3599, 2: 2181, 4: 1499, 8: 923 },
        H: { 0: 9136, 1: 2735, 2: 1658, 4: 1139, 8: 701 }
    },
    39: {
        L: { 0: 22496, 1: 6743, 2: 4087, 4: 2809, 8: 1729 },
        M: { 0: 17728, 1: 5313, 2: 3220, 4: 2213, 8: 1362 },
        Q: { 0: 12656, 1: 3791, 2: 2298, 4: 1579, 8: 972 },
        H: { 0: 9776, 1: 2927, 2: 1774, 4: 1219, 8: 750 }
    },
    40: {
        L: { 0: 23648, 1: 7089, 2: 4296, 4: 2953, 8: 1817 },
        M: { 0: 18672, 1: 5596, 2: 3391, 4: 2331, 8: 1435 },
        Q: { 0: 13328, 1: 3993, 2: 2420, 4: 1663, 8: 1024 },
        H: { 0: 10208, 1: 3057, 2: 1852, 4: 1273, 8: 784 }
    }
} as const;

export const ENCODING_NAMES = {
    H: 'HEX',
    Z: 'Zlib compressed',
    '2': 'Base32'
} as const;

export type FileType = keyof typeof FILETYPE_NAMES;
export type Encoding = keyof typeof ENCODING_NAMES;
export type Version = keyof typeof QR_DATA_CAPACITY;

export type SplitOptions = {
    encoding?: Encoding;
    minSplit?: number;
    maxSplit?: number;
    minVersion?: Version;
    maxVersion?: Version;
};

export type SplitResult = {
    version: Version;
    parts: string[];
    encoding: Encoding;
};

export function isValidVersion(v: number): v is Version {
    // act as a TS type guard but also a runtime check

    return v in QR_DATA_CAPACITY;
}

export function isValidSplit(s: number) {
    return s >= 1 && s <= 1295;
}

export function validateSplitOptions(opts: SplitOptions) {
    // ensure all split options are valid, filling in defaults as needed

    const allOpts = {
        minVersion: opts.minVersion ?? 5,
        maxVersion: opts.maxVersion ?? 40,
        minSplit: opts.minSplit ?? 1,
        maxSplit: opts.maxSplit ?? 1295,
        encoding: opts.encoding ?? 'Z'
    } as const;

    if (
        allOpts.minVersion > allOpts.maxVersion ||
        !isValidVersion(allOpts.minVersion) ||
        !isValidVersion(allOpts.maxVersion)
    ) {
        throw new Error('min/max version out of range');
    }

    if (
        !isValidSplit(allOpts.minSplit) ||
        !isValidSplit(allOpts.maxSplit) ||
        allOpts.minSplit > allOpts.maxSplit
    ) {
        throw new Error('min/max split out of range');
    }

    return allOpts;
}

export function encodeData(raw: Uint8Array, encoding?: Encoding) {
    // return new encoding (if we upgraded) and the
    // characters after encoding (a string)
    // - default is Zlib or if compression doesn't help, base32
    // - returned data can be split, but must be done modX where X provided

    encoding = encoding ?? 'Z';

    if (encoding === 'H') {
        return {
            encoding,
            encoded: raw
                .reduce(
                    (acc, byte) => acc + byte.toString(16).padStart(2, '0'),
                    ''
                )
                .toUpperCase(),
            splitMod: 2
        };
    }

    if (encoding === 'Z') {
        // trial compression, but skip if it embiggens the data

        const compressed = pako.deflate(raw, { windowBits: -10 });

        if (compressed.length >= raw.length) {
            encoding = '2';
        } else {
            encoding = 'Z';
            raw = compressed;
        }
    }

    return {
        encoding,
        // base32 without padding
        encoded: base32.encode(raw).replace(/=*$/, ''),
        splitMod: 8
    };
}

export function versionToChars(v: Version) {
    // return number of **chars** that fit into indicated version QR
    // - assumes L for ECC
    // - assumes alnum encoding

    if (!isValidVersion(v)) {
        throw new Error('Invalid version');
    }

    const ecc = 'L';
    const encoding = 2; // alnum

    return QR_DATA_CAPACITY[v][ecc][encoding];
}

// Fixed-length header
export const HEADER_LEN = 8;

function numQRNeeded(version: Version, length: number, splitMod: number) {
    const baseCap = versionToChars(version) - HEADER_LEN;

    // adjust capacity to be a multiple of splitMod
    const adjustedCap = baseCap - (baseCap % splitMod);

    const estimatedCount = Math.ceil(length / adjustedCap);

    if (estimatedCount === 1) {
        // if it fits in one QR, we're done
        return { count: 1, perEach: length };
    }

    // the total capacity of our estimated count
    // all but the last QR need to use adjusted capacity to ensure proper split
    const estimatedCap = (estimatedCount - 1) * adjustedCap + baseCap;

    return {
        count: estimatedCap >= length ? estimatedCount : estimatedCount + 1,
        perEach: adjustedCap
    };
}

function findBestVersion(
    length: number,
    splitMod: number,
    opts: Required<SplitOptions>
) {
    const options: { version: Version; count: number; perEach: number }[] = [];

    for (let version = opts.minVersion; version <= opts.maxVersion; version++) {
        const { count, perEach } = numQRNeeded(version, length, splitMod);

        if (opts.minSplit <= count && count <= opts.maxSplit) {
            options.push({ version, count, perEach });
        }
    }

    if (!options.length) {
        throw new Error('Cannot make it fit');
    }

    // pick smallest number of QR, lowest version
    options.sort((a, b) => a.count - b.count || a.version - b.version);

    return options[0];
}

export function intToBase36(n: number) {
    // convert an integer 0-1295 to two digits of base 36 - 00-ZZ

    if (n < 0 || n > 1295 || !Number.isInteger(n)) {
        throw new Error('Out of range');
    }

    return n.toString(36).toUpperCase().padStart(2, '0');
}

export function splitQRs(
    raw: Uint8Array,
    fileType: FileType,
    opts: SplitOptions = {}
): SplitResult {
    if (!FILETYPES.has(fileType)) {
        throw new Error(`Invalid value for fileType: ${fileType}`);
    }

    const validatedOpts = validateSplitOptions(opts);

    const {
        encoding: actualEncoding,
        encoded,
        splitMod
    } = encodeData(raw, validatedOpts.encoding);

    const { version, count, perEach } = findBestVersion(
        encoded.length,
        splitMod,
        validatedOpts
    );

    const parts: string[] = [];

    for (
        let n = 0, offset = 0;
        offset < encoded.length;
        n++, offset += perEach
    ) {
        parts.push(
            `B$${actualEncoding}${fileType}` +
                intToBase36(count) +
                intToBase36(n) +
                encoded.slice(offset, offset + perEach)
        );
    }

    return { version, parts, encoding: actualEncoding };
}

export const ENCODINGS = new Set(Object.keys(ENCODING_NAMES));

// Default split options that can be reused across the application
export const DEFAULT_SPLIT_OPTIONS: Required<SplitOptions> = {
    encoding: 'Z', // Zlib compressed base32 encoding
    minSplit: 1, // minimum number of parts to return
    maxSplit: 1295, // maximum number of parts to return
    minVersion: 5, // minimum QR code version
    maxVersion: 40 // maximum QR code version
} as const;

export type JoinResult = {
    fileType: FileType;
    encoding: Encoding;
    raw: Uint8Array;
};

function joinByteParts(parts: Uint8Array[]) {
    // perf-optimized way to join Uint8Arrays

    const length = parts.reduce((acc, bytes) => acc + bytes.length, 0);

    const rv = new Uint8Array(length);

    let offset = 0;
    for (const bytes of parts) {
        rv.set(bytes, offset);
        offset += bytes.length;
    }

    return rv;
}

export function decodeData(parts: string[], encoding: Encoding) {
    // decode the parts back into a Uint8Array

    if (encoding === 'H') {
        return joinByteParts(parts.map((p) => hexToBytes(p)));
    }

    const bytes = joinByteParts(
        parts.map((p) => {
            const padding = (8 - (p.length % 8)) % 8;

            return base32.decode(p + '='.repeat(padding));
        })
    );

    if (encoding === 'Z') {
        return pako.inflate(bytes, { windowBits: -10 });
    }

    return bytes;
}

export function hexToBytes(hex: string) {
    // convert a hex string to a Uint8Array

    const match = hex.match(/.{1,2}/g) ?? [];

    return Uint8Array.from(match.map((byte) => parseInt(byte, 16)));
}

/**
 * Decodes and joins QR code parts back to binary data.
 *
 * @param parts Array of QR code parts
 * @returns Object containing the file type, encoding, and raw binary data.
 */
export function joinQRs(parts: string[]): JoinResult {
    const headers = new Set(parts.map((p) => p.slice(0, 6)));

    if (headers.size !== 1) {
        throw new Error('conflicting/variable filetype/encodings/sizes');
    }

    const header = [...headers][0];

    if (header.slice(0, 2) !== 'B$') {
        throw new Error('fixed header not found, expected B$');
    }

    if (!ENCODINGS.has(header[2])) {
        throw new Error(`bad encoding: ${header[2]}`);
    }
    if (!FILETYPES.has(header[3])) {
        throw new Error(`bad file type: ${header[3]}`);
    }

    const encoding = header[2] as Encoding;
    const fileType = header[3] as FileType;

    const numParts = parseInt(header.slice(4, 6), 36);

    if (numParts < 1) {
        throw new Error('zero parts?');
    }

    const data = new Map<number, string>();

    for (const p of parts) {
        const idx = parseInt(p.slice(6, 8), 36);

        if (idx >= numParts) {
            throw new Error(`got part ${idx} but only expecting ${numParts}`);
        }

        if (data.has(idx) && data.get(idx) !== p.slice(8)) {
            throw new Error(
                `Duplicate part 0x${idx.toString(16)} has wrong content`
            );
        }

        data.set(idx, p.slice(8));
    }

    const orderedParts = [];

    for (let i = 0; i < numParts; i++) {
        const p = data.get(i);

        if (!p) {
            throw new Error(`Part ${i} is missing`);
        }

        orderedParts.push(p);
    }

    const raw = decodeData(orderedParts, encoding);

    return { fileType, encoding, raw };
}
