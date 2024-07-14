const onEvent = new Map();
const onPingEvent = new Map();

// Event status types
const successStatus = 'successStatus';
const errorStatus = 'errorStatus';

// Event types
const logEventType = "logEventType";
const evalEventType = "evalEventType";
const loadEventType = "loadEventType";
const showEventType = "showEventType";
const readEventType = "readEventType";
const updateEventType = "updateEventType";
const removeEventType = "removeEventType";
const acceptEventType = "acceptEventType";
const validateInputEventType = "validateInputEventType";
const delayedValidateInputEventType = "delayedValidateInputEventType";
const clickEventType = "clickEventType";
const chatEventType = "chatEventType";
const chatStreamEventType = "chatStreamEventType";
const fileDownloadEventType = "fileDownloadEventType";
const dataURLDownloadEventType = "dataURLDownloadEventType";
const setProgressEventType = "setProgressEventType";
const setStatusEventType = "setStatusEventType";
const storageEventType = "storageEventType";

// Element types
const breakType = "breakType";
const rulerType = "rulerType";
const emptyType = "emptyType";
const markdownType = "markdownType"; // Includes Katex math parser.

const paragraphType = "paragraphType";
const titleType = "titleType";
const subTitleType = "subTitleType";
const codeType = "codeType";
const imageType = "imageType";
const iconType = "iconType";

// Icon types
const materialIconProvider = "materialIconProvider";
const heroIconProvider = "heroIconProvider";

// Container element types
const barType = "barType";
const verticalType = "verticalType";
const buttonType = "buttonType";

// Bar sub types
const navBarType = "navBarType";
const listBarType = "listBarType";
const fillBarType = "fillBarType";

// Button sub types
const simpleButtonType = "simpleButtonType";
const complexButtonType = "complexButtonType";

// Input element types
const textInputType = "textInputType";
const numberInputType = "numberInputType";
const passwordInputType = "passwordInputType";
const codeInputType = "codeInputType";
const markdownInputType = "markdownInputType";
const checkboxInputType = "checkboxInputType";
const selectInputType = "selectInputType";
const imageInputType = "imageInputType";
const pasteInputType = "pasteInputType";
const fileInputType = "fileInputType";

// Element type sets
const allTypes = new Set([
    breakType,
    rulerType,
    emptyType,
    markdownType,
    paragraphType,
    titleType,
    subTitleType,
    codeType,
    imageType,
    iconType,
    barType,
    verticalType,
    buttonType,
    textInputType,
    numberInputType,
    passwordInputType,
    codeInputType,
    markdownInputType,
    checkboxInputType,
    selectInputType,
    pasteInputType,
    fileInputType,
]);

const containerTypes = new Set([
    barType,
    verticalType,
    buttonType,
]);

const textTypes = new Set([
    paragraphType,
    titleType,
    subTitleType,
]);

const inputTypes = new Set([
    textInputType,
    numberInputType,
    passwordInputType,
    codeInputType,
    markdownInputType,
    checkboxInputType,
    selectInputType,
    imageInputType,
    pasteInputType,
    fileInputType,
]);


// Paste item types
const htmlPasteItemType = "html";
const textPasteItemType = "text";
const rtfPasteItemType = "rtf";
const filesPasteItemType = "files";

// Group locations
const mainLocation = "main";
const stickyLocation = "sticky";
const dialogLocation = "dialog";

// Helper functions
function generateUniqueId() {
    return Date.now() + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
}

// If you use buttons with `noAccept`, there's a very high chance you will want to await this at the end of your script.
async function forever() {
    await new Promise(() => {});
    log('This will never run!');
}

// Event logic to communicate with origin
function postRequest(type, content, id = null, pingId = null, pingSourceEvent = null) {
    postMessage({ id, pingId, pingSourceId: pingSourceEvent?.pingId, type, content });
}

function postSuccessResponse(requestEvent, content = null, message = null) {
    postMessage({ id:requestEvent.id, type: requestEvent.type, response: true, status: successStatus, content, message });
}

function postErrorResponse(requestEvent, message, content = null) {
    postMessage({ id:requestEvent.id, type: requestEvent.type, response: true, status: errorStatus, content, message });
}

function postIFrameMessage(type, content) {
    postMessage({ iframe: true, type, content });
}

function requireResponse(type, content, onPing = null, pingSourceEvent = null){
    return new Promise((resolve, reject) => {
        const id = generateUniqueId();
        let pingId = null;
        if (onPing != null) {
            pingId = generateUniqueId();
            onPingEvent.set(pingId, async (event) => {
                try {
                    const result = await onPing(event.content, event);
                    postSuccessResponse(event, result);
                } catch (e) {
                    postErrorResponse(event, e);
                }
            });
        }

        onEvent.set(id, (event) => {
            onEvent.delete(id);
            if (pingId != null) onPingEvent.delete(pingId);

            if (event.status === errorStatus) reject(new Error(event.message));
            else resolve(event.content);
        });

        postRequest(type, content, id, pingId, pingSourceEvent);
    });
}

