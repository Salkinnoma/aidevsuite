const onEvent = new Map();

// Event status types
const successStatus = 'successStatus';
const errorStatus = 'errorStatus';

// Event types
const logEventType = "logEventType";
const evalEventType = "evalEventType";
const showEventType = "showEventType";
const validateInputEventType = "validateInputEventType";
const delayedValidateInputEventType = "delayedValidateInputEventType";
const fileDownloadEventType = "fileDownloadEventType";
const dataURLDownloadEventType = "dataURLDownloadEventType";
const setProgressEventType = "setProgressEventType";
const setStatusEventType = "setStatusEventType";

// Element types
const containerType = "containerType";
const codeType = "codeType";
const breakType = "breakType";
const imageType = "imageType";
const paragraphType = "paragraphType";
const titleType = "titleType";
const subTitleType = "subTitleType";

// Container element types
const barType = "barType";

// Bar types
const navBarType = "navBarType";
const listBarType = "listBarType";
const fillBarType = "fillBarType";

// Input element types
const textInputType = "textInputType";
const numberInputType = "numberInputType";
const checkboxInputType = "checkboxInputType";
const pasteInputType = "pasteInputType";
const fileInputType = "fileInputType";

// Element type sets
const allTypes = new Set([
    codeType,
    breakType,
    imageType,
    paragraphType,
    titleType,
    subTitleType,
    textInputType,
    numberInputType,
    checkboxInputType,
    pasteInputType,
    fileInputType,
]);

const containerTypes = new Set([
    barType,
]);

const simpleTypes = new Set([
    paragraphType,
    titleType,
    subTitleType,
]);

const inputTypes = new Set([
    textInputType,
    numberInputType,
    checkboxInputType,
    pasteInputType,
    fileInputType,
]);


const htmlPasteItemType = "html";
const textPasteItemType = "text";
const rtfPasteItemType = "rtf";
const filesPasteItemType = "files";

// Helper functions
function generateUniqueId() {
    return Date.now() + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
}

async function log(...data) {
    return await requireResponse(logRequestType, JSON.stringify(data));
}

// Event logic to communicate with origin
function postRequest(type, content, id = null, pingId = null) {
    postMessage({id, pingId, type, content});
}

function postSuccessResponse(requestEvent, content, message = null) {
    postMessage({ id:requestEvent.data.id, type: requestEvent.data.type, response: true, status: successStatus, content, message });
}

function postErrorResponse(requestEvent, message, content = null) {
    postMessage({ id:requestEvent.data.id, type: requestEvent.data.type, response: true, status: errorStatus, content, message });
}

function requireResponse(type, content, onPing = null){
    return new Promise((resolve, reject) => {
        const id = generateUniqueId();
        const pingId = null;
        if (onPing != null) {
            pingId = generateUniqueId();
            onEvent.set(pingId, async (event) => {
                if (event.data.id !== pingId) return;
    
                try {
                    const result = await onPing(event.data.content);
                    postSuccessResponseToOrigin(event, result);
                } catch (e) {
                    postErrorResponseToOrigin(event, e.message);
                }
            });
        }

        onEvent.set(id, (event) => {
            if (event.data.id !== id) return;

            onEvent.delete(id);
            if (pingId != null) onEvent.delete(pingId);

            if (event.data.status === errorStatus) reject(event.data.message);
            else resolve(event.data.content);
        });


        postRequestToOrigin(type, content, id, pingId);
    });
}

async function onEvalRequest(e){
    try {
        store = e.data.content.store;
        const result = await eval("(async () => {" + e.data.content.code + "})()");  // Evaluate the incoming code
        const content = {
            result: result,
            store: store,
        };
        postSuccessResponseToOrigin(e, content);
    } catch (error) {
        postErrorResponseToOrigin(e, error.stack);
    }
}

onmessage = function(e){
    log("Origin Message Received:", e.data);
    if (e.data.type === evalRequestType) {
        onEvalRequest(e);
    } else if (onEvent.has(e.data.id)) {
        onEvent.get(e.data.id)();
    }
};


