const DUST_LIMIT = 546;

const isBelowDustLimit = (satAmount: number | string): boolean => {
    return Number(satAmount) !== 0 && Number(satAmount) < DUST_LIMIT;
};

export { isBelowDustLimit };