function createObjectUrl(object, options) {
    const blob = new Blob([object], options);
    const blobUrl = URL.createObjectURL(blob);
    postIFrameMessage('url', blobUrl);
    return blobUrl;
}

const __importCallbacks = new Map();
const __importErrorCallbacks = new Map();
function importCode(code) {
    return new Promise((resolve, reject) => {
        const id = generateUniqueId();
        const blobUrl = createObjectUrl(`async function _____outerImportWrapper_____() {async function _____importWrapper_____() {\n\n\n/* Script starts here */\n${code}\n/* Script ends here */\n\n\n}\ntry{\nawait _____importWrapper_____();\n__importCallbacks.get("${id}")();}\ncatch(e) {\n__importErrorCallbacks.get("${id}")(e);\n}\n}\n_____outerImportWrapper_____();`, {type: commonMimeTypes.javascript});
        __importCallbacks.set(id, () => resolve());
        __importErrorCallbacks.set(id, e => reject(e));
        importScripts(blobUrl); // Evaluate the incoming code
    });
}

async function log(...data) {
    return await requireResponse(logEventType, JSON.stringify(data));
}

async function onEvalRequest(e){
    // Important: Your code will be evaluated in here. The moment it ends, the worker will be terminated and callbacks like button `onClick` cease to work. To never terminate, await `forever` at the end of the script.
    await importCode(e.content.code);
    postSuccessResponse(e);
}

onmessage = async function(e){
    if (e.data.source != 'origin') return;

    const data = e.data.message;
    if (data.type !== logEventType) await log("Origin Message Received:", data);

    try {
        if (onEvent.has(data.id)) {
            onEvent.get(data.id)(data);
        } else if (onPingEvent.has(data.pingSourceId)) {
            onPingEvent.get(data.pingSourceId)(data);
        } else if (data.type === evalEventType) {
            await onEvalRequest(data);
        }
    } catch (error) {
        postErrorResponse(data, error);
        throw error;
    }
};

/**
 * Load and execute a script from a url.
 */
async function load(url) {
    const result = await requireResponse(loadEventType, url);
    return await importCode(result);
}

/**
 * Create elements using various create functions. The `options` parameter of any elements can additionally take the following properties:
 * - **name** (string) [optional]: This is necessary for the `update`, `remove` and some other functions that require an element name functions. After calling `showGroup` or `show`, this can be accessed via element.name.
 * - **bordered** (bool) [optional]: Whether to add a border around them.
 * - **breakBefore** (number) [optional]: Adds a break before with the value as its size. Must be between 0 and 8. Default is `0`.
 * - **breakAfter** (number) [optional]: Adds a break after with the value as its size. Must be between 0 and 8. Default is `0`.
 * - **hide** (bool) [optional]: This can be useful when smoothly wanting to add to elements of containers without recreating the entire container, as they can't be added via `update`. Default is `false`.
 * - **leftElements** (array) [optional]: An array of small elements to float to the left of an element.
 * - **rightElements** (array) [optional]: An array of small elements to float to the right of an element.
 */

/**
 * Creates a break. Not really necessary due to the default `gap`s.
 * 
 * - **size** (number) [optional]: How large the break is. Must be between 1 and 8.
 */
function createBreak(size, options = null) {
    const content = {
        type: breakType,
        size,
        options,
    };
    return content;
}

/**
 * Creates a ruler (hr).
 * - **options** (object) [optional]: An object that can have the following properties:
 *     - **vertical** (bool) [optional]: Whether the ruler should be vertical. This is useful for bars.
 */
function createRuler(options = null) {
    const content = {
        type: rulerType,
        options,
    };
    return content;
}

// Create empty placeholder elements for use in navBarLists, as they use `justify-content: space-between;`
function createEmpty(options = null) {
    const content = {
        type: emptyType,
        options,
    };
    return content;
}

/**
 * - **type** (string): Specifies the type of element. All `textTypes` are supported.
 * - **options** (object): An object that can have the following properties depending on its `type`:
 * 
 * ## All Types
 *     - **title** (string) [optional]: The title to be shown on hover. *Only* use for small labels with size constraints.
 *     - **useTooltipInstead** (bool) [optional]: Whether to show the title using a custom tooltip instead of the inbuilt title property. Default is `true`.
 */
function createText(type, text, options = null) {
    const content = {
        type,
        text,
        options,
    };
    return content;
}

/**
 * - **options** (object): An object that can have the following properties:
 *     - **language** (string) [optional]: The language of the code.
 *     - **title** (string) [optional]: The title to be shown on hover. *Only* use for small labels with size constraints.
 *     - **useTooltipInstead** (bool) [optional]: Whether to show the title using a custom tooltip instead of the inbuilt title property. Default is `true`.
 */
function createCode(code, options = null) {
    const content = {
        type: codeType,
        code,
        options,
    };
    return content;
}