// Create elements
function createBreak() {
    const content = {
        type: breakType,
    };
    return content;
}

function createParagraph(text) {
    const content = {
        type: paragraphType,
        text: text,
    };
    return content;
}

function createTitle(text) {
    const content = {
        type: titleType,
        text: text,
    };
    return content;
}

function createSubTitle(text) {
    const content = {
        type: subTitleType,
        text: text,
    };
    return content;
}

function createImage(url, caption = null) {
    const content = {
        type: imageType,
        url: url,
        caption: caption,
    };
    return content;
}

function createBar(options = null) {
    options ??= {};
    const content = {
        type: barType,
        barType: options.type ?? navBarType,
        elements: options.elements ?? [],
    };
    return content;
}

/**
 * ## Parameters
 *
 * - **type** (string): Specifies the type of input. Supported values are:
 *   - `textInputType`
 *   - `numberInputType`
 *   - `checkboxInputType`
 *   - `fileInputType`
 *   - `pasteInputType`
 *
 * - **options** (object): An object that contains various options specific to the `type` of input. The options available depend on the input type.
 *
 *
 * ## Options Configuration by Input Type
 *
 * ### All Types
 * - **name** (string) [optional]: Recommended for use as part of the `showGroup` function.
 *
 * ### All Input Types
 * - **isInvalid** (bool) [optional]: Whether the input is invalid at start. Defaults to 'false'.
 * - **validationMessage** (string) [optional]: The initial validation message. Defaults to 'null'.
 * - **onValidate** (function) [optional]: A callback function that can be used for custom validation logic. It is called whenever the value of an input changes. Its parameters are group, element, and newData. The return value of onValidate must be an object with the following properties:
 *     - **valid** (bool): Whether the value is valid.
 *     - **message** (string) [optional]: An error message. Defaults to `null`.
 *     - **override** (object) [optional]: Allows overwriting the value of elements within the group. The object must be any number of elements mapped by their names.
 * - **onDelayedValidate** (function) [optional]: A callback function that can be used for custom validation logic. It is called only when a user wants to accept input. Its parameters are group, element, and newData. The return value of onValidate must be an object with the following properties:
 *     - **valid** (bool): Whether the value is valid.
 *     - **message** (string) [optional]: An error message. Defaults to `null`.
 *     - **override** (object) [optional]: Allows overwriting the value of elements within the group. The object must be any number of elements mapped by their names.
 *
 * ### `textInputType`
 *
 * When `type` is `textInputType`, the `options` object can have the following properties:
 *
 * - **defaultValue** (string) [optional]: The default text value for the input. Default is an empty string `''`.
 *
 * - **placeholder** (string) [optional]: The placeholder text that appears when the input is empty. Default is `"Enter text here..."`.
 *
 * ### `numberInputType`
 *
 * When `type` is `numberInputType`, the `options` object can have the following property:
 *
 * - **defaultValue** (number) [optional]: The default number value for the input. Default is 0.
 *
 * ### `checkboxInputType`
 *
 * When `type` is `checkboxInputType`, the `options` object can have the following property:
 *
 * - **defaultValue** (number) [optional]: The default bool value for the input. Default is false.
 *
 * - **description** (string) [optional]: A short description to the left of the checkbox. Default is an empty string `''`.
 *
 * ### `fileInputType`
 *
 * When `type` is `fileInputType`, the `options` object can have the following properties:
 *
 * - **allowedFileTypes** (array of strings) [optional]: Specifies the types of files (e.g .json) that are allowed. Default is an empty array `[]`.
 *
 * - **dropDescription** (string) [optional]: Description text for the drag-and-drop area. Default is `"Drag and drop valid files (any type)."` if `allowedFileTypes` is empty, or will list the allowed file types.
 *
 * - **selectDescription** (string) [optional]: Description text for the file selection area. Default is `"Or select files"`.
 *
 * - **accept** (string) [optional]: The `accept` attribute specifies the types of files that the server accepts. Default is an empty string `''`.
 *
 * - **multiple** (boolean) [optional]: Specifies whether multiple file selection is allowed. Default is `false`.
 *
 * - **maxSize** (number) [optional]: Specifies the maximum size (in bytes) for the file upload.
 *
 * ### `pasteInputType`
 *
 * When `type` is `pasteInputType`, the `options` object can have the following properties:
 *
 * - **emptyDescription** (string) [optional]: Description text when nothing has been pasted. Default is `'Paste (STRG + V) into here to continue.'`.
 *
 * - **replaceDescription** (string) [optional]: Description text when something has been pasted. Default is `Successfully pasted. Paste (STRG + V) into here to change its content.`.

 * ## Returns
 *
 * A content object for the `requestInput` and `requestMultiInput` functions.
 * */
