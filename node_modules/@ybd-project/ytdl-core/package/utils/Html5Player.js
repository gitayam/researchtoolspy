"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDecipherFunction = getDecipherFunction;
exports.getNTransformFunction = getNTransformFunction;
const Platform_1 = require("../platforms/Platform");
const Log_1 = require("./Log");
/* Private Constants */
const DECIPHER_NAME_REGEXPS = ['\\bm=([a-zA-Z0-9$]{2,})\\(decodeURIComponent\\(h\\.s\\)\\)', '\\bc&&\\(c=([a-zA-Z0-9$]{2,})\\(decodeURIComponent\\(c\\)\\)', '(?:\\b|[^a-zA-Z0-9$])([a-zA-Z0-9$]{2,})\\s*=\\s*function\\(\\s*a\\s*\\)\\s*\\{\\s*a\\s*=\\s*a\\.split\\(\\s*""\\s*\\)', '([\\w$]+)\\s*=\\s*function\\((\\w+)\\)\\{\\s*\\2=\\s*\\2\\.split\\(""\\)\\s*;'];
// LavaPlayer regexps
const VARIABLE_PART = '[a-zA-Z_\\$][a-zA-Z_0-9]*', VARIABLE_PART_DEFINE = `\\"?${VARIABLE_PART}\\"?`, BEFORE_ACCESS = '(?:\\[\\"|\\.)', AFTER_ACCESS = '(?:\\"\\]|)', VARIABLE_PART_ACCESS = BEFORE_ACCESS + VARIABLE_PART + AFTER_ACCESS, REVERSE_PART = ':function\\(a\\)\\{(?:return )?a\\.reverse\\(\\)\\}', SLICE_PART = ':function\\(a,b\\)\\{return a\\.slice\\(b\\)\\}', SPLICE_PART = ':function\\(a,b\\)\\{a\\.splice\\(0,b\\)\\}', SWAP_PART = ':function\\(a,b\\)\\{' + 'var c=a\\[0\\];a\\[0\\]=a\\[b%a\\.length\\];a\\[b(?:%a.length|)\\]=c(?:;return a)?\\}', DECIPHER_REGEXP = `function(?: ${VARIABLE_PART})?\\(a\\)\\{` + `a=a\\.split\\(""\\);\\s*` + `((?:(?:a=)?${VARIABLE_PART}${VARIABLE_PART_ACCESS}\\(a,\\d+\\);)+)` + `return a\\.join\\(""\\)` + `\\}`, HELPER_REGEXP = `var (${VARIABLE_PART})=\\{((?:(?:${VARIABLE_PART_DEFINE}${REVERSE_PART}|${VARIABLE_PART_DEFINE}${SLICE_PART}|${VARIABLE_PART_DEFINE}${SPLICE_PART}|${VARIABLE_PART_DEFINE}${SWAP_PART}),?\\n?)+)\\};`, SCVR = '[a-zA-Z0-9$_]', FNR = `${SCVR}+`, AAR = '\\[(\\d+)]', N_TRANSFORM_NAME_REGEXPS = [
    // NewPipeExtractor regexps
    `${SCVR}+="nn"\\[\\+${SCVR}+\\.${SCVR}+],${SCVR}+=${SCVR}+\\.get\\(${SCVR}+\\)\\)&&\\(${SCVR}+=(${SCVR}+)\\[(\\d+)]`,
    `${SCVR}+="nn"\\[\\+${SCVR}+\\.${SCVR}+],${SCVR}+=${SCVR}+\\.get\\(${SCVR}+\\)\\).+\\|\\|(${SCVR}+)\\(""\\)`,
    `\\(${SCVR}=String\\.fromCharCode\\(110\\),${SCVR}=${SCVR}\\.get\\(${SCVR}\\)\\)&&\\(${SCVR}=(${FNR})(?:${AAR})?\\(${SCVR}\\)`,
    `\\.get\\("n"\\)\\)&&\\(${SCVR}=(${FNR})(?:${AAR})?\\(${SCVR}\\)`,
    // Skick regexps
    '(\\w+).length\\|\\|\\w+\\(""\\)',
    '\\w+.length\\|\\|(\\w+)\\(""\\)',
];
// LavaPlayer regexps
const N_TRANSFORM_REGEXP = 'function\\(\\s*(\\w+)\\s*\\)\\s*\\{' + 'var\\s*(\\w+)=(?:\\1\\.split\\(.*?\\)|String\\.prototype\\.split\\.call\\(\\1,.*?\\)),' + '\\s*(\\w+)=(\\[.*?]);\\s*\\3\\[\\d+]' + '(.*?try)(\\{.*?})catch\\(\\s*(\\w+)\\s*\\)\\s*\\' + '{\\s*return"enhanced_except_([A-z0-9-]+)"\\s*\\+\\s*\\1\\s*}' + '\\s*return\\s*(\\2\\.join\\(""\\)|Array\\.prototype\\.join\\.call\\(\\2,""\\))};', DECIPHER_ARGUMENT = 'sig', N_ARGUMENT = 'ncode', DECIPHER_FUNC_NAME = 'YBDProjectDecipherFunc', N_TRANSFORM_FUNC_NAME = 'YBDProjectNTransformFunc';
/* ----------- */
const SHIM = Platform_1.Platform.getShim();
/* Private Functions */
function matchRegex(regex, str) {
    const MATCH = str.match(new RegExp(regex, 's'));
    if (!MATCH) {
        throw new Error(`Could not match ${regex}`);
    }
    return MATCH;
}
function matchFirst(regex, str) {
    return matchRegex(regex, str)[0];
}
function matchGroup1(regex, str) {
    return matchRegex(regex, str)[1];
}
function getFunctionName(body, regexps) {
    let fn;
    for (const REGEX of regexps) {
        try {
            fn = matchGroup1(REGEX, body);
            try {
                fn = matchGroup1(`${fn.replace(/\$/g, '\\$')}=\\[([a-zA-Z0-9$\\[\\]]{2,})\\]`, body);
            }
            catch (err) { }
            break;
        }
        catch (err) {
            continue;
        }
    }
    if (!fn || fn.includes('['))
        throw Error();
    return fn;
}
function getExtractFunctions(extractFunctions, body) {
    for (const extractFunction of extractFunctions) {
        try {
            const FUNC = extractFunction(body);
            if (!FUNC)
                continue;
            return FUNC;
        }
        catch {
            continue;
        }
    }
    return null;
}
/* Decipher */
function extractDecipherFunc(body) {
    try {
        const HELPER_OBJECT = matchFirst(HELPER_REGEXP, body), DECIPHER_FUNCTION = matchFirst(DECIPHER_REGEXP, body), RESULTS_FUNCTION = `var ${DECIPHER_FUNC_NAME}=${DECIPHER_FUNCTION};`, CALLER_FUNCTION = `${DECIPHER_FUNC_NAME}(${DECIPHER_ARGUMENT});`;
        return HELPER_OBJECT + RESULTS_FUNCTION + CALLER_FUNCTION;
    }
    catch (e) {
        return null;
    }
}
function extractDecipherWithName(body) {
    try {
        const DECIPHER_FUNCTION_NAME = getFunctionName(body, DECIPHER_NAME_REGEXPS), FUNC_PATTERN = `(${DECIPHER_FUNCTION_NAME.replace(/\$/g, '\\$')}function\\([a-zA-Z0-9_]+\\)\\{.+?\\})`, DECIPHER_FUNCTION = `var ${matchGroup1(FUNC_PATTERN, body)};`, HELPER_OBJECT_NAME = matchGroup1(';([A-Za-z0-9_\\$]{2,})\\.\\w+\\(', DECIPHER_FUNCTION), HELPER_PATTERN = `(var ${HELPER_OBJECT_NAME.replace(/\$/g, '\\$')}=\\{[\\s\\S]+?\\}\\};)`, HELPER_OBJECT = matchGroup1(HELPER_PATTERN, body), CALLER_FUNCTION = `${DECIPHER_FUNC_NAME}(${DECIPHER_ARGUMENT});`;
        return HELPER_OBJECT + DECIPHER_FUNCTION + CALLER_FUNCTION;
    }
    catch (e) {
        return null;
    }
}
/* N-Transform */
function extractNTransformFunc(body) {
    try {
        const N_FUNCTION = matchFirst(N_TRANSFORM_REGEXP, body), RESULTS_FUNCTION = `var ${N_TRANSFORM_FUNC_NAME}=${N_FUNCTION};`, CALLER_FUNCTION = `${N_TRANSFORM_FUNC_NAME}(${N_ARGUMENT});`;
        return RESULTS_FUNCTION + CALLER_FUNCTION;
    }
    catch (e) {
        return null;
    }
}
function extractNTransformWithName(body) {
    try {
        const N_FUNCTION_NAME = getFunctionName(body, N_TRANSFORM_NAME_REGEXPS), FUNCTION_PATTERN = `(${N_FUNCTION_NAME.replace(/\$/g, '\\$')}=\\s*function([\\S\\s]*?\\}\\s*return (([\\w$]+?\\.join\\(""\\))|(Array\\.prototype\\.join\\.call\\([\\w$]+?,[\\n\\s]*(("")|(\\("",""\\)))\\)))\\s*\\}))`, N_TRANSFORM_FUNCTION = `var ${matchGroup1(FUNCTION_PATTERN, body)};`, CALLER_FUNCTION = `${N_FUNCTION_NAME}(${N_ARGUMENT});`;
        return N_TRANSFORM_FUNCTION + CALLER_FUNCTION;
    }
    catch (e) {
        return null;
    }
}
function getDecipherFunction(playerId, body) {
    const DECIPHER_FUNCTION = getExtractFunctions([extractDecipherWithName, extractDecipherFunc], body);
    if (!DECIPHER_FUNCTION) {
        Log_1.Logger.warning(`Could not parse decipher function.\nPlease report this issue with "${playerId}" in Issues at ${SHIM.info.issuesUrl}.\nStream URL will be missing.`);
    }
    return {
        argumentName: DECIPHER_ARGUMENT,
        code: DECIPHER_FUNCTION || '',
    };
}
function getNTransformFunction(playerId, body) {
    const N_TRANSFORM_FUNCTION = getExtractFunctions([extractNTransformFunc, extractNTransformWithName], body);
    if (!N_TRANSFORM_FUNCTION) {
        Log_1.Logger.warning(`Could not parse n transform function.\nPlease report this issue with "${playerId}" in Issues at ${SHIM.info.issuesUrl}.`);
    }
    return {
        argumentName: N_ARGUMENT,
        code: N_TRANSFORM_FUNCTION || '',
    };
}
//# sourceMappingURL=Html5Player.js.map