/**
 * - **options** (object): An object that can have the following properties:
 *     - **katex** (bool) [optional]: Whether to render katex. Default is `true`.
 *     - **katexDelimiters** (array) [optional]: The delimiters to use to find find math equations. Default:
 *         [
 *             {left: "$$", right: "$$", display: true},
 *             {left: "\\(", right: "\\)", display: false},
 *             //{left: "$", right: "$", display: false} // LaTeX uses $…$, but it ruins the display of normal `$` in text ($ must come after $$). Use \(...\) for inline math instead.
 *             {left: "\\begin{equation}", right: "\\end{equation}", display: true},
 *             {left: "\\begin{align}", right: "\\end{align}", display: true},
 *             {left: "\\begin{alignat}", right: "\\end{alignat}", display: true},
 *             {left: "\\begin{gather}", right: "\\end{gather}", display: true},
 *             {left: "\\begin{CD}", right: "\\end{CD}", display: true},
 *             {left: "\\[", right: "\\]", display: true},
            ]
 */
function createMarkdown(markdown, options = null) {
    const content = {
        type: markdownType,
        markdown,
        options,
    };
    return content;
}

/**
 * - **options** (object): An object that can have the following properties:
 *     - **caption** (string) [optional]: The caption for the image.
 *     - **title** (string) [optional]: The title to be shown on hover.
 *     - **useTooltipInstead** (bool) [optional]: Whether to show the title using a custom tooltip instead of the inbuilt title property. Default is `true`.
 */
function createImage(url, options = null) {
    const content = {
        type: imageType,
        url,
        options,
    };
    return content;
}

/**
 * ## Parameters
 * - **ds** (array of strings or a string): If it is an array, it creates a path element for each d. If it is a string, it uses predefined paths. *Only* the following string values are supported (Do not use any other string values): `"close"`, `"expandMore"`, `"expandLess"`, `"menu"`, `"menuClose"`, `"menuHorizontal"`, `"download"`, `"upload"`, `"lock"`, `"noLock"`, `"edit"`, `"noEdit"`, `"delete"`, `"highlight"`, `"highlightOff"`, `"play"`, `"settings"`, `"sparkles"`, `"star"`, `"starFilled"`, `"copy"`, `"user"`, `"cpu"`, `"link"`, `"dollar"`, `"at"`, `"photo"`, `"retry"`, `"undo"`, `"redo"`.
 * - **iconProvider** (string): The type of the icon. Can be null if `ds` is a string. Supported values are:
 *     - `materialIconProvider`
 *     - `heroIconProvider`
 * - **options** (object): An object that can have the following properties:
 *     - **title** (string) [optional]: The title to be shown on hover.
 *     - **useTooltipInstead** (bool) [optional]: Whether to show the title using a custom tooltip instead of the inbuilt title property. Default is `true`.
 */
function createIcon(ds, iconProvider, options = null) {
    const content = {
        type: iconType,
        ds,
        iconProvider,
        options,
    };
    return content;
}

/**
 * ## Parameters
 * - **type** (string): Specifies the type of the container. Supported values are:
 *     - `barType`
 *     - `verticalType`
 * - **elements** (object or array): A single element or a list of elements displayed within the container. Please do not put buttons or interactables within buttons.
 * - **options** (object): An object that contains various options specific to the `type` of input. The options available depend on the input type.
 * 
 * ## Options Configuration by Container Type
 * ### All Types
 * - **gap** (number) [optional]: The gap between elements. Must be between `0` and `8`. Default is `4`.
 * - **title** (string) [optional]: The title to be shown on hover. *Only* use for small labels with size constraints.
 * - **useTooltipInstead** (bool) [optional]: Whether to show the title using a custom tooltip instead of the inbuilt title property. Default is `true`.
 * 
 * ### `barType`
 * - **barSubType** (string) [optional]: The type of the bar or list. Default is `navBarType`. Supported values are:
 *     - `navBarType` // Uses `justify-content: space-between;`, works well with `emptyType` elements. E.g. a navBar with an emptyElement and a button will cause the button to float right.
 *     - `listBarType` // Normal wrapping list
 *     - `fillBarType` // Uses `flex` to try to share the horzontal space but also fill it
 * 
 * ### `verticalType`
 * - **centered** (bool) [optional]: Whether the items should be centered. Default is `false`.
 * 
 * ### `buttonType`
 * - **buttonSubType** (string): Specifies the type of the button. Default is `complexButtonType`. Supported values are:
 *     - `simpleButtonType` // *Only* use this for small buttons that should blend in, such as an X to close a dialog.
 *     - `complexButtonType` // Use this for buttons that should be strongly visible, such as a Save or Cancel button.
 * - **onClick** (function): A callback function that is called whenever the button is clicked. It has neither parameters nor a return value.
 * - **fullWidth** (bool) [optional]: Whether its width should be stretched to 100%. Default is `false`.
 * - **disabled** (bool) [optional]: Whether the button is disabled. Default is `false`.
 */
function createContainer(type, elements, options = null) {
    options ??= {};
    const content = {
        type,
        elements: Array.isArray(elements) ? elements : [elements],
        options,
    };
    return content;
}

