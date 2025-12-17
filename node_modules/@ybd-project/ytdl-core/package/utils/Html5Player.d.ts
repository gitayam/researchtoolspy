import { YTDL_DecipherFunction, YTDL_NTransformFunction } from '../types/Html5Player';
declare function getDecipherFunction(playerId: string, body: string): YTDL_DecipherFunction;
declare function getNTransformFunction(playerId: string, body: string): YTDL_NTransformFunction;
export { getDecipherFunction, getNTransformFunction };
