export default class RequestError extends Error {
    statusCode: number;
    constructor(message: string, statusCode?: number);
}