function createFloatRightWrapper(element, options = null) {
    options ??= {};
    const content = {
        type: barType,
        elements: [createEmpty(), element],
        options,
    };
    return content;
}

function createFloatCenterWrapper(element, options = null) {
    options ??= {};
    const content = {
        type: barType,
        elements: [createEmpty(), element, createEmpty(),],
        options,
    };
    return content;
}

/**
 * ## Parameters
 * - **type** (string): Specifies the type of input. All `inputTypes` are supported.
 * - **options** (object): An object that contains various options specific to the `type` of input. The options available depend on the input type.
 *
 * ## Options Configuration by Input Type
 *
 * ### All Types
 * - **name** (string) [optional]: Recommended for use as part of the `showGroup` function.
 * - **disabled** (bool) [optional]: Whether user input is disabled. Default is `false`.
 *
 * ### All Input Types
 * - **onValidate** (function) [optional]: A callback function that can be used for custom validation logic. It is called whenever the value of an input changes. Its parameters are group, element. The return value of onValidate must be an object with the following properties:
 *     - **valid** (bool): Whether the value is valid.
 *     - **message** (string) [optional]: An error message. Defaults to `'Invalid value. Please choose a different value.'`.
 * - **onDelayedValidate** (function) [optional]: A callback function that can be used for custom validation logic. It is called only when a user wants to accept input. This doesn't work in combination with `noAccept`. Its parameters are group, element. The return value of onValidate must be an object with the following properties:
 *     - **valid** (bool): Whether the value is valid.
 *     - **message** (string) [optional]: An error message. Defaults to `'Invalid value. Please choose a different value.'`.
 *
 * ### `textInputType`
 * - **defaultValue** (string) [optional]: The default text value for the input. Default is an empty string `''`.
 * - **placeholder** (string) [optional]: The placeholder text that appears when the input is empty. Default is `"Enter text here..."`.
 * - **spellcheck** (bool) [optional]: Whether to enable spellcheck. Default is `false`.
 * - **maxHeight** (number) [optional]: Must be between `0` and `8`. For no max height use `0`. Default is `6`.
 *
 * ### `numberInputType`
 * - **defaultValue** (number) [optional]: The default number value for the input. Default is `0`.
 * 
 * ### `passwordInputType`
 * - **defaultValue** (string) [optional]: The default text value for the input. Default is an empty string `''`.
 * - **placeholder** (string) [optional]: The placeholder text that appears when the input is empty. Default is `"Enter password here..."`.
 *
 * ### `codeInputType`
 * - **defaultValue** (string) [optional]: The default code value for the input. Default is an empty string `''`.
 * - **placeholder** (string) [optional]: The placeholder text that appears when the input is empty. Default is `"Enter code here..."`.
 * - **language** (string) [optional]: The language of the code.
 * - **context** (string) [optional]: Information about the context in which the code will be executed. Allows better integration with chatbots.
 * - **maxHeight** (number) [optional]: Must be between `0` and `8`. For no max height use `0`. Default is `6`.
 * 
 * ### `markdownInputType`
 * - **defaultValue** (string) [optional]: The default code value for the input. Default is an empty string `''`.
 * - **placeholder** (string) [optional]: The placeholder text that appears when the input is empty. Default is `"Enter markdown here..."`.
 * - **spellcheck** (bool) [optional]: Whether to enable spellcheck. Default is `false`.
 * - **katex** (bool) [optional]: Whether to render katex. Default is `true`.
 * - **katexDelimiters** (array) [optional]: The delimiters to use to find find math equations. Default: Same as for `createText`.
 * - **maxHeight** (number) [optional]: Must be between `0` and `8`. For no max height use `0`. Default is `6`.
 * 
 * ### `checkboxInputType`
 * - **defaultValue** (number) [optional]: The default bool value for the input. Default is false.
 * - **description** (string) [optional]: A short description to the left of the checkbox. Default is an empty string `''`.
 * 
 * ### `selectInputType`
 * - **defaultValue** (number) [optional]: The default number value for the input. Default is the value of the first choice.
 * - **choices** (array): An array of option objects that have the following properties.
 *     - **value** (string) [optional]: The value of the option. Default is its index.
 *     - **name** (string) [optional]: The name of the option. Default is its value.
 * 
 * ### `imageInputType`
 * - **defaultValue** (string) [optional]: The default url value for the input. Default is an empty string `''`.
 * - **placeholder** (string) [optional]: The placeholder text that appears when the input is empty. Default is `"Enter image here..."`.
 * - **editableCaption** (bool) [optional]: Whether the caption can be edited. Default is false.
 * - **defaultCaptionValue** (string) [optional]: The default caption value for the input. Default is an empty string `''`.
 * - **captionPlaceholder** (string) [optional]: The placeholder text that appears when the caption input is empty. Default is `"Enter caption here..."`.
 * - **spellcheck** (bool) [optional]: Whether to enable spellcheck for the caption. Default is `false`.
 * - **maxHeight** (number) [optional]: Must be between `0` and `8`. For no max height use `0`. Default is `6`.
 * - **captionMaxHeight** (number) [optional]: Must be between `0` and `8`. For no max height use `0`. Default is `6`.
 *
 * ### `fileInputType`
 * - **allowedMimeTypes** (array of strings) [optional]: Specifies the mime types (e.g application/json) that are allowed. Wildcards are supported. Default is an empty array `[]`.
 * - **allowedExtensions** (array of strings) [optional]: Specifies the file extensions (e.g .json) that are allowed. Default is an empty array `[]`.
 * - **dropDescription** (string) [optional]: Description text for the drag-and-drop area. Default is `"Drag and drop valid files (any type)."` if `allowedExtensions` is empty, or will list the allowed file types.
 * - **selectDescription** (string) [optional]: Description text for the file selection area. Default is `"Or select files"`.
 * - **noFileSelectedMessage** (string) [optional]: Shown when no file is selected. Default is `"No file selected."`.
 * - **multiple** (boolean) [optional]: Specifies whether multiple file selection is allowed. Default is `false`.
 * - **maxSize** (number) [optional]: Specifies the maximum size (in bytes) for the file upload.
 *
 * ### `pasteInputType`
 * - **emptyDescription** (string) [optional]: Description text when nothing has been pasted. Default is `'Paste (STRG + V) into here to continue.'`.
 * - **replaceDescription** (string) [optional]: Description text when something has been pasted. Default is `Successfully pasted. Paste (STRG + V) into here to change its content.`.
 * 
 * ## Returns
 * A content object for the `showGroup` and `show` functions.
 * */
