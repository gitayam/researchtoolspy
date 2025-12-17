export default class UnrecoverableError extends Error {
    playabilityStatus: string | null;
    constructor(message: string, playabilityStatus?: string | null);
}
