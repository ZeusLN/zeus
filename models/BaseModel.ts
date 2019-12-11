export default class BaseModel {
    constructor(data?: any) {
        Object.keys(data).forEach((field) => {
            this[field] = data[field];
        });
    }
}
