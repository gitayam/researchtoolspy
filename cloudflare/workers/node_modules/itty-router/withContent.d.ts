import { IRequest, IRequestStrict } from './Router';
export type HasContent<ContentType> = {
    content: ContentType;
} & IRequestStrict;
export declare const withContent: (request: IRequest) => Promise<void>;
