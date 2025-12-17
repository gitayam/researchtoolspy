"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Url_1 = require("../../utils/Url");
const Log_1 = require("../../utils/Log");
/* Reference: m3u8stream/parse-time.js */
const NUMBER_FORMAT = /^\d+$/, TIME_FORMAT = /^(?:(?:(\d+):)?(\d{1,2}):)?(\d{1,2})(?:\.(\d{3}))?$/, TIME_IN_ENG_FORMAT = /(-?\d+)(ms|s|m|h)/g, TIME_UNITS = {
    ms: 1,
    s: 1000,
    m: 60000,
    h: 3600000,
};
function parseTimestamp(time) {
    if (typeof time === 'number') {
        return time;
    }
    if (NUMBER_FORMAT.test(time)) {
        return +time;
    }
    const PARSED_FORMAT = TIME_FORMAT.exec(time);
    if (PARSED_FORMAT) {
        return +(PARSED_FORMAT[1] || 0) * TIME_UNITS.h + +(PARSED_FORMAT[2] || 0) * TIME_UNITS.m + +PARSED_FORMAT[3] * TIME_UNITS.s + +(PARSED_FORMAT[4] || 0);
    }
    else {
        let total = 0;
        for (const PARSED of time.matchAll(TIME_IN_ENG_FORMAT)) {
            total += +PARSED[1] * TIME_UNITS[PARSED[2]];
        }
        return total;
    }
}
function getText(obj) {
    if (obj && obj.runs) {
        return obj.runs[0].text;
    }
    else if (obj) {
        return obj.simpleText;
    }
    return '';
}
function isVerified(badges) {
    return !!(badges && badges.find((b) => b.metadataBadgeRenderer.tooltip === 'Verified'));
}
function getRelativeTime(date, locale = 'en') {
    const NOW = new Date(), SECONDS_AGO = Math.floor((NOW.getTime() - date.getTime()) / 1000), RTF = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });
    if (SECONDS_AGO < 60) {
        return RTF.format(-SECONDS_AGO, 'second');
    }
    else if (SECONDS_AGO < 3600) {
        return RTF.format(-Math.floor(SECONDS_AGO / 60), 'minute');
    }
    else if (SECONDS_AGO < 86400) {
        return RTF.format(-Math.floor(SECONDS_AGO / 3600), 'hour');
    }
    else if (SECONDS_AGO < 2592000) {
        return RTF.format(-Math.floor(SECONDS_AGO / 86400), 'day');
    }
    else if (SECONDS_AGO < 31536000) {
        return RTF.format(-Math.floor(SECONDS_AGO / 2592000), 'month');
    }
    else {
        return RTF.format(-Math.floor(SECONDS_AGO / 31536000), 'year');
    }
}
function parseStringToNumber(input) {
    const SUFFIX = input.slice(-1).toUpperCase(), VALUE = parseFloat(input.slice(0, -1));
    switch (SUFFIX) {
        case 'K':
            return VALUE * 1000;
        case 'M':
            return VALUE * 1000000;
        case 'B':
            return VALUE * 1000000000;
        default:
            return parseFloat(input);
    }
}
function parseRelatedVideo(details) {
    if (!details) {
        return null;
    }
    try {
        let viewCount = getText(details.viewCountText), shortViewCount = getText(details.shortViewCountText);
        if (!/^\d/.test(shortViewCount)) {
            shortViewCount = '';
        }
        viewCount = (/^\d/.test(viewCount) ? viewCount : shortViewCount).split(' ')[0];
        const BROWSE_ENDPOINT = details.shortBylineText.runs[0].navigationEndpoint.browseEndpoint, CHANNEL_ID = BROWSE_ENDPOINT.browseId, NAME = getText(details.shortBylineText), USER = decodeURIComponent((BROWSE_ENDPOINT.canonicalBaseUrl || '').split('/').slice(-1)[0] || ''), PUBLISHED_TEXT = getText(details.publishedTimeText), SHORT_VIEW_COUNT_TEXT = shortViewCount.split(' ')[0], VIDEO = {
            id: details.videoId,
            title: getText(details.title),
            published: PUBLISHED_TEXT || null,
            author: {
                id: CHANNEL_ID,
                name: NAME,
                user: USER,
                channelUrl: `https://www.youtube.com/channel/${CHANNEL_ID}`,
                userUrl: `https://www.youtube.com/` + (USER.includes('@') ? USER : 'user/' + USER),
                thumbnails: (details.channelThumbnail.thumbnails || [])?.map((thumbnail) => {
                    thumbnail.url = new URL(thumbnail.url, Url_1.Url.getBaseUrl()).toString();
                    return thumbnail;
                }),
                subscriberCount: null,
                verified: isVerified(details.ownerBadges || []),
            },
            shortViewCountText: SHORT_VIEW_COUNT_TEXT,
            viewCount: parseInt(viewCount.replace(/,/g, '')),
            lengthSeconds: details.lengthText ? Math.floor(parseTimestamp(getText(details.lengthText)) / 1000) : null,
            thumbnails: details.thumbnail.thumbnails || [],
            richThumbnails: details.richThumbnail ? details.richThumbnail.movingThumbnailRenderer.movingThumbnailDetails?.thumbnails || [] : [],
            isLive: !!(details.badges && details.badges.find((b) => b.metadataBadgeRenderer.label === 'LIVE NOW')),
        };
        return VIDEO;
    }
    catch (err) {
        Log_1.Logger.debug(`<error>Failed</error> to parse related video (ID: ${details?.videoId || 'Unknown'}): <error>${err}</error>`);
        return null;
    }
}
class InfoExtras {
    static getMedia(info) {
        if (!info) {
            return null;
        }
        let media = {
            category: '',
            categoryUrl: '',
            thumbnails: [],
        }, microformat = null;
        try {
            microformat = info.microformat?.playerMicroformatRenderer || null;
        }
        catch (err) { }
        if (!microformat) {
            return null;
        }
        try {
            media.category = microformat.category;
            media.thumbnails = microformat.thumbnail.thumbnails || [];
            if (media.category === 'Music') {
                media.categoryUrl = Url_1.Url.getBaseUrl() + '/music';
            }
            else if (media.category === 'Gaming') {
                media.categoryUrl = Url_1.Url.getBaseUrl() + '/gaming';
            }
        }
        catch (err) { }
        return media;
    }
    static getAuthor(info) {
        if (!info) {
            return null;
        }
        let channelName = null, channelId = null, user = null, thumbnails = [], subscriberCount = null, verified = false, videoSecondaryInfoRenderer = null;
        try {
            const VIDEO_SECONDARY_INFO_RENDERER = info.contents.twoColumnWatchNextResults.results.results.contents.find((c) => c.videoSecondaryInfoRenderer);
            videoSecondaryInfoRenderer = VIDEO_SECONDARY_INFO_RENDERER?.videoSecondaryInfoRenderer;
        }
        catch (err) { }
        if (!videoSecondaryInfoRenderer || !videoSecondaryInfoRenderer.owner) {
            return null;
        }
        try {
            const VIDEO_OWNER_RENDERER = videoSecondaryInfoRenderer.owner.videoOwnerRenderer;
            channelName = VIDEO_OWNER_RENDERER.title.runs[0].text || null;
            channelId = VIDEO_OWNER_RENDERER.navigationEndpoint.browseEndpoint.browseId || null;
            user = VIDEO_OWNER_RENDERER.navigationEndpoint.browseEndpoint.canonicalBaseUrl.replace('/', '') || null;
            thumbnails = VIDEO_OWNER_RENDERER.thumbnail.thumbnails || [];
            subscriberCount = Math.floor(parseStringToNumber(VIDEO_OWNER_RENDERER.subscriberCountText.simpleText.split(' ')[0])) || null;
            verified = isVerified(VIDEO_OWNER_RENDERER.badges || []);
        }
        catch (err) { }
        try {
            const AUTHOR = {
                id: channelId || '',
                name: channelName || '',
                user: user || '',
                channelUrl: channelId ? `https://www.youtube.com/channel/${channelId}` : '',
                externalChannelUrl: channelId ? `https://www.youtube.com/channel/${channelId}` : '',
                userUrl: 'https://www.youtube.com' + user,
                thumbnails,
                subscriberCount,
                verified,
            };
            return AUTHOR;
        }
        catch (err) {
            return null;
        }
    }
    static getAuthorFromPlayerResponse(info) {
        let channelName = null, channelId = null, user = null, thumbnails = [], subscriberCount = null, verified = false, microformat = null, endscreen = null;
        try {
            microformat = info.microformat?.playerMicroformatRenderer || null;
            endscreen = info.endscreen?.endscreenRenderer.elements.find((e) => e.endscreenElementRenderer.style === 'CHANNEL')?.endscreenElementRenderer;
        }
        catch (err) { }
        if (!microformat) {
            return null;
        }
        try {
            channelName = microformat.ownerChannelName || null;
            channelId = microformat.externalChannelId;
            user = '@' + (microformat.ownerProfileUrl || '').split('@')[1];
            thumbnails = endscreen.image.thumbnails || [];
            subscriberCount = null;
            verified = false;
        }
        catch (err) { }
        try {
            const AUTHOR = {
                id: channelId || '',
                name: channelName || '',
                user: user || '',
                channelUrl: channelId ? `https://www.youtube.com/channel/${channelId}` : '',
                externalChannelUrl: channelId ? `https://www.youtube.com/channel/${channelId}` : '',
                userUrl: 'https://www.youtube.com/' + user,
                thumbnails,
                subscriberCount: subscriberCount,
                verified,
            };
            return AUTHOR;
        }
        catch (err) {
            return null;
        }
    }
    static getLikes(info) {
        if (!info) {
            return null;
        }
        try {
            const CONTENTS = info.contents.twoColumnWatchNextResults.results.results.contents, VIDEO = CONTENTS.find((r) => r.videoPrimaryInfoRenderer), BUTTONS = VIDEO.videoPrimaryInfoRenderer.videoActions.menuRenderer.topLevelButtons, BUTTON_VIEW_MODEL = BUTTONS.filter((b) => b.segmentedLikeDislikeButtonViewModel)[0].segmentedLikeDislikeButtonViewModel.likeButtonViewModel.likeButtonViewModel.toggleButtonViewModel.toggleButtonViewModel.defaultButtonViewModel.buttonViewModel, ACCESSIBILITY_TEXT = BUTTON_VIEW_MODEL.accessibilityText, TITLE = BUTTON_VIEW_MODEL.title;
            if (ACCESSIBILITY_TEXT) {
                const MATCH = ACCESSIBILITY_TEXT.match(/[\d,.]+/) || [];
                return parseInt((MATCH[0] || '').replace(/\D+/g, ''));
            }
            else if (TITLE) {
                return parseStringToNumber(TITLE);
            }
            return null;
        }
        catch (err) {
            return null;
        }
    }
    static getRelatedVideos(info) {
        if (!info) {
            return [];
        }
        let secondaryResults = [];
        try {
            secondaryResults = info.contents.twoColumnWatchNextResults.secondaryResults.secondaryResults.results;
        }
        catch (err) { }
        const VIDEOS = [];
        for (const RESULT of secondaryResults) {
            const DETAILS = RESULT.compactVideoRenderer;
            if (DETAILS) {
                const VIDEO = parseRelatedVideo(DETAILS);
                if (VIDEO) {
                    VIDEOS.push(VIDEO);
                }
            }
            else {
                const AUTOPLAY = RESULT.compactAutoplayRenderer || RESULT.itemSectionRenderer;
                if (!AUTOPLAY || !Array.isArray(AUTOPLAY.contents)) {
                    continue;
                }
                for (const CONTENT of AUTOPLAY.contents) {
                    const VIDEO = parseRelatedVideo(CONTENT.compactVideoRenderer);
                    if (VIDEO) {
                        VIDEOS.push(VIDEO);
                    }
                }
            }
        }
        return VIDEOS;
    }
    static cleanVideoDetails(videoDetails, microformat, lang = 'en') {
        const DETAILS = videoDetails;
        if (DETAILS.thumbnail) {
            DETAILS.thumbnails = DETAILS.thumbnail.thumbnails;
        }
        const DESCRIPTION = DETAILS.shortDescription || getText(DETAILS.description);
        if (DESCRIPTION) {
            DETAILS.description = DESCRIPTION;
        }
        if (typeof DETAILS.thumbnail !== 'undefined') {
            delete DETAILS.thumbnail;
        }
        if (typeof DETAILS.shortDescription !== 'undefined') {
            delete DETAILS.shortDescription;
        }
        if (microformat) {
            DETAILS.lengthSeconds = parseInt(microformat.lengthSeconds || videoDetails.lengthSeconds.toString());
            DETAILS.publishDate = microformat.publishDate || videoDetails.publishDate || null;
            DETAILS.published = null;
            try {
                if (DETAILS.publishDate) {
                    DETAILS.published = getRelativeTime(new Date(DETAILS.publishDate), lang) || null;
                }
            }
            catch { }
        }
        if (DETAILS.lengthSeconds) {
            DETAILS.lengthSeconds = parseInt(DETAILS.lengthSeconds);
        }
        if (DETAILS.viewCount) {
            DETAILS.viewCount = parseInt(DETAILS.viewCount);
        }
        return DETAILS;
    }
    static getStoryboards(info) {
        if (!info || !info.storyboards) {
            return [];
        }
        const PARTS = info.storyboards && info.storyboards.playerStoryboardSpecRenderer && info.storyboards.playerStoryboardSpecRenderer.spec && info.storyboards.playerStoryboardSpecRenderer.spec.split('|');
        if (!PARTS) {
            return [];
        }
        const _URL = new URL(PARTS.shift() || '');
        return PARTS.map((part, i) => {
            let [thumbnailWidth, thumbnailHeight, thumbnailCount, columns, rows, interval, nameReplacement, sigh] = part.split('#');
            _URL.searchParams.set('sigh', sigh);
            thumbnailCount = parseInt(thumbnailCount, 10);
            columns = parseInt(columns, 10);
            rows = parseInt(rows, 10);
            const STORYBOARD_COUNT = Math.ceil(thumbnailCount / (columns * rows));
            return {
                templateUrl: _URL.toString().replace('$L', i.toString()).replace('$N', nameReplacement),
                thumbnailWidth: parseInt(thumbnailWidth, 10),
                thumbnailHeight: parseInt(thumbnailHeight, 10),
                thumbnailCount,
                interval: parseInt(interval, 10),
                columns,
                rows,
                storyboardCount: STORYBOARD_COUNT,
            };
        });
    }
    static getChapters(info) {
        if (!info) {
            return [];
        }
        const PLAYER_OVERLAY_RENDERER = info.playerOverlays && info.playerOverlays.playerOverlayRenderer, PLAYER_BAR = PLAYER_OVERLAY_RENDERER && PLAYER_OVERLAY_RENDERER.decoratedPlayerBarRenderer && PLAYER_OVERLAY_RENDERER.decoratedPlayerBarRenderer.decoratedPlayerBarRenderer && PLAYER_OVERLAY_RENDERER.decoratedPlayerBarRenderer.decoratedPlayerBarRenderer.playerBar, MARKERS_MAP = PLAYER_BAR && PLAYER_BAR.multiMarkersPlayerBarRenderer && PLAYER_BAR.multiMarkersPlayerBarRenderer.markersMap, MARKER = Array.isArray(MARKERS_MAP) && MARKERS_MAP.find((m) => m.value && Array.isArray(m.value.chapters));
        if (!MARKER) {
            return [];
        }
        const CHAPTERS = MARKER.value.chapters;
        return CHAPTERS.map((chapter) => {
            return {
                title: getText(chapter.chapterRenderer.title),
                startTime: chapter.chapterRenderer.timeRangeStartMillis / 1000,
            };
        });
    }
}
exports.default = InfoExtras;
//# sourceMappingURL=Extras.js.map