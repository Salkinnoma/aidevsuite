const onEvent = new Map();
const onPingEvent = new Map();

// Event status types
const successStatus = 'successStatus';
const errorStatus = 'errorStatus';

// Event types
const logEventType = "logEventType";
const evalEventType = "evalEventType";
const showEventType = "showEventType";
const updateEventType = "updateEventType";
const removeEventType = "removeEventType";
const validateInputEventType = "validateInputEventType";
const delayedValidateInputEventType = "delayedValidateInputEventType";
const clickEventType = "clickEventType";
const chatEventType = "chatEventType";
const fileDownloadEventType = "fileDownloadEventType";
const dataURLDownloadEventType = "dataURLDownloadEventType";
const setProgressEventType = "setProgressEventType";
const setStatusEventType = "setStatusEventType";

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

// Event logic to communicate with origin
function postRequest(type, content, id = null, pingId = null, pingSourceEvent = null) {
    postMessage({id, pingId, pingSourceId: pingSourceEvent?.data.pingId, type, content});
}

function postSuccessResponse(requestEvent, content = null, message = null) {
    postMessage({ id:requestEvent.data.id, type: requestEvent.data.type, response: true, status: successStatus, content, message });
}

function postErrorResponse(requestEvent, message, content = null) {
    postMessage({ id:requestEvent.data.id, type: requestEvent.data.type, response: true, status: errorStatus, content, message });
}

function requireResponse(type, content, onPing = null, pingSourceEvent = null){
    return new Promise((resolve, reject) => {
        const id = generateUniqueId();
        let pingId = null;
        if (onPing != null) {
            pingId = generateUniqueId();
            onPingEvent.set(pingId, async (event) => {
                try {
                    const result = await onPing(event.data.type, event.data.content);
                    postSuccessResponse(event, result);
                } catch (e) {
                    postErrorResponse(event, e.stack);
                }
            });
        }

        onEvent.set(id, (event) => {
            onEvent.delete(id);
            if (pingId != null) onPingEvent.delete(pingId);

            if (event.data.status === errorStatus) reject(event.data.message);
            else resolve(event.data.content);
        });

        postRequest(type, content, id, pingId, pingSourceEvent);
    });
}

async function log(...data) {
    return await requireResponse(logEventType, JSON.stringify(data));
}

async function onEvalRequest(e){
    try {
        const result = await eval("(async () => {" + e.data.content.code + "})()");  // Evaluate the incoming code
        const content = result;
        postSuccessResponse(e, content);
    } catch (error) {
        postErrorResponse(e, error.stack);
    }
}

onmessage = async function(e){
    if (e.data.type !== logEventType) await log("Origin Message Received:", e.data);

    if (onEvent.has(e.data.id)) {
        onEvent.get(e.data.id)(e);
    } else if (onPingEvent.has(e.data.pingSourceId)) {
        onPingEvent.get(e.data.pingSourceId)(e);
    } else if (e.data.type === evalEventType) {
        onEvalRequest(e);
    }
};


/**
 * Create elements using various create functions. The `options` parameter of any elements can additionally take the following properties:
 * - **name** (string) [optional]: This is necessary for the `update`, `remove` and some other functions that require an element name functions.
 * - **hide** (bool) [optional]: This can be useful when smoothly wanting to add to elements of containers without recreating the entire container, as they can't be added via `update`. Default is `false`.
 * - **leftElements** (array) [optional]: An array of small elements to float to the left of an element.
 * - **rightElements** (array) [optional]: An array of small elements to float to the right of an element.
 */

/**
 * Creates a break.
 */
