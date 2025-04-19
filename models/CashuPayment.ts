import { computed } from 'mobx';
import { Proof, MeltProofsResponse } from '@cashu/cashu-ts';

import Payment from './Payment';
import { localeString } from '../utils/LocaleUtils';

export default class CashuPayment extends Payment {
    public meltResponse: MeltProofsResponse;
    public fee: number;
    public mintUrl: string;
    public proofs: Proof[];

    constructor(data?: any) {
        super(data);
    }

    @computed public get model(): string {
        return localeString('views.Cashu.CashuPayment.title');
    }
}