function createInput(type, options = null) {
    const content = {
        type: type,
        options: options,
    };

    return content;
}


function _extractElements(group) {
    const elements = [];
    let unprocessedElements = group;
    while (unprocessedElements.length !== 0) {
        let newUnprocessedElements = [];
        for (let element of unprocessedElements) {
            if (containerTypes.has(element.type)) newUnprocessedElements = newUnprocessedElements.concat(element.elements);
            if (element.leftElements != null) newUnprocessedElements = newUnprocessedElements.concat(element.leftElements);
            if (element.rightElements != null) newUnprocessedElements = newUnprocessedElements.concat(element.rightElements);
            elements.push(element);
        }
        unprocessedElements = newUnprocessedElements;
    }
    return elements;
}

function _mapGroup(group) {
    const mapped = {};
    for (let element of group) {
        mapped[element.name] = element;
    }
    return mapped;
}

/**
 * - **group** (array): The group parameter accepts an array of elements created via any of the create functions. For inputs, it is recommended to define a name, to allow easy access of the return values.
 * - **options** (object) [optional]: An object that can have the following properties:
 *     - **name** (string) [optional]: This is necessary for the `update`, `remove` and some other functions that require a group name functions.
 *     - **noAccept** (bool) [optional]: Whether the input can be accepted via a default accept button. If you add your own custom button to accept input, you must set this to true! If an input can be accepted multiple times, set this to `true` and add custom logic that uses the `read` function to read the input values upon a click on a custom button. Default is `false`.
 *     - **bordered** (number) [optional]: Whether the group should be bordered. Default is `false`.
 *     - **location** (string) [optional]: The location of the group. Default is `mainLocation`. The following values are supported:
 *         - `mainLocation`: The default location.
 *         - `stickyLocation`: The group will stick to the top of the page.
 *         - `dialogLocation`: The group will be shown within a dialog. It is recommended to start the group with a title. Only one dialog can be shown at a time. Removing a dialog element will close the dialog. A dialog element is automatically `remove`d after the user closes (noAccept == true only), cancels (noAccept == false only) or accepts (noAccept == false only) it. This will be awaited. Returns error response on cancel.
 *     - **insertAt** (number) [optional]: Where to insert. This allows negative indices. The default is `-1`.
 *     - **insertBefore** (string) [optional]: Name of the group to insert before.
 *     - **insertAfterInstead** (bool) [optional]: Modifies insertBefore to insert after that group instead. Default is `false`.
 *     - **deleteAfter** (number) [optional]: How many to delete after this. The default is `0`.
 *     - **deleteBefore** (number) [optional]: How many to delete before this. The default is `0`.
 *     - **breakBefore** (number) [optional]: Adds a break before with the value as its size. Must be between 0 and 8. Default is `0`.
 *     - **breakAfter** (number) [optional]: Adds a break after with the value as its size. Must be between 0 and 8. Default is `0`.
 *     - **gap** (number) [optional]: The gap between elements. Must be between `0` and `8`. Default is `4`.
 *     - **noCloseOnOverlay** (bool) [optional]: This is exclusive to dialogs with `noAccept == true`. This requires implementing custom closing logic. Default is `false`.
 *
 * ## Return value when awaited
 * When this function is awaited, it returns an object that contains each input element (only input elements) from the group parameter with their name as a key. If no name is defined, their flattened index within the group is used instead, and added to the element as a name property.
 * Each returned input element contains data as described by the `show` function.
 * */