function createBreak(options = null) {
    const content = {
        type: breakType,
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
 * - **type** (string): Specifies the type of element.  Supported values are:
 *     - `paragraphType`
 *     - `titleType`
 *     - `subTitleType`
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
 * - **ds** (array of strings or a string): If it is an array, it creates a path element for each d. If it is a string, it uses predefined paths. The following string values are supported: `"close"`, `"expandMore"`, `"expandLess"`, `"menu"`, `"menuClose"`, `"menuHorizontal"`, `"download"`, `"upload"`, `"lock"`, `"noLock"`, `"edit"`, `"noEdit"`, `"delete"`, `"highlight"`, `"highlightOff"`, `"play"`, `"settings"`, `"sparkles"`, `"star"`, `"starFilled"`, `"copy"`, `"user"`, `"cpu"`, `"link"`, `"dollar"`, `"at"`, `"photo"`, `"retry"`, `"undo"`, `"redo"`.
 * - **iconProvider** (string): The type of the icon. Supported values are:
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
 * - **elements** (array): A list of elements displayed within the container. Please do not put buttons or interactables within buttons.
 * - **options** (object): An object that contains various options specific to the `type` of input. The options available depend on the input type.
 * 
 * ## Options Configuration by Container Type
 * ### All Types
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
 */
function createContainer(type, elements, options = null) {
    options ??= {};
    const content = {
        type,
        elements,
        options,
    };
    return content;
}

/**
 * ## Parameters
 * - **type** (string): Specifies the type of input. Supported values are:
 *     - `textInputType`
 *     - `numberInputType`
 *     - `passwordInputType`
 *     - `checkboxInputType`
 *     - `selectInputType`
 *     - `fileInputType`
 *     - `pasteInputType`
 * - **options** (object): An object that contains various options specific to the `type` of input. The options available depend on the input type.
 *
 *
 * ## Options Configuration by Input Type
 *
 * ### All Types
 * - **name** (string) [optional]: Recommended for use as part of the `showGroup` function.
 *
 * ### All Input Types
 * - **onValidate** (function) [optional]: A callback function that can be used for custom validation logic. It is called whenever the value of an input changes. Its parameters are group, element. The return value of onValidate must be an object with the following properties:
 *     - **valid** (bool): Whether the value is valid.
 *     - **message** (string) [optional]: An error message. Defaults to `'Invalid value. Please choose a different value.'`.
 *     - **override** (object) [optional]: Allows overwriting the value of elements within the group. The object must be any number of elements mapped by their names.
 * - **onDelayedValidate** (function) [optional]: A callback function that can be used for custom validation logic. It is called only when a user wants to accept input. Its parameters are group, element. The return value of onValidate must be an object with the following properties:
 *     - **valid** (bool): Whether the value is valid.
 *     - **message** (string) [optional]: An error message. Defaults to `'Invalid value. Please choose a different value.'`.
 *     - **override** (object) [optional]: Allows overwriting the value of elements within the group. The object must be any number of elements mapped by their names.
 *
 * ### `textInputType`
 * - **defaultValue** (string) [optional]: The default text value for the input. Default is an empty string `''`.
 * - **placeholder** (string) [optional]: The placeholder text that appears when the input is empty. Default is `"Enter text here..."`.
 * - **spellcheck** (bool) [optional]: Whether to enable spellcheck. Default is `false`.
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
 * 
 * ### `markdownInputType`
 * - **defaultValue** (string) [optional]: The default code value for the input. Default is an empty string `''`.
 * - **placeholder** (string) [optional]: The placeholder text that appears when the input is empty. Default is `"Enter markdown here..."`.
 * - **spellcheck** (bool) [optional]: Whether to enable spellcheck. Default is `false`.
 * - **katex** (bool) [optional]: Whether to render katex. Default is `true`.
 * - **katexDelimiters** (array) [optional]: The delimiters to use to find find math equations. Default: Same as for `createText`.
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
 *     - **bordered** (number) [optional]: Whether the group should be bordered. Default is `false`.
 *     - **sticky** (number) [optional]: Whether it should stick to the top. Default is `false`.
 *     - **insertAt** (number) [optional]: Where to insert. The default is `-1`.
 *     - **deleteAfter** (number) [optional]: How many to delete after this. The default is `0`.
 *     - **deleteBefore** (number) [optional]: How many to delete before this. The default is `0`.
 *
 * ## Return value when awaited
 * When this function is awaited, it returns an object that contains each input element from the group parameter with their name as a key. If no name is defined, their flattened index within the group is used instead, and added to the element as a name property.
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
        delete element.options.name;

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

    const response = await requireResponse(showEventType, {children: group, options}, async (type, content) => {
        let map = null;
        if (type == validateInputEventType) {
            map = onValidateMap;
        } else if (type == delayedValidateInputEventType) {
            map = onDelayedValidateMap;
        }
        return await map.get(content.element.name)(_mapGroup(content.group), content.element);
    });

    return _mapGroup(response ?? []);
}

/**
 * The element parameter should be created via any of the create functions.
 * For showing multiple elements at once, use the `showGroup` function.
 * 
 * ## Parameters
 * The parameters are the same as for the `showGroup` function.
 *
 * ## Return value when awaited
 * When this function is awaited:
 * - If the element is not an input, it returns the input element with following properties:
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
 * - **ticked** (bool): Whether the checkbox was ticked.
 * 
 * ### For `selectInputType`
 * - **value** (string): The selected value.
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
async function show(element, options) {
    let result = await showGroup([element], options);
    return result[element.name];
}

/**
 * - **groupName** (string): The name of the group to update.
 * - **elementName** (string): The name of the element to update. You cannot update accepted inputs (after awaiting return value).
 * - **properties** (object): An object that contains the properties to update. The following properties are available:
 *     - All properties passed into any of the create functions, except `type`, `options`, any child element properties and any of the callback functions.
 *     - All properties of the `options` property, except `defaultValue` and any of the callback functions.
 *     - All return value properties from inputs.
 */
async function update(groupName, elementName, properties) {
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
 * This allows communicating with a chatbot.
 * - **context** (array): A list of message objects.
 * - **options** (object): An object that can have the following properties:
 *     - **element** (array of 2 strings) [optional]: Allows streaming to an element. The first string must be the `name` of the group, the second must be the `name` of the element. If streaming to an input, it will be disabled for user input while streaming. This only works on elements with a string value, such as text or code.
 *     - **onUpdate** (function) [optional]: Allows streaming to a callback function. The function takes in the following parameters:
 *         - **response** (string): The updated full response text.
 *     - **model** (string) [optional]: The model to be used. Default is `ChatHelpers.gpt4OmniIdentifier`.
 *     - **seed** (number) [optional]: The seed to be used. Very unreliable.
 */
async function chat(context, options = null) {
    const onUpdate = options?.onUpdate;
    if (onUpdate == null) {
        await requireResponse(chatEventType, {context, options});
    } else {
        delete options.onUpdate;
        options.hasOnUpdate = true;
        await requireResponse(chatEventType, {context, options}, e => onUpdate(e.data.content));
    }

  
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
let commonMimeTypes = {
    plainText: "text/plain",
    json: "application/json",
    csv: "text/csv",
}

function escapeFileName(filename) {
    return filename.replace(/[^a-zA-Z0-9\.\- ]/g, "_");
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

function toMessage(role, content, url = null){
    return {role, content, url};
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