function createInput(type, options) {
    const content = {
        type: type,
        options: options,
    };

    return content;
}


function _extractElements(group) {
    const elements = [];
    let unprocessedElements = [group];
    while (unprocessedElements.length !== 0) {
        const newUnprocessedElements = [];
        for (let element of unprocessedElements) {
            if (containerTypes.has(element.type)) newUnprocessedElements.push(element);
            else elements.push(element);
        }
        unprocessedElements = newUnprocessedElements;
    }
    return elements;
}

function _mapGroup(group) {
    const mapped = {};
    for (let element of _extractElements(group)) {
        if (inputTypes.has(element.type)) mapped[element.name] = element;
    }
    return mapped;
}

/**
 * The group parameter accepts an array of elements created via any of the create functions.
 * For inputs, it is recommended to define a name, to allow easy access of the return value.
 *
 * ## Return value when awaited
 * When this function is awaited, it returns an object that contains each input element from the group parameter with their name as a key. If no name is defined, their flattened index within the group is used instead, and added to the element as a name property.
 * Each returned input element additionally contains data as described by the `show` function.
 *
 * */
async function showGroup(...group) {
    const onValidateMap = new Map();
    const onDelayedValidateMap = new Map();
    const elements = _extractElements(group);


    for (let [index, element] of elements.entries()) {
        element.id = generateUniqueId();

        element.name = element.options.name ?? index;
        delete element.options.name;

        if (element.options?.onValidate != null) {
            const onValidate = element.options.onValidate;
            delete element.options.onValidate;
            element.hasValidation = true;
            onValidateMap.set(element.id, onValidate);
        }

        if (element.options?.onDelayedValidate != null) {
            const onDelayedValidate = element.options.onDelayedValidate;
            delete element.options.onDelayedValidate;
            element.hasValidation = true;
            onDelayedValidateMap.set(element.id, onDelayedValidate);
        }
    }

    const response = await requireResponse(showEventType, group, async (content) => {
        let map = null;
        if (content.validationType == validateInputEventType) {
            if (!onValidateMap.has(content.element.id)) return;
            map = onValidateMap;
        } else if (content.validationType == delayedValidateInputEventType) {
            if (!onDelayedValidateMap.has(content.element.id)) return;
            map = onDelayedValidateMap;
        }
        if (map == null) return;

        return await map.get(element.id)(_mapGroup(content.group), content.element, content.newData);
    });


    return _mapGroup(response);
}

/**
 * The element parameter should be created via any of the create functions.
 * For showing multiple elements at once, use the `showGroup` function.
 *
 * ## Return value when awaited
 * When this function is awaited:
 * - If the element is not an input, it returns null.
 * - If the element is an input, it returns an object with the options (or their default values) and additional properties depending on the input type:
 *
 * ### For `textInputType`
 *
 * ```javascript
 * {
 *     ...
 *     text: string // The text value of the input
 * }
 * ```
 *
 * ### For `numberInputType`
 *
 * ```javascript
 * {
 *     ...
 *     number: number // The number value of the input
 * }
 * ```
 *
 * ### For `checkboxInputType`
 *
 * ```javascript
 * {
 *     ...
 *     ticked: bool // Whether the checkbox was ticked
 * }
 * ```
 *
 * ### For `fileInputType`
 *
 * ```javascript
 * {
 *     ...
 *     files: [
 *         { // Custom object with data extracted from the file
 *             name: string, // The name of the file
 *             size: number, // The size of the file in bytes
 *             type: string, // The MIME type of the file
 *             lastModified: number, // The last modified timestamp of the file
 *             lastModifiedDate: Date, // The last modified date of the file
 *             text: string, // The text content of the file
 *             dataURL: string // The Data URL of the file
 *         },
 *         ...
 *     ]
 * }
 * ```
 *
 * ### For `pasteInputType`
 *
 * ```javascript
 * {
 *     ...
 *     html: string // The html value of the input
 *     text: string // The text value of the input
 *     rtf: string // The rtf value of the input
 *     files: [
 *         { // Custom object with data extracted from the file
 *             name: string, // The name of the file
 *             size: number, // The size of the file in bytes
 *             type: string, // The MIME type of the file
 *             lastModified: number, // The last modified timestamp of the file
 *             lastModifiedDate: Date, // The last modified date of the file
 *             text: string, // The text content of the file
 *             dataURL: string // The Data URL of the file
 *         },
 *         ...
 *     ]
 * }
 * ```
 * */