async function showGroup(group, options) {
    const onValidateMap = new Map();
    const onDelayedValidateMap = new Map();
    const onClickMap = new Map();
    const elements = _extractElements(group);


    for (let [index, element] of elements.entries()) {
        element.id = generateUniqueId();
        element.options ??= {};

        element.name = element.options.name ?? index;

        if (element.options?.onValidate != null) {
            const onValidate = element.options.onValidate;
            delete element.options.onValidate;
            element.hasValidation = true;
            onValidateMap.set(element.name, onValidate);
        }

        if (element.options?.onDelayedValidate != null) {
            const onDelayedValidate = element.options.onDelayedValidate;
            delete element.options.onDelayedValidate;
            element.hasDelayedValidation = true;
            onDelayedValidateMap.set(element.name, onDelayedValidate);
        }

        if (element.options?.onClick != null) {
            const onClick = element.options?.onClick;
            delete element.options.onClick;
            onClickMap.set(element.name, onClick);
        }
    }

    const buttons = elements.filter(e => e.type == buttonType);
    for (let element of buttons) {
        requireResponse(clickEventType, element.id, _ => onClickMap.get(element.name)()); // Don't await
    }

    const response = await requireResponse(showEventType, {children: group, options}, async (content, event) => {
        let map = null;
        if (event.type == validateInputEventType) {
            map = onValidateMap;
        } else if (event.type == delayedValidateInputEventType) {
            map = onDelayedValidateMap;
        }
        return await map.get(content.element.name)(_mapGroup(content.group), content.element);
    });

    return _mapGroup(response ?? []);
}

/**
 * The element parameter should be created via any of the create functions.
 * For showing multiple elements at once, use the `showGroup` function.
 * Important: The returned objects are deep copies. They are not updated on input. The updated values must be fetched either via the `onValidate` callback or the `read` function.
 * 
 * ## Parameters
 * The parameters are the same as for the `showGroup` function. Take special note of the `name`, `noAccept` and delete options. By default the `name` will be the same as the element `name`.
 *
 * ## Return value when awaited
 * When this function is awaited:
 * - If and only if the element is an input, it returns an object with following properties:
 *
 * ### All Types
 * - **name** (string): The name assigned to the element.
 * 
 * ### For `textInputType`
 * - **text** (string): The text value of the input.
 * 
 * ### For `codeInputType`
 * - **code** (string): The code value of the input.
 * 
 * ### For `markdownInputType`
 * - **markdown** (string): The markdown value of the input.
 *
 * ### For `numberInputType`
 * - **number** (number): The number value of the input.
 *
 * ### For `passwordInputType`
 * - **password** (string): The password value of the input.
 *
 * ### For `checkboxInputType`
 * - **checked** (bool): Whether the checkbox was checked.
 * 
 * ### For `selectInputType`
 * - **value** (string): The selected value.
 * 
 * ### For `imageInputType`
 * - **url** (string): The url value of the input.
 * - **caption** (string): The caption value of the input.
 *
 * ### For `fileInputType`
 * - **files** (array): List of files with the following properties:
 *     - **name** (string): The name of the file.
 *     - **size** (number): The size of the file in bytes.
 *     - **type** (string): The MIME type of the file.
 *     - **lastModified** (number): The last modified timestamp of the file.
 *     - **lastModifiedDate** (Date): The last modified date of the file.
 *     - **text** (string): The text content of the file.
 *     - **dataURL** (string): The Data URL of the file.
 *
 * ### For `pasteInputType`
 * - **html** (string): The html value of the input.
 * - **text** (string): The text value of the input.
 * - **rtf** (string): The rtf value of the input.
 * - **files** (array): List of files with the following properties:
 *     - **name** (string): The name of the file.
 *     - **size** (number): The size of the file in bytes.
 *     - **type** (string): The MIME type of the file.
 *     - **lastModified** (number): The last modified timestamp of the file.
 *     - **lastModifiedDate** (Date): The last modified date of the file.
 *     - **text** (string): The text content of the file.
 *     - **dataURL** (string): The Data URL of the file.
 * */
async function show(element, options = null) {
    options ??= {};
    options.name ??= element.options?.name;
    let result = await showGroup([element], options);
    return result[element.name];
}

/**
 * If the element is an input element, it returns the current values of the input as described by the `show` function.
 * 
 * If `elementName` is null, it will be set to `groupName`.
 */
async function read(groupName, elementName = null) {
    elementName ??= groupName;
    return await requireResponse(readEventType, {groupName, elementName});
}

/**
 * Returns the current values of all inputs of the group as described by the `show` function.
 */
async function readGroup(groupName) {
    return await requireResponse(readEventType, {groupName, elementName: null});
}

/**
 * - **groupName** (string): The name of the group to update.
 * - **elementName** (string): The name of the element to update. If null, it will be set to `groupName`. You cannot update accepted inputs (after awaiting return value).
 * - **properties** (object): An object that contains the properties to update. The following properties are available:
 *     - All properties passed into any of the create functions, except `type`, `options`, any child element properties and any of the callback functions.
 *     - All properties of the `options` property, except `defaultValue` and any of the callback functions.
 *     - All return value properties from inputs.
 */
