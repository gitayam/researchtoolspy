import RequestError from './RequestError';
export default class PlayerRequestError<T = unknown> extends RequestError {
    response: T | null;
    constructor(message: string, response: T | null, statusCode: number | null);
}