async function show(element) {
    let result = await showGroup(element);
    return result[element.name];
}

async function requestFileDownload(name, type, content) {
    const file = {
        name: name,
        type: type,
        content: content,
    }
    return await requireResponse(fileDownloadRequestType, file);
}

async function requestDataURLDownload(name, dataURL) {
    const file = {
        name: name,
        dataURL: dataURL,
    }
    return await requireResponse(dataURLDownloadRequestType, file);
}

/**
 * Sets the current progress of the application.
 *
 * ## Parameters
 * - **progress** (float): The desired progress. This is clamped between 0 and 0.9. After the program is finished, this is set to 1.
 * */
async function setProgress(progress) {
    return await requireResponse(setProgressRequestType, progress);
}

/**
 * Sets the current status message of the application.
 *
 * ## Parameters
 * - **status** (string): The status message.
 * */
async function setStatus(status) {
    return await requireResponse(setStatusRequestType, status);
}


// Internal helper functions
const _helpers = {
    escapeHtmlChars: {
        '¢' : 'cent',
        '£' : 'pound',
        '¥' : 'yen',
        '€': 'euro',
        '©' :'copy',
        '®' : 'reg',
        '<' : 'lt',
        '>' : 'gt',
        '"' : 'quot',
        '&' : 'amp',
        '\'' : '#39',
    },
    getEscapeHtmlRegex(){
        let escapeHtmlRegexString = '[';
        for(let key in _helpers.escapeHtmlChars) {
            escapeHtmlRegexString += key;
        }
        escapeHtmlRegexString += ']';
        const regex = new RegExp(escapeHtmlRegexString, 'g');
        return regex;
    },
    htmlEntities: {
        nbsp: ' ',
            cent: '¢',
            pound: '£',
            yen: '¥',
            euro: '€',
            copy: '©',
            reg: '®',
            lt: '<',
            gt: '>',
            quot: '"',
            amp: '&',
            apos: '\''
    },
};
_helpers.escapeHtmlRegex = _helpers.getEscapeHtmlRegex();

// Extended helper functions
let commonFileTypes = {
    plainText: "text/plain",
    json: "application/json",
    csv: "text/csv",
}

function escapeFileName(filename) {
    return filename.replace(/[^a-zA-Z0-9.- ]/g, "_");
}

function escapeHTML(str) {
    return str.replace(_helpers.escapeHtmlRegex, function(m) {
        return '&' + _helpers.escapeHtmlChars[m] + ';';
    });
}

function unescapeHTML(str) {
    return str.replace(/\\&([^;]+);/g, function (entity, entityCode) {
        let match;

        if (entityCode in _helpers.htmlEntities) {
            return _helpers.htmlEntities[entityCode];
            /*eslint no-cond-assign: 0*/
        } else if (match = entityCode.match(/^#x([\\da-fA-F]+)$/)) {
            return String.fromCharCode(parseInt(match[1], 16));
            /*eslint no-cond-assign: 0*/
        } else if (match = entityCode.match(/^#(\\d+)$/)) {
            return String.fromCharCode(~~match[1]);
        } else {
            return entity;
        }
    });
}