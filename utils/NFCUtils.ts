class NFCUtils {
    nfcUtf8ArrayToStr = (data: any) => {
        const extraByteMap = [1, 1, 1, 1, 2, 2, 3, 0];
        const count = data.length;
        let str = '';

        for (let index = 0; index < count; ) {
            let ch = data[index++];
            if (ch & 0x80) {
                let extra = extraByteMap[(ch >> 3) & 0x07];
                if (!(ch & 0x40) || !extra || index + extra > count) {
                    return null;
                }

                ch = ch & (0x3f >> extra);
                for (; extra > 0; extra -= 1) {
                    const chx = data[index++];
                    if ((chx & 0xc0) !== 0x80) {
                        return null;
                    }

                    ch = (ch << 6) | (chx & 0x3f);
                }
            }

            str += String.fromCharCode(ch);
        }

        return str.slice(3);
    };
}

const nfcUtils = new NFCUtils();
export default nfcUtils;
