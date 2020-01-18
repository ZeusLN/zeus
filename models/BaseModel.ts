export default class BaseModel {
    constructor(data?: any) {
        Object.keys(data).forEach((field: any) => {
            this[field] = data[field];
        });
    }
}
