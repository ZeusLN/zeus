export default interface Payment {
    creation_date: string;
    value: string;
    fee: string;
    payment_hash: string;
    value_sat: string;
    payment_preimage: string;
    value_msat: string;
    path: Array<string>;
    //
    bolt: string;
    status: string;
    payment_preimage: string;
    amount_sent_msat: string;
}
