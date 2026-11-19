// @ts-nocheck
export default class BaseModel {
    constructor(data?: any) {
        Object.keys(data).forEach((field: any) => {
            // JSON.parse keeps a "__proto__" member as an own key. Assigning
            // it would replace this instance's prototype, and with it every
            // getter of the model.
            if (field === '__proto__') return;
            // Handle Longs. Parsed JSON can have `high` and `low` members too,
            // but only a Long has its own toString; a plain object would
            // become "[object Object]".
            if (
                data[field] &&
                data[field].high !== undefined &&
                data[field].low !== undefined &&
                typeof data[field].toString === 'function' &&
                data[field].toString !== Object.prototype.toString
            ) {
                this[field] = data[field].toString();
            } else {
                this[field] = data[field];
            }
        });
    }
}