async function update(groupName, elementName, properties) {
    elementName ??= groupName;
    await requireResponse(updateEventType, {groupName, elementName, properties});
}

/**
 * - **groupName** (string) [optional]: The name of the group to delete. If null, all groups are deleted instead.
 * - **elementName** (string) [optional]: The name of the element to delete. If null, the entire group is deleted instead.
 */
async function remove(groupName = null, elementName = null) {
    await requireResponse(removeEventType, {groupName, elementName});
}

/**
 * - **groupName** (string) [optional]: The name of the group to accept input from. This is only useful if `noAccept == true`. If null, all inputs across all groups will be accepted instead.
 */
async function accept(groupName = null) {
    await requireResponse(acceptEventType, {groupName});
}

/**
 * This allows communicating with a chatbot. A chatbot always responds with markdown.
 * - **context** (array): A list of message objects.
 * - **options** (object): An object that can have the following properties:
 *     - **element** (string or array of 2 strings) [optional]: Allows streaming to an element. If it is a string, it must represent both the group name and the element name. If it is an array, the first string must be the `name` of the group, the second must be the `name` of the element. If streaming to an input, it will be disabled for user input while streaming. This only works on elements with a string value, such as text, caption, code etc..
 *     - **onUpdate** (function) [optional]: Allows streaming to a callback function. The function can optionally return a string to update the value to e.g. extract code blocks. The function takes in the following parameters:
 *         - **response** (string): The newly streamed tokens concatenated with the previous response text.
 *     - **model** (string) [optional]: The model to be used. Default is `ChatHelpers.gpt4OmniIdentifier`.
 *     - **seed** (number) [optional]: The seed to be used. Very unreliable.
 */
async function chat(context, options = null) {
    const onUpdate = options?.onUpdate;

    let response;
    if (onUpdate == null) {
        response = await requireResponse(chatEventType, {context, options});
    } else {
        delete options.onUpdate;
        options.hasOnUpdate = true;
        response = await requireResponse(chatEventType, {context, options}, (content, event) => {
            const transformed = onUpdate(content);
            postSuccessResponse(event, transformed);
        });
    }

    return response;
}

async function requestFileDownload(name, type, content) {
    const file = {
        name: name,
        type: type,
        content: content,
    }
    return await requireResponse(fileDownloadEventType, file);
}

async function requestDataURLDownload(name, dataURL) {
    const file = {
        name: name,
        dataURL: dataURL,
    }
    return await requireResponse(dataURLDownloadEventType, file);
}

/**
 * Shows a progress bar at the top. This is useful if something may take long.
 *
 * ## Parameters
 * - **progress** (float): The desired progress. This is clamped between 0 and 100. Set to null to hide progress again.
 * */
async function setProgress(progress) {
    return await requireResponse(setProgressEventType, progress);
}

/**
 * Sets the current status message of the application. Can be used in combination with progress if something may take long.
 *
 * ## Parameters
 * - **status** (string): The status message.
 * */
async function setStatus(status) {
    return await requireResponse(setStatusEventType, status);
}

// Storage that persists across sessions. Useful for inputs that become repetitive for the user.
class Storage {
    // Returns false if the script doesn't have access to a storage.
    static async exists() {
        await requireResponse(storageEventType, {exists: true});
    }

    static async set(key, string) {
        await requireResponse(storageEventType, {set: {key, value: string}});
    }

    // Returns null if the script doesn't have access to a storage.
    static async get(key) {
        return await requireResponse(storageEventType, {get: key});
    }

    static async delete(key) {
        await requireResponse(storageEventType, {delete: key});
    }

    static async setObject(key, object) {
        await this.set(key, JSON.stringify(object));
    }

