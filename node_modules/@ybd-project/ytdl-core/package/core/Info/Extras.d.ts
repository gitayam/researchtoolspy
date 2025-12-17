import type { YT_PlayerApiResponse, YT_NextApiResponse, YT_MicroformatRenderer, YTDL_Media, YTDL_Author, YTDL_RelatedVideo, YTDL_Storyboard, YTDL_Chapter, YTDL_VideoDetails } from '../../types';
export default class InfoExtras {
    static getMedia(info: YT_PlayerApiResponse | null): YTDL_Media | null;
    static getAuthor(info: YT_NextApiResponse | null): YTDL_Author | null;
    static getAuthorFromPlayerResponse(info: YT_PlayerApiResponse): YTDL_Author | null;
    static getLikes(info: YT_NextApiResponse | null): number | null;
    static getRelatedVideos(info: YT_NextApiResponse | null): Array<YTDL_RelatedVideo>;
    static cleanVideoDetails(videoDetails: YTDL_VideoDetails, microformat: YT_MicroformatRenderer | null, lang?: string): YTDL_VideoDetails;
    static getStoryboards(info: YT_PlayerApiResponse | null): Array<YTDL_Storyboard>;
    static getChapters(info: YT_NextApiResponse | null): Array<YTDL_Chapter>;
}
