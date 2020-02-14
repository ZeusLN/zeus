/*
 * Original gcolor code by Felix Weis - WhatTheFee.io
 * https://whatthefee.io/static/js/wtfutil.js
 *
 * Converted to TypeScript by Evan Kaloudis for Zeus
 */
class FeeUtils {
    roundFee = (text: string) => {
        const split = text.split('.');

        if (Number(split[1]) >= 5) {
            const value = Number(split[0]) + 1;
            return value.toString();
        }

        return split[0];
    };
    gcolor = (n: number) => {
        const bases = [
            [[240, 0.35, 0.35], [240, 0.65, 0.6], [240, 0.35, 0.75]],
            [[80, 0.35, 0.35], [80, 0.55, 0.45], [80, 0.35, 0.75]],
            [[40, 0.35, 0.35], [45, 0.75, 0.45], [40, 0.35, 0.75]],
            [[0, 0.35, 0.35], [0, 0.65, 0.55], [0, 0.35, 0.75]],
            [[300, 0.35, 0.35], [300, 0.65, 0.5], [300, 0.35, 0.75]]
        ];
        let a, b;

        const under = [0, 0.0, 0.35];
        const excess = [0, 0.0, 0.85];

        n = Math.round(n * 1000) / 1000;
        n = n * 10.0;
        if (n < 0.0) {
            return under;
        } else if (n >= 10.0) {
            return excess;
        }

        const cat = Math.floor(n / 2);
        const sub = n % 1;

        if ((n / 2) % 1 < 0.5) {
            a = bases[cat][0];
            b = bases[cat][1];
        } else {
            a = bases[cat][1];
            b = bases[cat][2];
        }

        let ca = 1 - sub;
        let cb = sub;

        let final = [
            ca * a[0] + cb * b[0],
            ca * a[1] + cb * b[1],
            ca * a[2] + cb * b[2]
        ];

        return final;
    };
    toFixed = (x: any) => {
        return x.toFixed(8).replace(/\.?0+$/, '');
    };
}

const feeUtils = new FeeUtils();
export default feeUtils;
