class FeeUtils {
    roundFee = (text: string) => {
        const split = text.split('.');

        if (Number(split[1]) >= 5) {
            const value = Number(split[0]) + 1;
            return value.toString();
        }

        return split[0];
    };
    toFixed = (x: any) => {
        return x.toFixed(8).replace(/\.?0+$/, '');
    };
}

const feeUtils = new FeeUtils();
export default feeUtils;