    static async getObject(key) {
        return JSON.parse(await get(key));
    }
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
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

let commonMimeTypes = {
    plainText: "text/plain",
    json: "application/json",
    csv: "text/csv",
    javascript: "text/javascript",
}

function escapeFileName(filename) {
    return filename.replace(/[^a-zA-Z0-9\.\- ]/g, "_");
}

function escapeFileNameMinimal(col) {
    col = col.toLowerCase(); // Lowercase
    col = col.replace(/[^a-z0-9_]/g, '_'); // Replace non-alphanumeric characters with an underscore
    col = col.replace(/_+/g, '_'); // Replace multiple underscores with a single one
    col = col.replace(/_$/, ''); // Remove trailing underscore

    return col;
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
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

const second = 1000;
function seconds(seconds){
    return second * seconds;
}

const minute = second * 60;
function minutes(minutes){
    return minute * minutes;
}

const hour = minute * 60;
function hours(hours){
    return hour * hours;
}

const day = hour * 24;
function days(days){
    return day * days;
}

const week = day * 24;
function weeks(weeks){
    return week * weeks;
}

const systemRole = "system";
const userRole = "user";
const assistantRole = "assistant";
class ChatHelpers {
    static messageToString(message){
        return message.role + ": " + message.content;
    }

    static gpt4OmniName = "GPT-4 Omni";
    static gpt4TurboName = "GPT-4 Turbo";
    static gpt4Name = "GPT-4";
    static gpt3_5TurboName = "GPT-3.5 Turbo";

    static gpt4OmniIdentifier = "gpt-4o";
    static gpt4TurboIdentifier = "gpt-4-turbo";
    static gpt4Identifier = "gpt-4";
    static gpt3_5TurboIdentifier = "gpt-3.5-turbo";

    static defaultModel = this.gpt4OmniIdentifier;

    static gptModelNames = {
        [this.gpt4OmniIdentifier]: this.gpt4OmniName,
        [this.gpt4TurboIdentifier]: this.gpt4TurboName,
        [this.gpt4Identifier]: this.gpt4Name,
        [this.gpt3_5TurboIdentifier]: this.gpt3_5TurboName
    }

    static gptModels = new Set(Object.keys(this.gptModelNames));

    static gptModelsThatAllowImages = new Set([
        this.gpt4OmniIdentifier,
        this.gpt4TurboIdentifier
    ]);
}

function toMessage(role, prompt, url = null){
    return {role, prompt, url};
}

function toSystemMessage(prompt){
    return toMessage(systemRole, prompt);
}

/**
 * The image url is optional and only available for models that allow images.
 */
function toUserMessage(prompt, url = null){
    return toMessage(userRole, prompt, url);
}

function toAssistantMessage(prompt){
    return toMessage(assistantRole, prompt);
}

function extractCode(markdown, codeBlocksOnly = true) {
    let amount = 0;
    let isCodeBlock = false;
    let isIndentedCode = false;
    let codes = [];
    let codeStart = 0;
    for (let i = 0; i < markdown.length; i++) {
        if (markdown[i] === "\`") {
            amount++;
        } else {
            if (amount === 3) {
                if (isCodeBlock) {
                    codes.push(markdown.substring(codeStart, i - 2));
                    isCodeBlock = false;
                } else if (isIndentedCode) {
                    continue;
                } else {
                    let cutOff = false;
                    while (markdown[i] !== "\n") {
                        i++;
                        if (i === markdown.length || i + 1 === markdown.length) {
                            cutOff = true;
                            break;
                        }
                    }
                    if (cutOff) break;
                    codeStart = i + 1;
                    isCodeBlock = true;
                }
            } else if (amount === 1) {
                if (isIndentedCode) {
                    if (!codeBlocksOnly) codes.push(markdown.substring(codeStart, i));
                    isIndentedCode = false;
                } else if (isCodeBlock) {
                    continue;
                } else {
                    if (i + 1 === markdown.length) break;
                    codeStart = i + 1;
                    isIndentedCode = true;
                }
            }
            amount = 0;
        }
    }

    if (isCodeBlock) {
        codes.push(markdown.substring(codeStart, markdown.length - amount));
    } else if (isIndentedCode) {
        if(!codeBlocksOnly) codes.push(markdown.substring(codeStart, markdown.length - amount));
    }

    return codes;
}

class Samples {
    static async runSimpleChatBot() { // Simple chatbot implementation. You can use this as reference or even directly call it in your code!
        const promptInputName = "promptInputName"; // Define name of prompt input for easy reference
        const context = []; // Define context to pass to chatbot
    
        async function run() { // Define run function to be called on chat button click
            const prompt = (await read(promptInputName)).text; // Read text value of prompt input
            context.push(toUserMessage(prompt)); // Add user prompt to chat context
    
            const userMessageElement = createText(paragraphType, `User:\n${prompt}`, {bordered: true}); // Add border to user message to make it easier for the user to see in the sea of messages
            const assistantMessageElement = createMarkdown("", {name: context.length}); // Show assistant message in markdown to make it more appealing
            await showGroup([userMessageElement, assistantMessageElement], {insertBefore: promptInputName, name: context.length}); // Insert with name equal to context length for later reference, and before prompt input, as that should stay at the bottom.
    
            const result = await chat(context, {element: counter}); // We chat and stream to the element with name equal to context length
            context.push(toAssistantMessage(result)); // Save assistant response to chat context
        }
    
        await setStatus("Ready to chat"); // Set status as flavor
         // Show input box for the user to enter their prompt
        const inputElement = createInput(textInputType, { // Add text input to allow user to input their prompt
            name: promptInputName, // Add name for later reference
            placeholder: "Enter your prompt here...", // Add placeholder to better communicate with the user
        });
        await show(inputElement, {noAccept: true}); // Show the input without an accept button, so we can reuse it.
        const button = createContainer(buttonType, createText(paragraphType, "Chat"), {onClick:run}); // Button that calls run() on click
        const wrapper = createFloatRightWrapper(button); // Make chat button float to the right
        await show(wrapper); // Show the button
        // Continues to run in the background until the script finishes running. To stop the script from finishing, await `forever` at the end of your script.
    }
}