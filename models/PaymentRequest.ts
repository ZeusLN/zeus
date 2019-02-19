export default interface PaymentRequest {
    cltv_expiry: string;
    expiry: string;
    description: string;
    destination: string;
    num_satoshis: string;
    payment_hash: string;
    timestamp: string;
}