


class Flow {
    static runMode = 'run';
    static editMode = 'edit';
    static isRunning = false;
    static loadedExternPage = null;
    static onIframeEvent = new Map();
    static progress = 0;
    static maxProgress = 1;
    static status = "Running...";
    static noOutputMessage = "No output yet...";
    static output = [];
    static groupByName = new Map();
    static settingsByGroupNameAndName = new Map();
    static groupByElement = new Map();
    static clickEventById = new Map();

    static onPageLoaded() {
        const name = getPathFromHash();
        if (name !== 'flow' && name !== 'extern' && !localPages.has(name)) return;

        let mode = getHashQueryVariable('mode') ?? Flow.editMode;
        const locked = getHashQueryVariable('locked') ?? false;
        if (locked) mode = Flow.runMode;

        if (Flow.isRunning) {
            Flow.interruptRun();
        }

        if (mode == Flow.runMode) Flow.run();
    }

    static setupIframe() {
        const iframe = document.getElementById("sandbox");
        Flow.iframe = iframe;
        console.log(iframe);

        window.addEventListener('message', function setupWorker(event) {
            if (event.data.source == 'origin') return;
            const data = event.data.message;

            if (event.data.source == 'worker') {
                Flow.onWorkerMessage(data);
            } else if (event.data.source == 'iframe') {
                if (!event.data.response) console.log('IFrame Message Received:', data ?? event);
                Flow.onIframeEvent.get(event.data.id)?.(event.data);
            }
        });
    }

    static postIframeRequest(content, id = null) {
        //const allowedOrigin = window.location.origin; // Doesn't work because iframe is sandboxed with different origin (null)
        //console.log('IFrame Message Posted:', content);
        Flow.iframe.contentWindow.postMessage({message: content, id, source: 'origin'}, '*');
    }

    static requireIframeResponse(content){
        return new Promise((resolve, reject) => {
            const id = generateUniqueId();
    
            Flow.onIframeEvent.set(id, (event) => {
                Flow.onIframeEvent.delete(id);
                resolve(event.message);
            });
    
    
            Flow.postIframeRequest(content, id);
        });
    }

    static updateDefaultCode(code) {
        localStorage.setItem('lastCode', code);
    }

    static updateCode(code) {
        const name = getPathFromHash();
        if (name == 'flow') {
            Flow.updateDefaultCode(code);
        } else if (name == 'extern') {
            return;
        } else {
            const page = localPages.get(name);
            page.code = code;
            updateLocalPage(page);
        }
    }

    static updateUrl(url) {
        localStorage.setItem('externUrl', url);
        const newUrl = getUrlWithChangedHashParam('url', url);
        history.replaceState(null, "", newUrl);
    }

    static getPage() {
        const name = getPathFromHash();
        if (name == 'flow') {
            const item = {
                prompt: localStorage.getItem('lastPrompt'),
                code: localStorage.getItem('lastCode'),
            };
            return item;
        } else if (name == 'extern') {
            return (Flow.loadedExternPage?.url == getHashQueryVariable('url') && Flow.loadedExternPage?.url != null) ? Flow.loadedExternPage : {code: ''};
        } else {
            return localPages.get(name);
        }
    }

    static getCode() {
        return Flow.getPage().code;
    }

    static async loadScript() {
        Flow.loadedExternPage = null;
        const url = Flow.urlEditorElement.textContent;
        Flow.setStatus('Loading external script...');
        
        Flow.externContainerElement.classList.remove('hide');
        Flow.externTargetElement.setAttribute('placeholder', 'Loading...');
        Flow.externTargetElement.textContent = '';
        try {
            const page = await fetchExternalPage(url);
            page.url = url;
            Flow.loadedExternPage = page;
            Flow.externTargetElement.textContent = page.code;
            Flow.externTargetElement.setAttribute('placeholder', 'Loaded script seems to be empty...');
            Flow.setStatus('Finished loading external script.');

            highlightCode(Flow.externTargetElement);
        } catch (e) {
            console.log(e);
            Flow.externTargetElement.setAttribute('placeholder', 'Failed loading external script.');
            Flow.setStatus('Error: Failed loading external script: ' + e.message, true);
        }
    }
    
    static onCodeInput(event) {
        let text = event.srcElement.innerText;
        if (ContentEditableHelpers.textNeedsFixing(text)) event.srcElement.textContent = text = ContentEditableHelpers.fixText(text);
        Flow.updateCode(text);
    }

    static updatePrompt(prompt) {
        const name = getPathFromHash();
        if (name == 'flow') {
            localStorage.setItem('lastPrompt', prompt);
        } else if (name == 'extern') {
            return;
        } else {
            const page = localPages.get(name);
            page.prompt = prompt;
            updateLocalPage(page);
        }
    }

    static getPrompt() {
        return Flow.getPage().prompt;
    }
    
    static onPromptInput(event) {
        let text = event.srcElement.innerText;
        if (ContentEditableHelpers.textNeedsFixing(text)) event.srcElement.textContent = text = ContentEditableHelpers.fixText(text);
        Flow.updatePrompt(text);
    }

    static run() {
        const mode = getHashQueryVariable('mode') ?? Flow.editMode;
        if (Flow.isRunning) {
            Flow.interruptRun();
        }
        
        if (mode == Flow.runMode) {
            Flow.executeCode();
        } else {
            goToUrl(getUrlWithChangedHashParam('mode', Flow.runMode));
            return;
        }
    }

    static edit() {
        if (Flow.isRunning) {
            Flow.interruptRun();
        }

        goToUrl(getUrlWithChangedHashParam('mode', null));
    }

    static async generateScript(rewrite = false) {
        if (Flow.generating) return;
        Flow.generating = true;
        Flow.generateScriptButton.setAttribute('disabled', '');
        Flow.rewriteScriptButton.setAttribute('disabled', '');
        Flow.setStatus('Generating script...');
        Flow.setProgress(30);

        const page = Flow.getPage();
        const hasStorage = page.id != null;
        const storageAddendum = hasStorage ? '' : ' The storage is disabled for this script.';

        const systemPrompt = await Flow.getWorkerScript() + `\n\nThe user will ask you to write a script for a custom interactive tool that clearly communicates with the user.${storageAddendum} Your script will be evaluated in the eval part of onmessage on a worker. Above is the worker script that will eval your script. All code you write will be executed within an async function within eval. Write the whole script and only the script within a single code block (use \`\`\`code here\`\`\`), such that it can be easily parsed.`;
        const secondSystemPrompt = Flow.getCode() + `Above is the existing code written by the user that needs to be changed and adjusted according to the user's wishes.`;
        const prompt = Flow.getPrompt();
        const systemMessage = ChatGptApi.toSystemMessage(systemPrompt);
        const secondSystemMessage = ChatGptApi.toSystemMessage(secondSystemPrompt);
        const userMessage = ChatGptApi.toUserMessage(prompt);
        const context = rewrite ? [systemMessage, secondSystemMessage, userMessage] : [systemMessage, userMessage];

        Flow.codeEditorContainerElement.classList.add('hide');
        Flow.streamContainerElement.classList.remove('hide');

        const result = await ChatGptApi.streamChat(context, t => {
            const code = ParsingHelpers.extractCode(t);
            Flow.streamTargetElement.innerText = code;
        });
        const code = ParsingHelpers.extractCode(result);

        Flow.codeEditorContainerElement.classList.remove('hide');
        Flow.streamContainerElement.classList.add('hide');

        InputHelpers.replaceTextWithUndo(Flow.codeEditorElement, code);

        Flow.updateCode(code);

        Flow.setStatus('Finished');
        Flow.setProgress(100);
        Flow.generating = false;
        Flow.generateScriptButton.removeAttribute('disabled');
        Flow.rewriteScriptButton.removeAttribute('disabled');
    }

    static showProgress() {
        Flow.progressBar.classList.remove('hide');
    }

    static hideProgress() {
        Flow.progressBar.classList.add('hide');
    }

    static setProgress(value) {
        if (value == null) {
            Flow.hideProgress();
            return;
        }

        Flow.showProgress();
        Flow.progress = Math.max(100, Math.min(0, value));
        Flow.progressBar.value = Flow.progress;
    }

    static setStatus(message, error = false) {
        Flow.status = message;
        Flow.statusElement.textContent = Flow.status;
        if (error) Flow.statusElement.classList.add('danger-text');
        else Flow.statusElement.classList.remove('danger-text');
    }

    static interruptRun() {
        console.log(Flow.dialogOutputContainer);
        Flow.destroyWorker();
        Flow.dialogOutputContainer.classList.add('hide');
        Flow.isRunning = false;
    }

    static async executeCode() {
        Flow.isRunning = true;

        Flow.setStatus("Running...");
        console.log(Flow.status);
        Flow.output = [];
        Flow.groupByElement.clear();

        await Flow.createWorker();
        let error = false;
        try {
            let code = Flow.getCode();
            let url = getHashQueryVariable('url');
            if (getPathFromHash() == 'extern' && Flow.loadedExternPage?.url != getHashQueryVariable('url')) {
                Flow.setStatus("Fetching...");
                const page = await fetchExternalPage(url);
                page.url = url;
                Flow.loadedExternPage = page;
                code = page.code;
                Flow.setStatus("Running...");
            }
            await Flow.evalOnWorker(code);
        } catch (e) {
            error = e;
        }
        await Flow.destroyWorker();
        Flow.hideProgress();

        if (error) Flow.setStatus("Script Error: " + error, true);
        else Flow.setStatus("Finished");
        console.log(Flow.status);

        Flow.isRunning = false;
    }
    
    static async destroyWorker() {
        await Flow.requireIframeResponse({ command: 'terminateWorker' });
    }

    static async createWorker() {
        await Flow.requireIframeResponse({ loadWorker: await Flow.getWorkerScript() });
    }

    static async getWorkerScript() {
        const response = await fetch('js/worker.js');
        return await response.text();
    }

    static onEvent = new Map();
    static onPingEvent = new Map();

    // Event status types
    static successStatus = 'successStatus';
    static errorStatus = 'errorStatus';

    // Event types
    static logEventType = "logEventType";
    static evalEventType = "evalEventType";
    static loadEventType = "loadEventType";
    static showEventType = "showEventType";
    static readEventType = "readEventType";
    static updateEventType = "updateEventType";
    static removeEventType = "removeEventType";
    static acceptEventType = "acceptEventType";
    static validateInputEventType = "validateInputEventType";
    static delayedValidateInputEventType = "delayedValidateInputEventType";
    static clickEventType = "clickEventType";
    static chatEventType = "chatEventType";
    static chatStreamEventType = "chatStreamEventType";
    static fileDownloadEventType = "fileDownloadEventType";
    static dataURLDownloadEventType = "dataURLDownloadEventType";
    static setProgressEventType = "setProgressEventType";
    static setStatusEventType = "setStatusEventType";
    static storageEventType = "storageEventType";

    // Element types
    static breakType = "breakType";
    static rulerType = "rulerType";
    static emptyType = "emptyType";
    static codeType = "codeType";
    static markdownType = "markdownType"; // Includes Katex math parser.
    static paragraphType = "paragraphType";
    static titleType = "titleType";
    static subTitleType = "subTitleType";
    static imageType = "imageType";
    static iconType = "iconType";

    // Icon types
    static materialIconProvider = "materialIconProvider";
    static heroIconProvider = "heroIconProvider";

    // Container element types
    static barType = "barType";
    static verticalType = "verticalType";
    static buttonType = "buttonType";

    // Bar sub types
    static navBarType = "navBarType";
    static listBarType = "listBarType";
    static fillBarType = "fillBarType";

    // Button sub types
    static simpleButtonType = "simpleButtonType";
    static complexButtonType = "complexButtonType";

    // Input element types
    static textInputType = "textInputType";
    static numberInputType = "numberInputType";
    static passwordInputType = "passwordInputType";
    static codeInputType = "codeInputType";
    static markdownInputType = "markdownInputType";
    static checkboxInputType = "checkboxInputType";
    static selectInputType = "selectInputType";
    static imageInputType = "imageInputType";
    static pasteInputType = "pasteInputType";
    static fileInputType = "fileInputType";

    // Element type sets
    static allTypes = new Set([
        Flow.breakType,
        Flow.rulerType,
        Flow.emptyType,
        Flow.markdownType,
        Flow.paragraphType,
        Flow.titleType,
        Flow.subTitleType,
        Flow.codeType,
        Flow.imageType,
        Flow.iconType,
        Flow.barType,
        Flow.verticalType,
        Flow.buttonType,
        Flow.textInputType,
        Flow.numberInputType,
        Flow.passwordInputType,
        Flow.codeInputType,
        Flow.markdownInputType,
        Flow.checkboxInputType,
        Flow.selectInputType,
        Flow.imageInputType,
        Flow.pasteInputType,
        Flow.fileInputType,
    ]);

    static containerTypes = new Set([
        Flow.barType,
        Flow.verticalType,
        Flow.buttonType,
    ]);

    static textTypes = new Set([
        Flow.paragraphType,
        Flow.titleType,
        Flow.subTitleType,
    ]);

    static inputTypes = new Set([
        Flow.textInputType,
        Flow.numberInputType,
        Flow.passwordInputType,
        Flow.codeInputType,
        Flow.markdownInputType,
        Flow.checkboxInputType,
        Flow.selectInputType,
        Flow.imageInputType,
        Flow.pasteInputType,
        Flow.fileInputType,
    ]);


    // Paste item types
    static htmlPasteItemType = "html";
    static textPasteItemType = "text";
    static rtfPasteItemType = "rtf";
    static filesPasteItemType = "files";

    // Group locations
    static mainLocation = "main";
    static stickyLocation = "sticky";
    static dialogLocation = "dialog";
    
    // Event logic to communicate with worker
    static _postMessage(message) {
        Flow.postIframeRequest({ workerCommand: message });
    }

    static postRequest(type, content, id = null, pingId = null, pingSourceEvent = null) {
        Flow._postMessage({id, pingId, pingSourceId: pingSourceEvent?.pingId, type, content});
    }

    static postSuccessResponse(requestEvent, content = null, message = null) {
        Flow._postMessage({ id:requestEvent.id, type: requestEvent.type, response: true, status: Flow.successStatus, content, message });
    }

    static postErrorResponse(requestEvent, message, content = null) {
        Flow._postMessage({ id:requestEvent.id, type: requestEvent.type, response: true, status: Flow.errorStatus, content, message });
    }

    static requireResponse(type, content, onPing = null, pingSourceEvent = null){
        return new Promise((resolve, reject) => {
            const id = generateUniqueId();
            let pingId = null;
            if (onPing != null) {
                pingId = generateUniqueId();
                Flow.onPingEvent.set(pingId, async (event) => {
                    try {
                        const result = await onPing(event.content, event);
                        Flow.postSuccessResponse(event, result);
                    } catch (e) {
                        Flow.postErrorResponse(event, "Executing request produced an error.");
                    }
                });
            }
    
            Flow.onEvent.set(id, (event) => {
                Flow.onEvent.delete(id);
                if (pingId != null) Flow.onPingEvent.delete(pingId);
                if (event.status === Flow.errorStatus) reject(event.message);
                else resolve(event.content);
            });
    
    
            Flow.postRequest(type, content, id, pingId, pingSourceEvent);
        });
    }
    
    static onWorkerMessage(event) {
        const e = event;
        const type = e.type;
        if (type !== Flow.logEventType) console.log("Worker Message Received:", event);

        try {
            if (Flow.onEvent.has(e.id)) {
                Flow.onEvent.get(e.id)(e);
            } else if (Flow.onPingEvent.has(e.pingSourceId)) {
                Flow.onPingEvent.get(e.pingSourceId)(e);
            } else if (type === Flow.logEventType) {
                Flow.onLogRequest(e);
            } else if (type === Flow.loadEventType) {
                Flow.onLoadRequest(e);
            } else if (type === Flow.showEventType) {
                Flow.onShowRequest(e);
            } else if (type === Flow.readEventType) {
                Flow.onRead(e);
            } else if (type === Flow.updateEventType) {
                Flow.onUpdate(e);
            } else if (type === Flow.removeEventType) {
                Flow.onRemove(e);
            } else if (type === Flow.acceptEventType) {
                Flow.onAcceptRequest(e);
            } else if (type === Flow.clickEventType) {
                Flow.onClick(e);
            } else if (type === Flow.chatEventType) {
                Flow.onChat(e);
            } else if (type === Flow.fileDownloadEventType) {
                Flow.onFileDownloadRequest(e);
            } else if (type === Flow.dataURLDownloadEventType) {
                Flow.onDataURLDownloadRequest(e);
            } else if (type === Flow.setProgressEventType) {
                Flow.onSetProgressRequest(e);
            } else if (type === Flow.setStatusEventType) {
                Flow.onSetStatusRequest(e);
            } else if (type === Flow.storageEventType) {
                Flow.onStorageRequest(e);
            }
        } catch (error) {
            console.error("Error while executing worker request:", error.stack);
            Flow.postErrorResponse(e, "Error while executing worker request.");
        }
    }

    static onLogRequest(event) {
        const e = event;
        if (e.content == null) {
            console.log("Worker Log:", e.content);
        } else {
            const contentArray = JSON.parse(e.content);

            if (Array.isArray(contentArray)) {
                console.log("Worker Log:", ...contentArray);
            } else {
                console.log("Worker Log:", contentArray);
            }
        }
        Flow.postSuccessResponse(e);
    }

    static async evalOnWorker(code) {
        return await Flow.requireResponse(Flow.evalEventType, {code});
    }

    static async onLoadRequest(event) {
        const url = event.content;
        try {
            const page = await fetchExternalPage(url);
            Flow.postSuccessResponse(event, page.code);
        } catch (e) {
            Flow.postErrorResponse(event, "Failed to fetch.");
        }
    }

    static async onStorageRequest(event) {
        const e = event;
        const content = event.content;
        const page = Flow.getPage();
        let exists = false;
        if (page.id) exists = true;

        if (content.exists) Flow.postSuccessResponse(e, exists);
        else if (content.set != null) {
            const scriptStorage = JSON.parse(localStorage.getItem('scriptStorage'));
            scriptStorage[id] ??= {};
            scriptStorage[id][content.set.key] = content.set.value;
            const jsonStorage = JSON.stringify(scriptStorage);
            const targetSize = getStringByteSize(JSON.stringify(scriptStorage[id]));
            const totalSize = getStringByteSize(jsonStorage);
            if (totalSize > megabyte * 3 || targetSize > kilobyte * 50) {
                Flow.postErrorResponse(e, new Error("Not enough storage."));
            } else {
                localStorage.setItem('scriptStorage', jsonStorage);
                Flow.postSuccessResponse(e);
            }
        } else if (content.get != null) {
            const scriptStorage = JSON.parse(localStorage.getItem('scriptStorage'));
            scriptStorage[id] ??= {};
            const value = scriptStorage[id][content.get];
            Flow.postSuccessResponse(e, value);
        } else if (content.delete != null) {
            const scriptStorage = JSON.parse(localStorage.getItem('scriptStorage'));
            scriptStorage[id] ??= {};
            delete scriptStorage[id][content.delete];
            localStorage.setItem('scriptStorage', JSON.stringify(scriptStorage));
            Flow.postSuccessResponse(e);
        }
    }

    // Validation
    static async requestValidation(settings, delayed = false) {
        if ((delayed && !settings.hasDelayedValidation) || (!delayed && !settings.hasValidation)) return;

        const inputValues = Flow.extractInputValues(settings.group);
        const inputs = Flow.extractInputElements(settings.group);
        const targetInputValue = inputValues.find(v => v.name == settings.name);
        const response = await Flow.requireResponse(
            delayed ? Flow.delayedValidateInputEventType : Flow.validateInputEventType,
            {group: inputValues, element: targetInputValue},
            null,
            settings.group.event
        );

        settings.isInvalid = !response.valid;
        if (response.valid) {
            settings.validationContainer.classList.add('hide');
        } else {
            settings.validationMessageElement.textContent = response.message ?? 'Invalid value. Please choose a different value.';
            settings.validationContainer.classList.remove('hide');
        }

        settings.group.isInvalid = inputs.some(s => s.isInvalid);
        
        if (settings.group.isInvalid) {
            settings.group.validationContainer.classList.remove('hide');
            settings.group.acceptButtonElement.setAttribute('disabled', '');
        } else {
            settings.group.validationContainer.classList.add('hide');
            settings.group.acceptButtonElement.removeAttribute('disabled');
        }
    }

    static async requestDelayedValidation(settings) {
        await Flow.requestValidation(settings, true);
    }

    // Element of group
    static extractSettingsFromElement(element, groupSettings) {
        const type = element.type;
        const options = element.options ?? {};
    
        const settings = {type, id: element.id, group: groupSettings, children: []};
        if (options.leftElements) {
            settings.leftChildren = options.leftElements.map(e => Flow.extractSettingsFromElement(e, groupSettings));
            settings.children = settings.children.concat(settings.leftChildren);
            settings.leftChildren.forEach(s => s.parent = settings);
        }
        if (options.rightElements) {
            settings.rightChildren = options.rightElements.map(e => Flow.extractSettingsFromElement(e, groupSettings));
            settings.children = settings.children.concat(settings.rightChildren);
            settings.rightChildren.forEach(s => s.parent = settings);
        }
        settings.name = element.name ?? element.id;
        settings.hide = options.hide ?? false;
        settings.disabled = options.disabled ?? false;
        settings.bordered = options.bordered ?? false;
        settings.breakBefore = Math.min(8, Math.max(0, options.breakBefore ?? 0));
        settings.breakAfter = Math.min(8, Math.max(0, options.breakAfter ?? 0));
        Flow.settingsByGroupNameAndName.get(groupSettings.name).set(settings.name, settings);

        if (Flow.textTypes.has(type)) {
            settings.text = element.text;
            settings.title = options.title;
            settings.useTooltipInstead = options.useTooltipInstead ?? true;
        } else if (type === Flow.emptyType) {
            // Do nothing
        } else if (type === Flow.breakType) {
            settings.size = Math.min(8, Math.max(0, element.size ?? 4));
        } else if (type === Flow.rulerType) {
            settings.vertical = options.vertical;
        } else if (type === Flow.codeType) {
            settings.code = element.code;
            settings.language = options.language;
        } else if (type === Flow.markdownType) {
            settings.markdown = element.markdown;
            settings.katex = options.katex ?? true;
            settings.katexDelimiters = options.katexDelimiters;
            settings.noHighlight = options.noHighlight;
        } else if (type === Flow.imageType) {
            settings.url = element.url;
            settings.caption = options.caption;
            settings.title = options.title;
            settings.useTooltipInstead = options.useTooltipInstead ?? true;
        } else if (type === Flow.iconType) {
            settings.ds = element.ds;
            settings.iconProvider = element.iconProvider;
            settings.caption = options.caption;
            settings.title = options.title;
            settings.useTooltipInstead = options.useTooltipInstead ?? true;
        } else if (Flow.containerTypes.has(type)) {
            settings.mainChildren = element.elements.map(e => Flow.extractSettingsFromElement(e, groupSettings));
            settings.children = settings.children.concat(settings.mainChildren);
            settings.children.forEach(s => s.parent = settings);
            settings.title = options.title;
            settings.useTooltipInstead = options.useTooltipInstead ?? true;
            settings.gap = Math.min(8, Math.max(0, options.gap ?? 4));

            if (type === Flow.barType) {
                settings.barSubType = options.barSubType ?? Flow.navBarType;
            } else if (type === Flow.verticalType) {
                settings.centered = options.centered ?? false;
            } else if (type === Flow.buttonType) {
                settings.buttonSubType = options.buttonSubType ?? Flow.complexButtonType;
                settings.fullWidth = options.fullWidth ?? false;
            }
        } else if (Flow.inputTypes.has(type)) {
            settings.hasValidation = element.hasValidation ?? false;
            settings.hasDelayedValidation = element.hasDelayedValidation ?? false;
            settings.isInvalid = false;
            settings.validationMessage = null;
    
            if (type === Flow.textInputType) {
                settings.text = options.defaultValue ?? '';
                settings.placeholder = options.placeholder ?? 'Enter text here...';
                settings.spellcheck = options.spellcheck ?? false;
                settings.maxHeight = Math.min(8, Math.max(0, options.maxHeight ?? 6));
            } else if (type === Flow.numberInputType) {
                settings.number = options.defaultValue ?? 0;
            } else if (type === Flow.passwordInputType) {
                settings.password = options.defaultValue ?? '';
                settings.placeholder = options.placeholder ?? 'Enter password here...';
            } else if (type === Flow.codeInputType) {
                settings.code = options.defaultValue ?? '';
                settings.language = options.language;
                settings.context = options.context;
                settings.placeholder = options.placeholder ?? 'Enter code here...';
                settings.maxHeight = Math.min(8, Math.max(0, options.maxHeight ?? 6));
            } else if (type === Flow.markdownInputType) {
                settings.markdown = options.defaultValue ?? '';
                settings.placeholder = options.placeholder ?? 'Enter markdown here...';
                settings.spellcheck = options.spellcheck ?? false;
                settings.katex = options.katex ?? true;
                settings.katexDelimiters = options.katexDelimiters;
                settings.noHighlight = options.noHighlight;
                settings.maxHeight = Math.min(8, Math.max(0, options.maxHeight ?? 6));
            } else if (type === Flow.checkboxInputType) {
                settings.checked = options.defaultValue ?? false;
                settings.description = options.description ?? '';
            } else if (type === Flow.selectInputType) {
                options.choices.forEach((c, index) => {
                    c.value ??= index;
                    c.name ??= c.value;
                });
                settings.value = options.defaultValue ?? options.choices[0].value;
                settings.choices = options.choices;
            } else if (type === Flow.imageInputType) {
                settings.url = element.url ?? '';
                settings.caption = options.caption ?? '';
                settings.editableCaption = options.editableCaption ?? false;
                settings.placeholder = options.placeholder ?? 'Enter url here...';
                settings.captionPlaceholder = options.captionPlaceholder ?? 'Enter caption here...';
                settings.spellcheck = options.spellcheck ?? false;
                settings.maxHeight = Math.min(8, Math.max(0, options.maxHeight ?? 6));
                settings.captionMaxHeight = Math.min(8, Math.max(0, options.captionMaxHeight ?? 6));
            } else if (type === Flow.fileInputType) {
                settings.files = [];
                settings.allowedMimeTypes = options.allowedMimeTypes ?? [];
                settings.allowedExtensions = options.allowedExtensions ?? [];
                settings.dropDescription = options.dropDescription ?? ("Drag and drop valid files (" + (settings.allowedMimeTypes.length === 0 ? "any type" : settings.allowedMimeTypes.join(', ')) + ").");
                settings.selectDescription = options.selectDescription ?? 'Or select files';
                settings.noFileSelectedMessage = options.noFileSelectedMessage ?? 'No file selected.';
                settings.multiple = options.multiple ?? false;
                settings.maxSize = options.maxSize;
            } else if (type === Flow.pasteInputType) {
                settings.html = "";
                settings.text = "";
                settings.rtf = "";
                settings.files = [];
                settings.emptyDescription = options.emptyDescription ?? "Paste (STRG + V) into here to continue.";
                settings.replaceDescription = options.replaceDescription ?? "Successfully pasted. Paste (STRG + V) into here to change its content.";
            }
        }
    
        return settings;
    }

    static extractSettingsFromGroup(group) {
        const options = group.options;
        const settings = {};
        settings.name = group.options?.name ?? generateUniqueId();
        settings.noAccept = options.noAccept ?? false;
        Flow.groupByName.set(settings.name, settings);
        Flow.settingsByGroupNameAndName.set(settings.name, new Map());
        settings.children = group.children.map(e => Flow.extractSettingsFromElement(e, settings));
        settings.children.forEach(s => s.parent = settings);
        settings.accepted = false;
        settings.bordered = options.bordered ?? false;
        settings.location = options.location ?? Flow.mainLocation;
        settings.gap = Math.min(8, Math.max(0, options.gap ?? 4));
        settings.breakBefore = Math.min(8, Math.max(0, options.breakBefore ?? 0));
        settings.breakAfter = Math.min(8, Math.max(0, options.breakAfter ?? 0));
        const inputs = Flow.extractInputElements(settings.children);
        settings.isInvalid = inputs.some(s => s.isInvalid);
        settings.noCloseOnOverlay = options.noCloseOnOverlay ?? false;
        return settings;
    }

    static tryAddTitle(element, settings) {
        if (settings.title) {
            if (settings.useTooltipInstead) element.setAttribute('tooltip', escapeHTML(settings.title));
            else element.setAttribute('title', settings.title);
        }
        return element;
    }

    static processInput(element, settings, settingsProperty, elementProperty = 'value') {
        settings[settingsProperty] = element[elementProperty];

        // Validation
        Flow.requestValidation(settings);
    }

    static processContentEditableInput(element, settings, settingsProperty) {
        let text = element.innerText;
        if (ContentEditableHelpers.textNeedsFixing(text)) element.textContent = text = ContentEditableHelpers.fixText(text);
        Flow.processInput(element, settings, settingsProperty, 'innerText');
    }

    static removeFile(index, settings) {
        settings.files.splice(index, 1);
        spliceChildren(settings.filesDisplayElement, index, 1);
        
        if (settings.files.length == 0) {
            const noFileSelectedElement = fromHTML(`<i>`);
            noFileSelectedElement.textContent = settings.noFileSelectedMessage;
            settings.filesDisplayElement.appendChild(noFileSelectedElement);
        }
    }

    static async extractFileData(file) {
        const fileData = {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            lastModifiedDate: file.lastModifiedDate,
            text: await file.text(),
            dataURL: await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            })
        };
    
        return fileData;
    }

    static async addFiles(files, settings) {
        if (settings.files.length == 0 && files.length != 0) {
            settings.filesDisplayElement.innerHTML = '';
        }

        for (let [index, file] of Object.entries(files)) {
            const fileData = await Flow.extractFileData(file);
            settings.files.push(fileData);
            const fileDisplayElement = fromHTML(`<div class="listHorizontal">`);
            const fileNameElement = fromHTML(`<div>`);
            fileNameElement.textContent = fileData.name;
            fileDisplayElement.appendChild(fileNameElement);
            const fileDeleteElement = fromHTML(`<button>`);
            fileDeleteElement.textContent = "X";
            fileDeleteElement.addEventListener('click', e => Flow.removeFile(index, settings));
            fileDisplayElement.appendChild(fileDeleteElement);
            settings.filesDisplayElement.appendChild(fileDisplayElement);
        }
    }
    
    static async processFileInput(event, settings) {
        const e = event;
        let files = getFilesFromEvent(e);
        console.log("Files Input:", files.map(f => f.name));
        await Flow.addFiles(files, settings);
        
        // Validation
        Flow.requestValidation(settings);
    }
    
    static updatePaste(settings, newSettings) {
        const html = newSettings.html;
        const text = newSettings.text;
        const rtf = newSettings.rtf;
        const files = newSettings.files;

        if (newSettings.hasOwnPropertyType('html')) settings.html = html;
        if (newSettings.hasOwnPropertyType('text')) settings.text = text;
        if (newSettings.hasOwnPropertyType('rtf')) settings.rtf = rtf;
        if (newSettings.hasOwnPropertyType('files')) settings.files = files;

        if (settings.html) {
            settings.htmlDisplayElement.innerHTML = '';
            const titleElement = fromHTML(`<h2>`);
            titleElement.textContent = "Pasted Html";
            settings.htmlDisplayElement.appendChild(titleElement);
            const htmlContainer = fromHTML(`<div>`);
            htmlContainer.textContent = settings.html;
            settings.htmlDisplayElement.appendChild(htmlContainer);
            settings.htmlDisplayElement.classList.remove('hide');
        } else settings.htmlDisplayElement.classList.add('hide');
        
        if (settings.files.length != 0) {
            settings.filesDisplayElement.innerHTML = '';
            const titleElement = fromHTML(`<h2>`);
            titleElement.textContent = "Pasted Files";
            settings.filesDisplayElement.appendChild(titleElement);
            const filesContainer = fromHTML(`<div>`);
            for (let file of files) {
                const fileDisplayElement = fromHTML(`<div class="listHorizontal">`);
                const fileNameElement = fromHTML(`<div>`);
                fileNameElement.textContent = file.name;
                fileDisplayElement.appendChild(fileNameElement);
                filesContainer.appendChild(fileDisplayElement);
            }
            settings.filesDisplayElement.appendChild(filesContainer);
            settings.filesDisplayElement.classList.remove('hide');
        } else settings.filesDisplayElement.classList.add('hide');

        // Validation
        Flow.requestValidation(settings);
    }

    static async processPaste(event, settings) {
        event.preventDefault();

        settings.descriptionElement.textContent = settings.replaceDescription;

        const html = event.clipboardData.getData('text/html');
        const text = event.clipboardData.getData('text/plain');
        const rtf = event.clipboardData.getData('text/rtf');
        const files = [];
        const unprocessFiles = [];
        for (let item of event.clipboardData.items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                unprocessFiles.push(file);
            }
        }
        for (let file of unprocessFiles) {
            const fileData = await Flow.extractFileData(file);
            files.push(fileData);
        }

        Flow.updatePaste(settings, {html, text, rtf, files});
    }

    static fromElementSettings(settings) {
        const type = settings.type;
    
        const container = fromHTML(`<div>`);
        settings.htmlElement = container;
        if (settings.hide) container.classList.add('hide');
        const containered = Flow.containerTypes.has(settings.parent.type);
        let decorated = settings.leftChildren != null || settings.rightChildren != null;
        let element = container;
        if (settings.breakBefore != 0 || settings.breakAfter != 0) {
            const horizontal = settings.parent.type == Flow.listBarType || settings.parent.type == Flow.buttonType;
            const name = horizontal ? 'h' : 'b';
            const subContainer = fromHTML(`<div>`);
            if (settings.breakBefore) container.appendChild(name + 'b-' + settings.breakBefore);
            container.appendChild(subContainer);
            if (settings.breakAfter) container.appendChild(name + 'b-' + settings.breakBefore);
            element = subContainer;
        }

        if (decorated && type != Flow.textInputType) {
            console.log(settings);
            container.classList.add('decoratedContainer');
            const leftElement = fromHTML(`<div>`);
            settings.leftElement = leftElement;
            container.appendChild(leftElement);
            element = fromHTML(`<div>`);
            container.appendChild(element);
            const rightElement = fromHTML(`<div>`);
            settings.rightElement = rightElement;
            container.appendChild(rightElement);
        }
        if (settings.bordered) {
            container.classList.add('bordered');
            container.classList.add('largeElement');
        }
        if (settings.disabled) element.setAttribute('disabled', '');
        settings.contentElement = element;
    
        if (type == Flow.breakType) {
            if (containered) element.classList.add('vb-' + settings.size);
            else element.classList.add('hb-' + settings.size);
        } else if (type == Flow.rulerType) {
            const ruler = element.vertical ? vr() : hr();
            element.appendChild(ruler);
            settings.rulerElement = ruler;
        } else if (type == Flow.emptyType) {
            // Do nothing
        } else if (type == Flow.paragraphType) {
            Flow.tryAddTitle(element, settings);
            element.classList.add('w-100');
            element.classList.add('fixText');
            element.textContent = settings.text;
            settings.textElement = element;
        } else if (type == Flow.titleType) {
            Flow.tryAddTitle(element, settings);
            element.classList.add('w-100');
            element.classList.add('fixText');
            const titleElement = fromHTML(`<h1>`);
            titleElement.textContent = settings.text;
            element.appendChild(titleElement);
            settings.textElement = titleElement;
        } else if (type == Flow.subTitleType) {
            Flow.tryAddTitle(element, settings);
            element.classList.add('w-100');
            element.classList.add('fixText');
            const subTitleElement = fromHTML(`<h2>`);
            subTitleElement.textContent = settings.text;
            element.appendChild(subTitleElement);
            settings.textElement = subTitleElement;
        } else if (type == Flow.codeType) {
            Flow.tryAddTitle(element, settings);
            const codeElement = CodeHelpers.createCodeElement(settings.code, settings.language);
            element.appendChild(codeElement);
            settings.codeElement = codeElement;
        } else if (type == Flow.markdownType) {
            const markdownContainer = fromHTML(`<div class="w-100">`);
            renderMarkdown(markdownContainer, settings.markdown, { delimiters: settings.katexDelimiters, noHighlight: settings.noHighlight, sanitize: true, katex: settings.katex });
            settings.markdownElement = markdownContainer;
            const rawTextElement = fromHTML(`<div class="w-100 markdownRawText hide">`);
            rawTextElement.textContent = settings.markdown;
            settings.rawTextElement = rawTextElement;

            const topBar = MarkdownHelpers.createBar(markdownContainer, rawTextElement);
            const bottomBar = MarkdownHelpers.createBar(markdownContainer, rawTextElement, true);
            element.appendChild(topBar);
            element.appendChild(markdownContainer);
            element.appendChild(rawTextElement);
            element.appendChild(bottomBar);
        } else if (type == Flow.imageType) {
            Flow.tryAddTitle(element, settings);
            const figureElement = fromHTML(`<figure>`);
            const imgElement = fromHTML(`<img class="rounded-xl">`);
            imgElement.setAttribute('src', settings.url);
            imgElement.setAttribute('alt', settings.caption ?? "");
            figureElement.appendChild(imgElement);
            const captionElement = fromHTML(`<figcaption>`);
            figureElement.appendChild(captionElement);
            settings.captionElement = captionElement;
            if (settings.caption) {
                captionElement.textContent = settings.caption;
            } else {
                captionElement.classList.add('hide');
            }
            element.appendChild(figureElement);
            settings.imgElement = imgElement;
            settings.figureElement = figureElement;
        } else if (type == Flow.iconType) {
            if (isString(settings.ds)) {
                element.appendChild(icons[settings.ds]());
            } else {
                const pathHtml = IconHelpers.dsToPathHtml(settings.ds, settings.iconProvider);
                const svgElement = IconHelpers.icon(pathHtml, settings.iconProvider, settings.title, settings.useTooltipInstead);
                element.appendChild(svgElement);
                settings.svgElement = svgElement;
            }
        } else if (Flow.containerTypes.has(settings.type)) {
            Flow.tryAddTitle(element, settings);
            let mainChildElements = settings.children.map(s => Flow.fromElementSettings(s));
            settings.mainChildElements = mainChildElements;
    
            if (type == Flow.barType) {
                if (settings.barSubType == Flow.navBarType) {
                    element.classList.add('listContainerHorizontal');
                } else if (settings.barSubType == Flow.listBarType) {
                    element.classList.add('listHorizontal');
                } else if (settings.barSubType == Flow.fillBarType) {
                    element.classList.add('listHorizontal');
                    mainChildElements = mainChildElements.map(e => {
                        const wrapper = fromHTML(`<div class="flexFill">`);
                        wrapper.appendChild(e);
                        return wrapper;
                    });
                }
                element.classList.add('gap-' + settings.gap);
                mainChildElements.forEach(e => element.appendChild(e));
            } else if (type == Flow.verticalType) {
                if (settings.centered == true) {
                    element.classList.add('listVertical');
                } else {
                    element.classList.add('divList');
                }
                mainChildElements.forEach(e => element.appendChild(e));
            } else if (type == Flow.buttonType) {
                const buttonElement = fromHTML(`<button>`);
                if (settings.buttonSubType == Flow.complexButtonType) {
                    buttonElement.classList.add('complexButton');
                    buttonElement.classList.add('largeElement');
                }
                if (settings.fullWidth) {
                    buttonElement.classList.add('w-100');
                }
                buttonElement.addEventListener('click', e => Flow.requireResponse(Flow.clickEventType, null, null, Flow.clickEventById.get(settings.id)));
                mainChildElements.forEach(e => buttonElement.appendChild(e));
                element.appendChild(buttonElement);
                settings.buttonElement = buttonElement;
            }
        } else if (type == Flow.textInputType) {
            const editorContainer = fromHTML(`<div class="contenteditableContainer">`);
            if (decorated) {
                editorContainer.classList.add('decoratedContainer');
            }
            const codeEditor = fromHTML(`<div contenteditable-type="plainTextOnly" contenteditable="true" class="w-100 fixText">`);
            if (settings.maxHeight != 0) codeEditor.classList.add('maxHeight-' + settings.maxHeight);
            codeEditor.setAttribute('spellcheck', settings.spellcheck);
            codeEditor.setAttribute('placeholder', settings.placeholder);
            codeEditor.textContent = settings.text;
            codeEditor.addEventListener('input', e => Flow.processContentEditableInput(e.srcElement, settings, 'text'));
            codeEditor.addEventListener('keydown', e => ContentEditableHelpers.checkForTab(e));
            if (decorated) {
                codeEditor.style.padding = "10px 12px";
                const leftElement = editorContainer.appendChild(fromHTML(`<div>`));
                leftElement.style.margin = "10px 0 0 10px";
                settings.leftElement = leftElement;
                editorContainer.appendChild(codeEditor);
                const rightElement = editorContainer.appendChild(fromHTML(`<div>`));
                rightElement.style.margin = "10px 10px 0 0";
                settings.rightElement = rightElement;
            } else {
                editorContainer.appendChild(codeEditor);
            }

            const streamTarget = fromHTML(`<div contenteditable="false" class="w-100 fixText hide">`);
            settings.streamTarget = streamTarget;
            editorContainer.appendChild(streamTarget);

            element.appendChild(editorContainer);
            settings.editorContainer = editorContainer;
            settings.codeEditor = codeEditor;
        } else if (type == Flow.numberInputType) {
            const inputElement = fromHTML(`<input type="number">`);
            inputElement.value = settings.number;
            inputElement.addEventListener('input', e => {
                InputHelpers.fixNumberInput(e.srcElement);
                Flow.processInput(e.srcElement, settings, 'number', 'value');
            });
            element.appendChild(inputElement);
            settings.inputElement = inputElement;
        } else if (type == Flow.passwordInputType) {
            const passwordElement = fromHTML(`<input type="password">`);
            if (decorated) {
                inputElement.classList.add('noBorder');
            }
            passwordElement.value = settings.password;
            passwordElement.setAttribute('placeholder', settings.placeholder);
            passwordElement.addEventListener('input', e => Flow.processInput(e.srcElement, settings, 'password', 'value'));
            element.appendChild(passwordElement);
            settings.passwordElement = passwordElement;
        } else if (type == Flow.codeInputType) {
            const editorContainer = fromHTML(`<pre class="contenteditableContainer">`);
            if (decorated) {
                editorContainer.classList.add('decoratedContainer');
            }
            const codeEditor = fromHTML(`<code contenteditable-type="plainTextOnly" contenteditable="true" class="w-100 fixText">`);
            if (settings.maxHeight != 0) codeEditor.classList.add('maxHeight-' + settings.maxHeight);
            codeEditor.setAttribute('spellcheck', false);
            codeEditor.setAttribute('placeholder', settings.placeholder);
            codeEditor.textContent = settings.code;
            codeEditor.addEventListener('input', e => Flow.processContentEditableInput(e.srcElement, settings, 'code'));
            codeEditor.addEventListener('keydown', e => ContentEditableHelpers.checkForTab(e));
            if (decorated) {
                codeEditor.style.padding = "10px 12px";
                const leftElement = editorContainer.appendChild(fromHTML(`<div>`));
                leftElement.style.margin = "10px 0 0 10px";
                settings.leftElement = leftElement;
                editorContainer.appendChild(codeEditor);
                const rightElement = editorContainer.appendChild(fromHTML(`<div>`));
                rightElement.style.margin = "10px 10px 0 0";
                settings.rightElement = rightElement;
            } else {
                editorContainer.appendChild(codeEditor);
            }

            const streamTarget = fromHTML(`<code contenteditable="false" class="w-100 fixText hide">`);
            settings.streamTarget = streamTarget;
            editorContainer.appendChild(streamTarget);

            element.appendChild(editorContainer);
            settings.editorContainer = editorContainer;
            settings.codeEditor = codeEditor;
        } else if (type == Flow.markdownInputType) {
            const contentContainer = fromHTML(`<div class="flex bordered rounded-xl">`);
            const editorContainer = fromHTML(`<div class="w-100 contenteditableContainer markdownCodeEditor">`);
            if (decorated) {
                editorContainer.classList.add('decoratedContainer');
            }
            const codeEditor = fromHTML(`<div contenteditable-type="plainTextOnly" contenteditable="true" class="w-100 fixText">`);
            if (settings.maxHeight != 0) codeEditor.classList.add('maxHeight-' + settings.maxHeight);
            codeEditor.setAttribute('spellcheck', settings.spellcheck);
            codeEditor.setAttribute('placeholder', settings.placeholder);
            codeEditor.textContent = settings.markdown;
            codeEditor.addEventListener('input', e => {
                Flow.processContentEditableInput(e.srcElement, settings, 'markdown');
                renderMarkdown(settings.markdownElement, settings.markdown, { delimiters: settings.katexDelimiters, noHighlight: settings.noHighlight, sanitize: true, katex: settings.katex });
            });
            codeEditor.addEventListener('keydown', e => ContentEditableHelpers.checkForTab(e));
            if (decorated) {
                codeEditor.style.padding = "10px 12px";
                const leftElement = editorContainer.appendChild(fromHTML(`<div>`));
                leftElement.style.margin = "10px 0 0 10px";
                settings.leftElement = leftElement;
                editorContainer.appendChild(codeEditor);
                const rightElement = editorContainer.appendChild(fromHTML(`<div>`));
                rightElement.style.margin = "10px 10px 0 0";
                settings.rightElement = rightElement;
            } else {
                editorContainer.appendChild(codeEditor);
            }

            const streamTarget = fromHTML(`<div contenteditable="false" class="w-100 fixText hide">`);
            settings.streamTarget = streamTarget;
            editorContainer.appendChild(streamTarget);

            contentContainer.appendChild(editorContainer);
            settings.editorContainer = editorContainer;
            settings.codeEditor = codeEditor;
            const markdownElement = fromHTML(`<div class="w-100 markdownPreview" placeholder="Markdown Output">`);
            renderMarkdown(markdownElement, settings.markdown, { delimiters: settings.katexDelimiters, noHighlight: settings.noHighlight, sanitize: true, katex: settings.katex });
            settings.markdownElement = markdownElement;
            contentContainer.appendChild(markdownElement);
            element.appendChild(contentContainer);
        } else if (type == Flow.checkboxInputType) {
            const checkboxContainer = fromHTML(`<div class="checkboxContainer">`);
            const checkboxElement = fromHTML(`<input type="checkbox">`);
            checkboxElement.checked = settings.checked;
            checkboxElement.addEventListener('change', e => Flow.processInput(e.srcElement, settings, 'checked', 'checked'));
            checkboxContainer.appendChild(checkboxElement);
            element.appendChild(checkboxContainer);
            settings.checkboxElement = checkboxElement;
        } else if (type == Flow.selectInputType) {
            const selectElement = fromHTML(`<select>`);
            selectElement.addEventListener('change', e => Flow.processInput(e.srcElement, settings, 'value', 'value'));
            settings.choices.forEach(c => {
                const choiceElement = fromHTML(`<option>`);
                choiceElement.value = c.value;
                choiceElement.text = c.name;
                choiceElement.selected = settings.value == c.value;
                selectElement.appendChild(choiceElement);
            });
            element.appendChild(selectElement);
            settings.selectElement = selectElement;
        } else if (type == Flow.imageInputType) {
            const editorContainer = fromHTML(`<div class="contenteditableContainer">`);
            if (decorated) {
                editorContainer.classList.add('decoratedContainer');
            }
            const contentContainer = fromHTML(`<div>`);
            const codeEditor = fromHTML(`<div contenteditable-type="plainTextOnly" contenteditable="true" class="w-100 fixText">`);
            if (settings.maxHeight != 0) codeEditor.classList.add('maxHeight-' + settings.maxHeight);
            codeEditor.setAttribute('placeholder', settings.placeholder);
            codeEditor.textContent = settings.url;
            codeEditor.addEventListener('input', e => {
                Flow.processContentEditableInput(e.srcElement, settings, 'url');
                settings.imgElement.setAttribute('src', settings.url);
            });
            codeEditor.addEventListener('keydown', e => ContentEditableHelpers.checkForTab(e));
            contentContainer.appendChild(codeEditor);
            settings.codeEditor = codeEditor;

            const figureElement = fromHTML(`<figure class="contenteditableContainerContent">`);
            const imgElement = fromHTML(`<img class="rounded-xl">`);
            imgElement.setAttribute('src', settings.url);
            imgElement.setAttribute('alt', settings.caption ?? "");
            figureElement.appendChild(imgElement);
            const captionCodeEditor = fromHTML(`<figcaption contenteditable-type="plainTextOnly" contenteditable="true" class="w-100 contenteditableContainerFooter fixText">`);
            if (!settings.editableCaption) captionCodeEditor.classList.add('hide');
            if (settings.captionMaxHeight != 0) codeEditor.classList.add('maxHeight-' + settings.captionMaxHeight);
            figureElement.appendChild(captionCodeEditor);

            const streamTarget = fromHTML(`<figcaption class="w-100 contenteditableContainerFooter fixText hide">`);
            settings.streamTarget = streamTarget;
            figureElement.appendChild(streamTarget);

            contentContainer.appendChild(figureElement);
            settings.imgElement = imgElement;
            settings.figureElement = figureElement;

            captionCodeEditor.setAttribute('placeholder', settings.captionPlaceholder);
            captionCodeEditor.setAttribute('spellcheck', settings.spellcheck);
            captionCodeEditor.textContent = settings.caption;
            captionCodeEditor.addEventListener('input', e => {
                Flow.processContentEditableInput(e.srcElement, settings, 'caption');
            });
            captionCodeEditor.addEventListener('keydown', e => ContentEditableHelpers.checkForTab(e));
            settings.captionCodeEditor = captionCodeEditor;
            contentContainer.appendChild(captionCodeEditor);

            if (decorated) {
                codeEditor.style.padding = "10px 12px";
                captionCodeEditor.style.padding = "10px 12px";
                const leftElement = contentContainer.appendChild(fromHTML(`<div>`));
                leftElement.style.margin = "10px 0 0 10px";
                settings.leftElement = leftElement;
                editorContainer.appendChild(contentContainer);
                const rightElement = editorContainer.appendChild(fromHTML(`<div>`));
                rightElement.style.margin = "10px 10px 0 0";
                settings.rightElement = rightElement;
            } else {
                editorContainer.appendChild(contentContainer);
            }

            settings.editorContainer = editorContainer;
            element.appendChild(editorContainer);
        } else if (type == Flow.fileInputType) {
            const fileElement = fromHTML(`<div class="w-100 largeElement bordered">`);
            const dropArea = fromHTML(`<div class="dropArea">`);
            dropArea.setAttribute('allowed-mime-types', settings.allowedMimeTypes);
            if (settings.maxSize) dropArea.setAttribute('max-file-size', settings.maxSize);
            dropArea.addEventListener('drop', e => Flow.processFileInput(e, settings));
            const dropDescriptionElement = fromHTML(`<div>`);
            dropDescriptionElement.textContent = settings.dropDescription;
            dropArea.appendChild(dropDescriptionElement);
            dropArea.appendChild(hb(4));
            const selectFilesElement = fromHTML(`<input type="file" class="dropInput">`);
            if (settings.multiple) selectFilesElement.setAttribute('multiple', '');
            selectFilesElement.setAttribute('accept', settings.allowedExtensions);
            selectFilesElement.addEventListener('change', e => Flow.processFileInput(e, settings));
            dropArea.appendChild(selectFilesElement);
            const dropButtonElement = fromHTML(`<button class="w-100 dropButton largeElement complexButton">`);
            dropButtonElement.textContent = settings.selectDescription;
            dropArea.appendChild(dropButtonElement);
            fileElement.appendChild(dropArea);
            fileElement.appendChild(hb(4));
            const filesDisplayElement = fromHTML(`<div>`);
            const noFileSelectedElement = fromHTML(`<i>`);
            noFileSelectedElement.textContent = settings.noFileSelectedMessage;
            filesDisplayElement.appendChild(noFileSelectedElement);
            fileElement.appendChild(filesDisplayElement);
            settings.filesDisplayElement = filesDisplayElement;
            settings.dropArea = dropArea;
            settings.dropDescriptionElement = dropDescriptionElement;
            settings.selectFilesElement = selectFilesElement;
            settings.dropButtonElement = dropButtonElement;
            element.appendChild(fileElement);
        } else if (type == Flow.pasteInputType) {
            const pasteElement = fromHTML(`<div class="w-100 largeElement bordered" tabIndex="0">`);
            pasteElement.addEventListener('paste', e => Flow.processPaste(e, settings));
            const descriptionElement = fromHTML(`<i>`);
            descriptionElement.textContent = settings.emptyDescription;
            settings.descriptionElement = descriptionElement;
            pasteElement.appendChild(descriptionElement);
            pasteElement.appendChild(hb(2));
            const filesDisplayElement = fromHTML(`<div class="w-100 scroll-y hide">`);
            settings.filesDisplayElement = filesDisplayElement;
            pasteElement.appendChild(filesDisplayElement);
            pasteElement.appendChild(hb(2));
            const htmlDisplayElement = fromHTML(`<div class="w-100 scroll-y hide" style="max-height: 400px;">`);
            settings.htmlDisplayElement = htmlDisplayElement;
            pasteElement.appendChild(htmlDisplayElement);
            element.appendChild(pasteElement);
            settings.pasteElement = pasteElement;
        }
    
        if (Flow.inputTypes.has(type)) {
            const validationContainer = fromHTML(`<div>`);
            if (!settings.isInvalid) validationContainer.classList.add('hide');
            validationContainer.appendChild(hb(1));
            const validationMessageElement = fromHTML(`<div class="validationMessage">`);
            validationMessageElement.textContent = settings.validationMessage;
            validationContainer.appendChild(validationMessageElement);
            element.appendChild(validationContainer);
            settings.validationMessageElement = validationMessageElement;
            settings.validationContainer = validationContainer;
        }

        settings.leftChildren?.forEach(s => settings.leftElement.appendChild(Flow.fromElementSettings(s)));
        settings.rightChildren?.forEach(s => settings.rightElement.appendChild(Flow.fromElementSettings(s)));
    
        return container;
    }
    

    static extractInputElements(groupSettings) {
        const inputs = [];
        let unprocessed = [groupSettings];
        while (unprocessed.length != 0) {
            let newUnprocessed = [];
            for (let settings of unprocessed) {
                if (Flow.inputTypes.has(settings.type)) inputs.push(settings);
                else if (settings.children != null) newUnprocessed = newUnprocessed.concat(settings.children);
            }
            unprocessed = newUnprocessed;
        }
        return inputs;
    }

    static extractInputValues(groupSettings) {
        const inputs = Flow.extractInputElements(groupSettings);
        const inputValues = [];
        for (let settings of inputs) {
            const value = {name: settings.name};
            const type = settings.type;
            
            if (type == Flow.textInputType) {
                value.text = settings.text;
            } else if (type == Flow.numberInputType) {
                value.number = settings.number;
            } else if (type == Flow.passwordInputType) {
                value.password = settings.password;
            } else if (type == Flow.codeInputType) {
                value.code = settings.code;
            } else if (type == Flow.markdownInputType) {
                value.markdown = settings.markdown;
            } else if (type == Flow.checkboxInputType) {
                value.checked = settings.checked;
            } else if (type == Flow.selectInputType) {
                value.value = settings.value;
            } else if (type == Flow.imageInputType) {
                value.url = settings.url;
                value.caption = settings.caption;
            }  else if (type == Flow.fileInputType) {
                value.files = settings.files;
            } else if (type == Flow.pasteInputType) {
                value.html = settings.html;
                value.rtf = settings.rtf;
                value.text = settings.text;
                value.files = settings.files;
            }

            inputValues.push(value);
        }

        return inputValues;
    }

    static closeOutputDialog() {
        Flow.dialogOutputElement.innerHTML = '';
        Flow.dialogOutputContainer.classList.add('hide');
    }

    static onCloseDialog(groupSettings) {
        if (groupSettings.location == Flow.dialogLocation) Flow.remove(groupSettings.group);
        Flow.postSuccessResponse(groupSettings.event);
        Flow.closeOutputDialog();
    }

    static onCancelDialog(groupSettings) {
        if (groupSettings.location == Flow.dialogLocation) Flow.remove(groupSettings.group);
        Flow.postErrorResponse(groupSettings.event, "dialog_canceled");
        Flow.closeOutputDialog();
    }

    static async onAccept(groupSettings) {
        if (groupSettings.accepted) return;

        if (groupSettings.location == Flow.dialogLocation) Flow.remove(groupSettings.group);

        const inputValues = Flow.extractInputValues(groupSettings);
        groupSettings.accepted = true;
        if (groupSettings.location != Flow.dialogLocation) groupSettings.acceptButtonElement.remove();

        const inputs = Flow.extractInputElements(groupSettings);
        for (let settings of inputs) {
            await Flow.requestDelayedValidation(settings)
        }

        if (groupSettings.isInvalid) return;

        groupSettings.accepted = true;
        Flow.postSuccessResponse(groupSettings.event, inputValues);
        if (groupSettings.location == Flow.dialogLocation) {
            Flow.closeOutputDialog();
            return;
        }

        for (let settings of inputs) {
            const element = fromHTML(`<div>`);

            // Create an uneditable element based on the input type
            const type = settings.type;
    
            if (type == Flow.textInputType) {
                element.classList.add('fixText');
                element.textContent = settings.text;
            } else if (type == Flow.numberInputType) {
                element.classList.add('fixText');
                element.textContent = settings.number;
            } else if (type == Flow.passwordInputType) {
                element.classList.add('fixText');
                element.textContent = '••••••••'; // Hide the actual password
            } else if (type == Flow.codeInputType) {
                element.classList.add('fixText');
                element.textContent = settings.code;
            } else if (type == Flow.markdownInputType) {
                const markdownContainer = fromHTML(`<div class="w-100">`);
                console.log(markdownContainer, settings);
                renderMarkdown(markdownContainer, settings.markdown, { delimiters: settings.katexDelimiters, noHighlight: settings.noHighlight, sanitize: true, katex: settings.katex });
                const rawTextContainer = fromHTML(`<div class="w-100 fixText hide">`);
                rawTextContainer.textContent = settings.markdown;
    
                const topBar = MarkdownHelpers.createBar(markdownContainer, rawTextContainer);
                const bottomBar = MarkdownHelpers.createBar(markdownContainer, rawTextContainer, true);
                element.appendChild(topBar);
                element.appendChild(markdownContainer);
                element.appendChild(rawTextContainer);
                element.appendChild(bottomBar);
            } else if (type == Flow.checkboxInputType) {
                const checkboxElement = fromHTML(`<input type="checkbox" disabled>`);
                checkboxElement.checked = settings.checked;
                element.appendChild(checkboxElement);
            } else if (type == Flow.selectInputType) {
                element.classList.add('fixText');
                const selectedChoice = settings.choices.find(c => c.value == settings.value);
                element.textContent = selectedChoice ? selectedChoice.name : '';
            } else if (type == Flow.imageInputType) {
                const figureElement = fromHTML(`<figure>`);
                const imgElement = fromHTML(`<img class="rounded-xl">`);
                imgElement.setAttribute('src', settings.url);
                imgElement.setAttribute('alt', settings.caption ?? "");
                figureElement.appendChild(imgElement);
                const captionElement = fromHTML(`<figcaption>`);
                figureElement.appendChild(captionElement);
                settings.captionElement = captionElement;
                if (settings.caption) {
                    captionElement.textContent = settings.caption;
                } else {
                    captionElement.classList.add('hide');
                }
                element.appendChild(figureElement);
                settings.imgElement = imgElement;
                settings.figureElement = figureElement;
            } else if (type == Flow.fileInputType) {
                const fileList = settings.filesDisplayElement.children;
                const displayList = document.createElement('div');
                for (const file of fileList) {
                    const fileElement = fromHTML(`<div>`);
                    fileElement.textContent = file.textContent;
                    displayList.appendChild(fileElement);
                }
                element.appendChild(displayList);
            } else if (type == Flow.pasteInputType) {
                const filesDisplay = settings.filesDisplayElement.innerHTML;
                const htmlDisplay = settings.htmlDisplayElement.innerHTML;
                element.innerHTML = filesDisplay || htmlDisplay || settings.emptyDescription;
            }
    
            settings.htmlElement.replaceWith(element);
        }
    }

    static fromGroupSettings(settings) {
        const container = fromHTML(`<div class="w-100">`);
        settings.htmlElement = container;

        let element = container;
        if (settings.breakBefore != 0 || settings.breakAfter != 0) {
            const horizontal = settings.parent.type == Flow.listBarType || settings.parent.type == Flow.buttonType;
            const name = horizontal ? 'h' : 'b';
            const subContainer = fromHTML(`<div class="w-100">`);
            if (settings.breakBefore) container.appendChild(name + 'b-' + settings.breakBefore);
            container.appendChild(subContainer);
            if (settings.breakAfter) container.appendChild(name + 'b-' + settings.breakBefore);
            element = subContainer;
        }

        if (settings.bordered) {
            element.classList.add('bordered');
            element.classList.add('largeElement');
        }

        if (settings.gap != 0) {
            element.classList.add('divList');
            element.classList.add('w-100');
            element.classList.add('gap-' + settings.gap);
        }

        for (const child of settings.children) {
            const childElement = Flow.fromElementSettings(child);
            element.appendChild(childElement);
        }

        const inputs = Flow.extractInputElements(settings);
        
        if (inputs.length != 0) {
            const validationContainer = fromHTML(`<div class="listContainerHorizontal">`);
            if (!settings.isInvalid) validationContainer.classList.add('hide');
            validationContainer.appendChild(hb(1));
            validationContainer.appendChild(fromHTML(`<div>`));
            const validationMessageElement = fromHTML(`<div class="validationMessage">Some inputs are invalid.`);
            settings.validationMessageElement = validationMessageElement;
            settings.validationContainer = validationContainer;
            validationContainer.appendChild(validationMessageElement);
            validationContainer.appendChild(hb(1));

            element.appendChild(validationContainer);

            if (settings.location != Flow.dialogLocation) {
                const footer = fromHTML(`<div class="listContainerHorizontal">`);
                footer.appendChild(fromHTML(`<div>`));
                const acceptButton = fromHTML(`<button class="largeElement complexButton">`);
                if (settings.isInvalid) acceptButton.setAttribute('disabled', '');
                acceptButton.textContent = "Accept";
                acceptButton.addEventListener('click', e => Flow.onAccept(settings));
                footer.appendChild(acceptButton);
                element.appendChild(footer);
                settings.acceptButtonElement = acceptButton;
                if (settings.noAccept) footer.classList.add('hide');
            }

        }

        if (settings.location == Flow.dialogLocation) {
            if (settings.noAccept) {
                Flow.dialogOutputAcceptButton.removeAttribute('disabled');
                Flow.dialogOutputFooter.classList.add('hide');
                if (!settings.noCloseOnOverlay) Flow.dialogOutputOverlay.addEventListener('click', e => Flow.onCloseDialog(settings));
            } else {
                settings.acceptButtonElement = Flow.dialogOutputAcceptButton;
                if (settings.isInvalid) Flow.dialogOutputAcceptButton.setAttribute('disabled', '');
                else Flow.dialogOutputAcceptButton.removeAttribute('disabled');
                Flow.dialogOutputCancelButton.addEventListener('click', e => Flow.onCancelDialog(settings));
                Flow.dialogOutputAcceptButton.addEventListener('click', e => Flow.onAccept(settings));
                Flow.dialogOutputOverlay.classList.remove('hide');
                Flow.dialogOutputFooter.classList.remove('hide');
            }

            Flow.dialogOutputOverlay.classList.remove('hide');
        } 

        return element;
    }

    static async spliceOutput(start = -1, deleteCount = 0, ...insertGroupSettings) {
        if (start < 0) start = Flow.output.length + 1 + start;
    
        if (Flow.output.length == 0 && insertGroupSettings.length > 0) Flow.outputElement.innerHTML = '';
    
        // Create elements
        const elements = insertGroupSettings.map(s => Flow.fromGroupSettings(s));
    
        // Validate inputs before showing (but after creating)
        for (let groupSettings of insertGroupSettings) {
            const inputs = Flow.extractInputElements(groupSettings);
            for (let settings of inputs) {
                await Flow.requestValidation(settings);
            }
        }
    
        // Splice settings
        const deleted = Flow.output.splice(start, deleteCount, ...insertGroupSettings);
    
        // Remove deleted elements from their respective parent elements
        deleted.forEach(s => {
            s.htmlElement.remove();
            Flow.groupByName.delete(s.name);
            Flow.settingsByGroupNameAndName.get(s.group.name).delete(s.name);
        });
    
        // Find the count of elements in different locations up to the start index
        let mainCountBeforeStart = 0;
        let stickyCountBeforeStart = 0;
        let dialogCountBeforeStart = 0;

        for (let i = 0; i < start; i++) {
            const location = Flow.output[i].location;
            if (location === Flow.stickyLocation) {
                stickyCountBeforeStart++;
            } else if (location === Flow.dialogLocation) {
                dialogCountBeforeStart++;
            } else {
                mainCountBeforeStart++;
            }
        }

        // Insert new elements into their respective parent elements
        const mainParent = Flow.outputElement;
        const stickyParent = Flow.stickyOutputElement;
        const dialogParent = Flow.dialogOutputElement;

        let mainInsertIndex = mainCountBeforeStart;
        let stickyInsertIndex = stickyCountBeforeStart;
        let dialogInsertIndex = dialogCountBeforeStart;

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            const groupSettings = insertGroupSettings[i];
            const location = groupSettings.location;

            if (location === Flow.stickyLocation) {
                // Insert into the stickyParent
                if (stickyInsertIndex < stickyParent.children.length) {
                    stickyParent.insertBefore(element, stickyParent.children[stickyInsertIndex]);
                } else {
                    stickyParent.appendChild(element);
                }
                stickyInsertIndex++;
            } else if (location === Flow.dialogLocation) {
                // Insert into the dialogParent
                dialogParent.replaceChildren(element);
                Flow.dialogOutputContainer.classList.remove('hide');
                dialogInsertIndex++;
            } else {
                // Insert into the mainParent
                if (mainInsertIndex < mainParent.children.length) {
                    mainParent.insertBefore(element, mainParent.children[mainInsertIndex]);
                } else {
                    mainParent.appendChild(element);
                }
                mainInsertIndex++;
            }
        }

        if (Flow.output.length == 0) Flow.mainLocation.textContent = Flow.noOutputMessage;
    }

    static async onShowRequest(event) {
        const e = event;
        const content = e.content;
        content.options ??= {};
        const options = content.options;
        options.sticky ??= false;
        options.insertAt ??= -1;
        options.insertBefore ??= null;
        options.insertAfterInstead ??= false;
        options.deleteAfter ??= 0;
        options.deleteBefore ??= 0;
        let insertAt = options.insertAt;
        if (options.insertBefore != null) {
            insertAt = Flow.output.findIndex(s => s.name == options.insertBefore);
            if (options.insertAfterInstead) insertAt += 1;
        }

        const settings = Flow.extractSettingsFromGroup(content);
        console.log(settings);
        settings.event = e;

        const inputs = Flow.extractInputElements(settings);

        await Flow.spliceOutput(insertAt, options.deleteAfter, settings);
        if (options.deleteBefore > 0) {
            await Flow.spliceOutput(insertAt - options.deleteBefore, options.deleteBefore);
        }

        if (inputs.length == 0 || options.noAccept) Flow.postSuccessResponse(e);
    }

    static async onRead(event) {
        const e = event;
        const content = e.content;
        console.log(content);
        const group = Flow.groupByName.get(content.groupName);
        let values = Flow.extractInputValues(group);
        if (content.elementName != null) values = values.find(v => v.name == content.elementName);
        
        Flow.postSuccessResponse(e, values);
    }

    static async onUpdate(event) {
        const e = event;
        const content = e.content;
        const properties = content.properties;
    
        const settings = Flow.settingsByGroupNameAndName.get(content.groupName).get(content.elementName);
        if (Flow.inputTypes.has(settings.type) && settings.group.accepted) return;
    console.log(event);
        // Update settings and corresponding elements
        if (properties.hide !== undefined) {
            settings.hide = content.hide;
            console.log(content.hide);
            if (content.hide) settings.htmlElement.classList.add('hide');
            else settings.htmlElement.classList.remove('hide');
        }
        if (properties.disabled !== undefined) {
            settings.disabled = properties.disabled;
            if (settings.disabled) {
                settings.contentElement.setAttribute('disabled', '');
            } else {
                settings.contentElement.removeAttribute('disabled');
            }
        }
        if (properties.text !== undefined) {
            settings.text = properties.text;
            if (settings.type === Flow.paragraphType || settings.type === Flow.titleType || settings.type === Flow.subTitleType) {
                settings.textElement.textContent = settings.text;
            } else if (settings.type === Flow.codeType) {
                settings.codeElement.textContent = settings.text;
            } else if (settings.type === Flow.textInputType || settings.type === Flow.codeInputType) {
                settings.codeEditor.textContent = settings.text;
            }
        }
        if (properties.url !== undefined) {
            settings.url = properties.url;
            if (settings.type === Flow.imageType) {
                settings.imgElement.setAttribute('src', settings.url);
            }
        }
        if (properties.caption !== undefined) {
            settings.caption = properties.caption;
            if (settings.type === Flow.imageType) {
                settings.captionElement.textContent = settings.caption;
            } else if (settings.type === Flow.imageInputType) {
                settings.captionCodeEditor.textContent = settings.caption;
            }
        }
        if (properties.editableCaption !== undefined && settings.type === Flow.imageInputType) {
            if (properties.editableCaption) {
                settings.captionCodeEditor.classList.remove('hide');
            } else {
                settings.captionCodeEditor.classList.add('hide');
            }
        }
        if (properties.checked !== undefined && settings.type === Flow.checkboxInputType) {
            settings.checked = properties.checked;
            settings.checkboxElement.checked = properties.checked;
        }
        if (properties.value !== undefined && settings.type === Flow.selectInputType) {
            settings.value = properties.value;
            settings.selectElement.value = properties.value;
        }
        if (properties.spellcheck !== undefined) {
            settings.spellcheck = properties.spellcheck;
            if (settings.type === Flow.textInputType || settings.type === Flow.markdownInputType) {
                settings.codeEditor.setAttribute('spellcheck', settings.spellcheck);
            } else if (settings.type === Flow.imageInputType) {
                settings.captionCodeEditor.setAttribute('spellcheck', settings.spellcheck);
            }
        }
        if (properties.placeholder !== undefined && (settings.type === Flow.textInputType || settings.type === Flow.codeInputType || settings.type === Flow.passwordInputType)) {
            settings.placeholder = properties.placeholder;
            settings.codeEditor.setAttribute('placeholder', settings.placeholder);
        }
        if (properties.number !== undefined && settings.type === Flow.numberInputType) {
            settings.number = properties.number;
            settings.inputElement.value = settings.number;
        }
        if (properties.password !== undefined && settings.type === Flow.passwordInputType) {
            settings.password = properties.password;
            settings.passwordElement.value = settings.password;
        }
        if (properties.markdown !== undefined) {
            settings.markdown = properties.markdown;
            if (settings.type === Flow.markdownType) {
                settings.rawTextElement.textContent = settings.markdown;
                renderMarkdown(settings.markdownElement, settings.markdown, {
                    delimiters: settings.katexDelimiters,
                    noHighlight: settings.noHighlight,
                    sanitize: true,
                    katex: settings.katex
                });
            } else if (settings.type === Flow.markdownInputType) {
                settings.codeEditor.value = settings.markdown;
                renderMarkdown(settings.markdownElement, settings.markdown, {
                    delimiters: settings.katexDelimiters,
                    noHighlight: settings.noHighlight,
                    sanitize: true,
                    katex: settings.katex
                });
            }
         

        }
        if (properties.files !== undefined && settings.type === Flow.fileInputType) {
            settings.filesDisplayElement.innerHTML = '';
            settings.files = [];
            Flow.addFiles(properties.files, settings);
        }
        if (settings.type === Flow.pasteInputType) {
            if (properties.html !== undefined ||
                properties.rtf !== undefined ||
                properties.text !== undefined ||
                properties.files !== undefined) {
                Flow.updatePaste(settings, properties);
            }
            if (properties.emptyDescription !== undefined) {
                settings.emptyDescription = properties.pasemptyDescriptionsword;
            }
            if (properties.replaceDescription !== undefined) {
                settings.replaceDescription = properties.replaceDescription;
            }
        }

    
        Flow.postSuccessResponse(e);
    }
    
    static remove(groupName, elementName = null) {
        if (elementName == null) {
            const start = Flow.output.findIndex(s => s.name == groupName);
            Flow.spliceOutput(start, 1);
        } else {
            const settings = Flow.settingsByGroupNameAndName.get(groupName).get(elementName);
            Flow.settingsByGroupNameAndName.get(groupName).delete(elementName);
            const start = settings.parent.children.findIndex(s => s.name == elementName);
            settings.parent.children.splice(start, 1);
            settings.htmlElement.remove();
        }
    }

    static async onRemove(event) {
        const e = event;
        const content = e.content;
        Flow.remove(content.groupName, content.elementName);
        Flow.postSuccessResponse(e);
    }

    static async onAcceptRequest(event) {
        const e = event;
        const content = e.content;
        if (content.groupName == null) {
            Flow.output.forEach(s => Flow.onAccept(s));
        } else {
            const group = Flow.groupByName.get(content.groupName);
            Flow.onAccept(group);
        }

        Flow.postSuccessResponse(e);
    }

    static async onClick(event) {
        const e = event;
        const id = e.content;
        Flow.clickEventById.set(id, event);
        // No response here
    }

    static async onChat(event) {
        const e = event;
        const content = e.content;
        const context = [];
        for (let message of content.context) {
            if (message.url) context.push(ChatGptApi.ToImageMessage(message.prompt, message.url));
            else context.push(ChatGptApi.toMessage(message.role, message.prompt));
        }
        const options = content.options ?? {};
        const chatOptions = {model: options.model, seed: options.seed};
        let settings;
        if (!Array.isArray(options.element)) options.element = [options.element, options.element];
        else if (options.element?.length == 1) options.element.push(options.element[0]);
        if (options.element?.length == 2) settings = Flow.settingsByGroupNameAndName.get(options.element[0]).get(options.element[1]);

        let result = '';
        try {
            if (options.hasOnUpdate || options.element?.length == 2) {
                if (options.element?.length == 2 && Flow.inputTypes.has(settings.type)) {
                    if (settings.type == Flow.imageInputType) {
                        settings.captionCodeEditor.classList.add('hide');
                    } else if (Flow.inputTypes.has(settings.type)) {
                        settings.codeEditor.classList.add('hide');
                    }

                    settings.streamTarget.classList.remove('hide');
                }

                // Stream
                result = await ChatGptApi.streamChat(context, async text => {
                    if (options.hasOnUpdate) {
                        const transformed = await Flow.requireResponse(Flow.chatStreamEventType, text, null, e);
                        if (transformed != null) text = transformed;
                    }
                    if (options.element?.length == 2) {
                        // Update the string value of the element based on its type
                        if (settings.type === Flow.paragraphType) {
                            settings.text = text;
                            settings.textElement.textContent = text;
                        } else if (settings.type === Flow.titleType) {
                            settings.text = text;
                            settings.textElement.textContent = text;
                        } else if (settings.type === Flow.subTitleType) {
                            settings.text = text;
                            settings.textElement.textContent = text;
                        } else if (settings.type === Flow.codeType) {
                            settings.code = text;
                            settings.codeElement.textContent = text;
                        } else if (settings.type === Flow.markdownType) {
                            settings.markdown = text;
                            settings.rawTextElement.textContent = text;
                            renderMarkdown(settings.markdownElement, text, {
                                delimiters: settings.katexDelimiters,
                                noHighlight: settings.noHighlight,
                                sanitize: true,
                                katex: settings.katex
                            });
                        } else if (settings.type === Flow.imageType) {
                            settings.caption = text;
                            settings.captionElement.textContent = text;
                        } else if (settings.type === Flow.textInputType) {
                            settings.text = text;
                        } else if (settings.type === Flow.codeInputType) {
                            settings.code = text;
                        } else if (settings.type === Flow.markdownInputType) {
                            settings.markdown = text;
                            renderMarkdown(settings.markdownElement, text, {
                                delimiters: settings.katexDelimiters,
                                noHighlight: settings.noHighlight,
                                sanitize: true,
                                katex: settings.katex
                            });
                        } else if (settings.type === Flow.imageInputType) {
                            settings.caption = text;
                            settings.captionCodeEditor.textContent = text;
                        }  else {
                            console.warn(`Unsupported type for streaming updates: ${settings.type}`);
                        }

                        if (options.element?.length == 2 && Flow.inputTypes.has(settings.type)) settings.streamTarget.textContent = text;
                    }
                }, chatOptions);

                if (options.element?.length == 2 && Flow.inputTypes.has(settings.type)) {
                    settings.streamTarget.classList.add('hide');

                    const targetElement = Flow.imageInputType ? settings.captionCodeEditor : settings.codeEditor;
                    targetElement.classList.remove('hide');    

                    InputHelpers.replaceTextWithUndo(targetElement, result);
                }
            } else {
                // Don't stream
                result = await ChatGptApi.chat(context, chatOptions);
            }

            Flow.postSuccessResponse(e, result);
        } catch(error) {
            console.log(error.stack);
            Flow.postErrorResponse(e, "chat_error");
        }
    }

    static async onSetProgressRequest(event) {
        const e = event;
        Flow.showProgress();
        Flow.setProgress(e.content);
        Flow.postSuccessResponse(e);
    }

    static async onSetStatusRequest(event) {
        const e = event;
        Flow.setStatus(e.content);
        Flow.postSuccessResponse(e);
    }

    static import(){
        for (let fileInfo of Flow.importData.files) {
            if (fileInfo.starred) {
                addLocalPage(fileInfo.item.name, fileInfo.item.link, fileInfo.item.code);
            } else {
                // Unstarring input is disabled
            }
        }
        Flow.closeImportDialog();
    }

    static openImportDialog() {
        Flow.importData.files = [];
        Flow.importData.filesDisplayElement.innerHTML = '';
        Flow.importData.filesDisplayElement.appendChild(fromHTML(`<i>No file selected.`));
        Flow.importDialog.classList.remove('hide');
    }

    static closeImportDialog() {
        Flow.importDialog.classList.add('hide');
    }

    static removeImportFile(index) {
        spliceChildren(Flow.importData.filesDisplayElement, index, 1);
        Flow.importData.files.splice(index, 1);
        if (Flow.importData.files.length == 0) {
            Flow.importData.importButton.setAttribute('disabled', '');
            Flow.importData.filesDisplayElement.appendChild(fromHTML(`<i>No file selected.`));
        }
    }

    static async processImport(event) {
        const fileData = [];
        const files = getFilesFromEvent(event);
        for (let file of files) {
            const text = await file.text();
            const json = JSON.parse(text);
            if (!json) {
                console.log("Error: File couldn't be parsed.");
                continue;
            }
            if (!isString(json.code) || !isString(json.name, true) || !isString(json.link, true)) {
                console.log("Error: Invalid file.");
                continue;
            }
            const item = {
                code: json.code,
                name: json.name,
                link: json.link,
            }
            const fileInfo = {
                name: file.name,
                starred: true,
                item,
            }
            fileData.push(fileInfo);
            break;
        }
        if (fileData.length == 0) return;
        if (Flow.importData.files.length == 0) Flow.importData.filesDisplayElement.innerHTML = '';
        Flow.importData.importButton.removeAttribute('disabled');

        Flow.importData.files = Flow.importData.files.concat(fileData);
        for (let [index, fileInfo] of Object.entries(fileData)) {
            const fileDisplayElement = fromHTML(`<div class="listHorizontal">`);
            const fileNameElement = fromHTML(`<div>`);
            fileNameElement.textContent = fileInfo.name + ':';
            fileDisplayElement.appendChild(fileNameElement);
            const nameInputElement = fromHTML(`<input type="text" tooltip="Enter name. Discarded if link is empty." placeholder="Enter name here...">`);
            nameInputElement.value = fileInfo.item.name;
            fileDisplayElement.appendChild(nameInputElement);
            const linkInputElement = fromHTML(`<input type="text" tooltip="Enter link. An empty link will override the default Code Flow page." placeholder="Enter link here...">`);
            linkInputElement.value = escapeFileNameMinimal(fileInfo.item.name);

            nameInputElement.addEventListener('input', e => {
                fileInfo.item.name = e.srcElement.value;
                if (fileInfo.item.name.trim() == '') e.srcElement.value = fileInfo.item.name = fileInfo.item.link;
                else if (!fileInfo.hasChanged) {
                    linkInputElement.value = fileInfo.item.link = escapeFileNameMinimal(fileInfo.item.name);
                }

            });
            linkInputElement.addEventListener('input', e => {
                fileInfo.item.link = e.srcElement.value;
                if (fileInfo.item.link.trim() == '') {
                    fileInfo.hasChanged = false;
                    //e.srcElement.value = escapeFileNameMinimal(fileInfo.item.name);
                    nameInputElement.value = fileInfo.item.name = '';
                }
                else if (fileInfo.item.link != e.srcElement.value) {
                    fileInfo.hasChanged = true;
                    fileInfo.item.link = e.srcElement.value = escapeFileNameMinimal(e.srcElement.value);;
                    if (fileInfo.item.name.trim() == '') nameInputElement.value = fileInfo.item.name = fileInfo.item.link;
                }
            });

            fileDisplayElement.appendChild(linkInputElement);

            // Star button
            // const starButton = fromHTML(`<button>`);
            // starButton.addEventListener('click', e => {
            //     fileInfo.starred = !fileInfo.starred;
            //     starButton.innerHTML = '';
            //     if (fileInfo.starred) starButton.appendChild(icons.star());
            //     else starButton.appendChild(icons.starFilled());
            // });
            // const starIcon = icons.starFilled();
            // starButton.appendChild(starIcon);
            // leftBarList.appendChild(starButton);

            const fileDeleteElement = fromHTML(`<button>`);
            fileDeleteElement.textContent = "X";
            fileDeleteElement.addEventListener('click', e => Flow.removeImportFile(index));
            fileDisplayElement.appendChild(fileDeleteElement);
            Flow.importData.filesDisplayElement.appendChild(fileDisplayElement);
        }
        
    }

    static setupImportDialog() {
        const dialogsContainer = document.getElementById('dialogs');
        const dialogElement = fromHTML(`<div class="dialog hide">`);
        const contentElement = fromHTML(`<div class="dialogContent">`);
    
        const element = fromHTML(`<div class="dialogInnerContent largeElement bordered grounded">`);
        const titleBar = fromHTML(`<div class="listContainerHorizontal">`);
        titleBar.appendChild(fromHTML(`<h1>Import Code`));
        element.appendChild(titleBar);
        element.appendChild(hb(2));

        // File drop area
        Flow.importData = {files: []};
        const dropArea = fromHTML(`<div class="dropArea" allowed-mime-types="${commonMimeTypes.json}">`);
        dropArea.addEventListener('drop', e => Flow.processImport(e));
        const dropDescriptionElement = fromHTML(`<div>Drag and drop valid .json files.`);
        dropArea.appendChild(dropDescriptionElement);
        dropArea.appendChild(hb(4));
        const selectFilesElement = fromHTML(`<input type="file" class="dropInput" multiple accept=".json">`);
        selectFilesElement.addEventListener('change', e => Flow.processImport(e));
        dropArea.appendChild(selectFilesElement);
        const dropButtonElement = fromHTML(`<button class="w-100 dropButton largeElement complexButton">Or select files`);
        dropArea.appendChild(dropButtonElement);
        element.appendChild(dropArea);

        // Files display
        element.appendChild(hb(4));
        const filesDisplayElement = fromHTML(`<div class="listVertical divList">`);
        filesDisplayElement.appendChild(fromHTML(`<i>No file selected.`));
        Flow.importData.filesDisplayElement = filesDisplayElement;
        element.appendChild(filesDisplayElement);
        element.appendChild(hb(4));

        // Footer
        const footer = fromHTML(`<div class="listHorizontal">`);
        const cancelButton = fromHTML(`<button class="w-100 largeElement complexButton flexFill">Cancel`);
        cancelButton.addEventListener('click', e => Flow.closeImportDialog());
        footer.appendChild(cancelButton);
        const importButton = fromHTML(`<button class="w-100 largeElement complexButton flexFill" disabled>Import`);
        importButton.addEventListener('click', e => Flow.import());
        Flow.importData.importButton = importButton;
        footer.appendChild(importButton);
        element.appendChild(footer);
    
        contentElement.appendChild(element);
        dialogElement.appendChild(contentElement);
        const overlayElement = fromHTML(`<div class="dialogOverlay">`);
        dialogElement.appendChild(overlayElement);
        dialogsContainer.appendChild(dialogElement);

        Flow.importDialog = dialogElement;
    }

    static export() {
        const item = {securityId};

        const name = getPathFromHash();
        if (name == 'flow') {
            item.code = localStorage.getItem('lastCode') ?? "";
        } else {
            const page = localPages.get(name);
            item.code = page.code;
            item.link = page.link;
            item.name = page.name;
        }

        const json = JSON.stringify(item);
        const fileName = item.name ? escapeFileName(item.name) : escapeFileName(item.link);
        downloadJson(fileName, json);
    }

    static closeStarDialog() {
        Flow.starDialog.classList.add('hide');
    }

    static openStarDialog() {
        const page = Flow.getPage();
        const isLinked = getPathFromHash() == 'external' && linkedPages.has(url);

        Flow.starData.name = page.name ?? '';
        Flow.starData.link = page.link ?? '';
        Flow.starData.hasChanged = false;

        Flow.starData.linkedCheckbox.checked = isLinked;

        Flow.starData.nameInputElement.value = Flow.starData.name;
        Flow.starData.linkInputElement.value = Flow.starData.link;
        if (isLinked) Flow.starData.linkInputElement.classList.add('hide');
        else Flow.starData.linkInputElement.classList.remove('hide');
        Flow.starData.urlInputElement.value = Flow.urlEditorElement.textContent;
        if (isLinked) Flow.starData.urlInputElement.classList.remove('hide');
        else Flow.starData.urlInputElement.classList.add('hide');

        if (getPathFromHash() == 'extern') {
            Flow.starData.toggleBar.checked = false;
            Flow.starData.toggleBar.classList.remove('hide');
        } else {
            Flow.starData.toggleBar.classList.add('hide');
        }

        Flow.updateSaveButton();

        Flow.starDialog.classList.remove('hide');
    }

    static saveStarSettings() {
        const page = Flow.getPage();
        const name = getPathFromHash();
        const url = Flow.urlEditorElement.textContent;
        const isLinked = name == 'external' && linkedPages.has(url);
        const linked = Flow.starData.linkedCheckbox.checked;
        if (linked) {
            const newUrl = Flow.starData.urlInputElement.value;
            if (isLinked && newUrl.trim() == '') {
                deleteLinkedPage(url);
            } else {
                addLinkedPage(Flow.starData.name, newUrl);
                openPage('extern?url=' + newUrl);
            }
        } else {
            if (!defaultPages.has(name)) {
                if (Flow.starData.link.trim() == '') {
                    // Delete bookmark
                    deleteLocalPage(page);
                    openPage();
                } else {
                    // Move bookmark
                    page.name = Flow.starData.name;
                    moveLocalPage(page, Flow.starData.link);
                    openPage(Flow.starData.link);
                }
            } else {
                if (Flow.starData.link.trim() != '') {
                    // Add bookmark
                    addLocalPage(Flow.starData.name, Flow.starData.link, page.code);
                }
            }
        }

        Flow.closeStarDialog();
    }

    static updateSaveButton() {
        const page = Flow.getPage();
        const name = getPathFromHash();
        const linked = Flow.starData.linkedCheckbox.checked;
        
        function enableSave() {
            Flow.starData.saveButton.removeAttribute('disabled');
            Flow.starData.saveButton.setAttribute('tooltip', 'Save changes');
        }

        function disableSave() {
            Flow.starData.saveButton.setAttribute('disabled', '');
            Flow.starData.saveButton.setAttribute('tooltip', 'No changes');
        }

        if (name == 'extern') {
            if (linked) {
                const newUrl = Flow.starData.urlInputElement.value;
                if (linkedPages.has(newUrl) && Flow.starData.name == linkedPages.get(newUrl).name) {
                    disableSave();
                } else {
                    enableSave();
                }
            } else {
                if (Flow.starData.link.trim() == '') {
                    disableSave();
                } else {
                    enableSave();
                }
            }
        } else {
            if ((Flow.starData.link == page.link && Flow.starData.name == page.name) || (name == 'flow' && Flow.starData.link.trim() == '')) {
                disableSave();
            } else {
                enableSave();
            }
        }
    }

    static setupStarDialog() {
        const dialogsContainer = document.getElementById('dialogs');
        const dialogElement = fromHTML(`<div class="dialog hide">`);
        const contentElement = fromHTML(`<div class="dialogContent">`);
    
        const element = fromHTML(`<div class="dialogInnerContent largeElement bordered grounded">`);
        const titleBar = fromHTML(`<div class="listContainerHorizontal">`);
        titleBar.appendChild(fromHTML(`<h1>Edit Bookmark`));
        element.appendChild(titleBar);
        element.appendChild(hb(7));

        // Star settings
        const starData = Flow.starData = {};
        const settingsElement = fromHTML(`<div class="listHorizontal">`);
        const fileNameElement = fromHTML(`<div>`);
        fileNameElement.textContent = 'Bookmark As:';
        settingsElement.appendChild(fileNameElement);

        // Toggle bar
        const toggleBar = fromHTML(`<div class="listHorizontal">`);
        starData.toggleBar = toggleBar;
        const label = fromHTML(`<div>Link to External Url`);
        label.setAttribute('tooltip', `If checked, the script will be saved in a linked state, meaning you can't change it. In return, it is always updated to the latest version.`);
        toggleBar.appendChild(label);
        const linkedCheckbox = fromHTML(`<input type="checkbox">`);
        starData.linkedCheckbox = linkedCheckbox;
        toggleBar.appendChild(linkedCheckbox);
        element.appendChild(toggleBar);

        // Name, url and link inputs
        const nameInputElement = fromHTML(`<input type="text" tooltip="Enter name. Discarded if link is empty." placeholder="Enter name here...">`);
        starData.nameInputElement = nameInputElement;
        settingsElement.appendChild(nameInputElement);
        const linkInputElement = fromHTML(`<input type="text" placeholder="Enter link here...">`);
        starData.linkInputElement = linkInputElement;
        const linkInputTooltip = `Enter link. An empty link will delete the bookmark. Please export code to json before deleting a bookmark. ` +
            `Using an existing link will override the existing one.`;
        linkInputElement.setAttribute('tooltip', linkInputTooltip);
        const urlInputElement = fromHTML(`<input type="text" tooltip="Enter an external url." class="hide" placeholder="Enter url here...">`);
        starData.urlInputElement = urlInputElement;
        linkedCheckbox.addEventListener('input', e => {
            if (linkedCheckbox.checked) {
                linkInputElement.classList.add('hide');
                urlInputElement.classList.remove('hide');
            } else {
                linkInputElement.classList.remove('hide');
                urlInputElement.classList.add('hide');
            }

            Flow.updateSaveButton();
        });

        nameInputElement.addEventListener('input', e => {
            Flow.starData.name = e.srcElement.value;
            if (Flow.starData.name.trim() == '') e.srcElement.value = Flow.starData.name = Flow.starData.link;
            else if (!Flow.starData.hasChanged) {
                linkInputElement.value = Flow.starData.link = escapeFileNameMinimal(Flow.starData.name);
            }

            Flow.updateSaveButton();
        });
        linkInputElement.addEventListener('input', e => {
            Flow.starData.link = e.srcElement.value;
            if (Flow.starData.link.trim() == '') {
                Flow.starData.hasChanged = false;
                nameInputElement.value = Flow.starData.name = '';
            }
            else if (Flow.starData.link != e.srcElement.value) {
                Flow.starData.hasChanged = true;
                Flow.starData.link = e.srcElement.value = escapeFileNameMinimal(e.srcElement.value);
                if (Flow.starData.name.trim() == '') nameInputElement.value = Flow.starData.name = Flow.starData.link;
            }

            Flow.updateSaveButton();
        });
        urlInputElement.addEventListener('input', e => Flow.updateSaveButton());

        settingsElement.appendChild(linkInputElement);
        settingsElement.appendChild(urlInputElement);
        element.appendChild(settingsElement);
        element.appendChild(hb(8));

        // Footer
        const footer = fromHTML(`<div class="listHorizontal">`);
        const cancelButton = fromHTML(`<button tooltip="Savely cancel any changes" class="w-100 largeElement complexButton flexFill">Cancel`);
        cancelButton.addEventListener('click', e => Flow.closeStarDialog());
        footer.appendChild(cancelButton);
        const saveButton = fromHTML(`<button tooltip="No changes" class="w-100 largeElement complexButton flexFill" disabled>Save`);
        saveButton.addEventListener('click', e => Flow.saveStarSettings());
        Flow.starData.saveButton = saveButton;
        footer.appendChild(saveButton);
        element.appendChild(footer);
    
        contentElement.appendChild(element);
        dialogElement.appendChild(contentElement);
        const overlayElement = fromHTML(`<div class="dialogOverlay">`);
        dialogElement.appendChild(overlayElement);
        dialogsContainer.appendChild(dialogElement);

        Flow.starDialog = dialogElement;
    }

    static setupOutputDialog() {
        const dialogsContainer = document.getElementById('dialogs');
        const dialogElement = fromHTML(`<div class="dialog hide">`);
        Flow.dialogOutputContainer = dialogElement;
        const contentElement = fromHTML(`<div class="dialogContent">`);
        const innerContentElement = fromHTML(`<div class="dialogInnerContent largeElement bordered grounded">`);
        const dialogOutputElement = fromHTML(`<div class="w-100 divList gap-4">`);
        Flow.dialogOutputElement = dialogOutputElement;
        innerContentElement.appendChild(dialogOutputElement);
        innerContentElement.appendChild(hb(4));
        const dialogFooter = fromHTML(`<div class="listHorizontal">`);
        Flow.dialogOutputFooter = dialogFooter;
        const cancelButton = fromHTML(`<button class="w-100 largeElement complexButton flexFill">Cancel`);
        Flow.dialogOutputCancelButton = cancelButton;
        dialogFooter.appendChild(cancelButton);
        const acceptButton = fromHTML(`<button class="w-100 largeElement complexButton flexFill" disabled>Accept`);
        Flow.dialogOutputAcceptButton = acceptButton;
        dialogFooter.appendChild(acceptButton);
        innerContentElement.appendChild(dialogFooter);
        contentElement.appendChild(innerContentElement);
        dialogElement.appendChild(contentElement);
        const overlayElement = fromHTML(`<div class="dialogOverlay">`);
        Flow.dialogOutputOverlay = overlayElement;
        dialogElement.appendChild(overlayElement);
        dialogsContainer.appendChild(dialogElement);
    }

    static setupDialogs() {
        Flow.setupImportDialog();
        Flow.setupStarDialog();
        Flow.setupOutputDialog();
    }
}

window.addEventListener('load', e => Flow.setupIframe());
window.addEventListener('load', e => Flow.setupDialogs());

function getFlowPage() {
    const name = getPathFromHash();
    const page = Flow.getPage();
    let code = page.code;
    let prompt = page.prompt;
    const url = getHashQueryVariable('url');
    const isLinked = name == 'extern' && linkedPages.has(url);

    const elements = [];

    let mode = getHashQueryVariable('mode') ?? Flow.editMode;
    const locked = getHashQueryVariable('locked') ?? false;
    if (locked) mode = Flow.runMode;

    const sticky = fromHTML(`<div class="sticky" style="outline: var(--background-color) 1px solid;">`); // Outline to overshadow input outlines
    const bar = fromHTML(`<div class="listContainerHorizontal">`);
    const leftBarList = fromHTML(`<div class="listHorizontal">`);
    bar.appendChild(leftBarList);

    // Top left buttons
    const importButton = fromHTML(`<button tooltip="Import Code from JSON" class="largeElement dark-only-raised dark-only-hoverable light-only-complexButton">`);
    importButton.addEventListener('click', e => Flow.openImportDialog());
    importButton.appendChild(icons.upload());
    leftBarList.appendChild(importButton);
    const exportButton = fromHTML(`<button tooltip="Export Code to JSON" class="largeElement dark-only-raised dark-only-hoverable light-only-complexButton">`);
    exportButton.addEventListener('click', e => Flow.export());
    exportButton.appendChild(icons.download());
    leftBarList.appendChild(exportButton);
    const starButton = fromHTML(`<button class="largeElement dark-only-raised dark-only-hoverable light-only-complexButton">`);
    starButton.setAttribute('tooltip', (defaultPages.has(name)) ? 'Bookmark for Easy Access' : 'Edit Bookmark');
    starButton.addEventListener('click', e => Flow.openStarDialog());
    const starIcon = (defaultPages.has(name) && !isLinked) ? icons.star() : icons.starFilled();
    starButton.appendChild(starIcon);
    leftBarList.appendChild(starButton);
    if (!locked) {
        const editButton = fromHTML(`<button tooltip="Edit Code" class="largeElement dark-only-raised dark-only-hoverable light-only-complexButton">`);
        editButton.addEventListener('click', e => Flow.edit());
        editButton.appendChild(icons.edit());
        if (mode == Flow.editMode) editButton.setAttribute('disabled', '');
        leftBarList.appendChild(editButton);
    }
    const runButton = fromHTML(`<button tooltip="Execute Code" class="largeElement dark-only-raised dark-only-hoverable light-only-complexButton">`);
    runButton.addEventListener('click', e => Flow.run());
    runButton.appendChild(icons.play());
    leftBarList.appendChild(runButton);
    elements.push(hb(7));

    // Progress and status
    sticky.appendChild(bar);
    sticky.appendChild(hb(2));
    const progressBar = fromHTML(`<progress value="0" max="100" class="w-100 hide">`);
    Flow.progressBar = progressBar;
    sticky.appendChild(progressBar);
    const status = fromHTML(`<div class="info indented">Not running...`);
    Flow.statusElement = status;
    sticky.appendChild(status);

    // Sticky output
    const stickyOutputContainer = fromHTML(`<div>`);
    stickyOutputContainer.appendChild(hb(2));
    const stickyOutputElement = fromHTML(`<div>`);
    Flow.stickyOutputElement = stickyOutputElement;
    stickyOutputContainer.appendChild(stickyOutputElement);
    Flow.stickyOutputContainer = stickyOutputContainer;
    sticky.appendChild(stickyOutputContainer);
    stickyOutputContainer.appendChild(hb(1));
    elements.push(sticky);
    elements.push(hb(7));

    if (mode == Flow.editMode) {
        // Extern url editor
        const urlEditorContainer = fromHTML(`<div class="contenteditableContainer">`);
        if (name != 'extern') urlEditorContainer.classList.add('hide');
        const urlEditor = fromHTML(`<div contenteditable-type="plainTextOnly" contenteditable="true" class="fixText" placeholder="Enter url here...">`);
        const newUrl = url ?? localStorage.getItem('externUrl');
        urlEditor.textContent = newUrl;
        urlEditor.setAttribute('spellcheck', false);
        urlEditor.addEventListener('input', e => Flow.updateUrl(urlEditor.textContent));
        urlEditor.addEventListener('keydown', e => ContentEditableHelpers.checkForTab(e));
        Flow.urlEditorElement = urlEditor;
        urlEditorContainer.appendChild(urlEditor);
        Flow.urlEditorContainerElement = urlEditorContainer;
        elements.push(urlEditorContainer);
        if (name == 'extern') elements.push(hb(2));
        const externTopList = fromHTML(`<div class="listContainerHorizontal">`);
        externTopList.appendChild(fromHTML(`<div>`));
        const rightExternTopList = fromHTML(`<div class="listHorizontal">`);

        // Load extern page button
        const loadButton = fromHTML(`<button class="largeElement complexButton">`);
        if (name != 'extern') loadButton.classList.add('hide');
        Flow.loadScriptButton = loadButton;
        const loadButtonList = fromHTML(`<div class="listHorizontal">`);
        const loadIcon = icons.download();
        loadIcon.classList.add('smallIcon');
        loadButtonList.appendChild(loadIcon);
        const loadButtonTextElement = fromHTML(`<div>Load Script`);
        loadButtonList.appendChild(loadButtonTextElement);
        loadButton.appendChild(loadButtonList);
        loadButton.addEventListener('click', e => Flow.loadScript());
        rightExternTopList.appendChild(loadButton);
        externTopList.appendChild(rightExternTopList);
        elements.push(externTopList);

        // Code editor
        const codeEditorContainer = fromHTML(`<pre class="contenteditableContainer">`);
        if (name == 'extern') codeEditorContainer.classList.add('hide');
        const codeEditor = fromHTML(`<code contenteditable-type="plainTextOnly" contenteditable="true" class="fixText" placeholder="Enter code here...">`);
        codeEditor.setAttribute('spellcheck', false);
        codeEditor.textContent = code;
        codeEditor.addEventListener('input', e => Flow.onCodeInput(e));
        codeEditor.addEventListener('keydown', e => ContentEditableHelpers.checkForTab(e));
        Flow.codeEditorElement = codeEditor;
        codeEditorContainer.appendChild(codeEditor);
        Flow.codeEditorContainerElement = codeEditorContainer;
        elements.push(codeEditorContainer);

        // Stream target
        const streamContainerElement = fromHTML(`<pre class="largeElement bordered hide">`);
        Flow.streamContainerElement = streamContainerElement;
        const streamTargetElement = fromHTML(`<code class="fixText" placeholder="Loading...">`);
        Flow.streamTargetElement = streamTargetElement;
        streamContainerElement.appendChild(streamTargetElement);
        elements.push(streamContainerElement);
        elements.push(hb(7));

        // Extern target
        const externCode = (Flow.loadedExternPage?.url == newUrl && newUrl != null) ? Flow.loadedExternPage.code : '';
        const externContainerElement = CodeHelpers.createCodeElement(externCode, "javascript");
        if (name != 'extern' || Flow.loadedExternPage?.url != newUrl || newUrl == null) externContainerElement.classList.add('hide');
        Flow.externContainerElement = externContainerElement;
        const externTargetElement = externContainerElement.querySelector('code');
        Flow.externTargetElement = externTargetElement;
        elements.push(externContainerElement);
        if (name == 'extern') elements.push(hb(7));

        // Prompt editor
        const promptEditorContainer = fromHTML(`<div class="contenteditableContainer">`);
        if (name == 'extern') promptEditorContainer.classList.add('hide');
        //promptEditorContainer.addEventListener('click', e => Flow.promptEditor.focus()); // removed because doesn't move tabIndex to closest.
        const promptEditor = fromHTML(`<div contenteditable-type="plainTextOnly" contenteditable="true" class="fixText" placeholder="Enter prompt here...">`);
        promptEditor.textContent = prompt;
        promptEditor.addEventListener('input', e => Flow.onPromptInput(e));
        promptEditor.addEventListener('keydown', e => ContentEditableHelpers.checkForTab(e));
        Flow.promptEditor = promptEditor;
        promptEditorContainer.appendChild(promptEditor);
        promptEditorContainer.appendChild(hb(5));
        const footer = fromHTML(`<div class="listContainerHorizontal contenteditableContainerFooter">`);
        footer.appendChild(fromHTML(`<div>`));
        const rightFooterList = fromHTML(`<div class="listHorizontal">`);

        // Rewrite button
        const rewriteButton = fromHTML(`<button class="largeElement complexButton">`);
        Flow.rewriteScriptButton = rewriteButton;
        const rewriteButtonList = fromHTML(`<div class="listHorizontal">`);
        const rewriteIcon = icons.retry();
        rewriteIcon.classList.add('smallIcon');
        rewriteButtonList.appendChild(rewriteIcon);
        const rewriteButtonTextElement = fromHTML(`<div>`);
        rewriteButtonTextElement.textContent = "Rewrite Script";
        rewriteButtonList.appendChild(rewriteButtonTextElement);
        rewriteButton.appendChild(rewriteButtonList);
        rewriteButton.addEventListener('click', e => Flow.generateScript(true));
        rightFooterList.appendChild(rewriteButton);

        // Generate button
        const generateButton = fromHTML(`<button class="largeElement complexButton">`);
        Flow.generateScriptButton = generateButton;
        const generateButtonList = fromHTML(`<div class="listHorizontal">`);
        const sparklesIcon = icons.sparkles();
        sparklesIcon.classList.add('smallIcon');
        generateButtonList.appendChild(sparklesIcon);
        const generateButtonTextElement = fromHTML(`<div>`);
        generateButtonTextElement.textContent = "Generate Script";
        generateButtonList.appendChild(generateButtonTextElement);
        generateButton.appendChild(generateButtonList);
        generateButton.addEventListener('click', e => Flow.generateScript());
        rightFooterList.appendChild(generateButton);

        // Settings button
        const settingsButton = fromHTML(`<button class="largeElement complexButton">`);
        settingsButton.setAttribute('tooltip', 'Open chatbot settings');
        const settingsIcon = icons.settings();
        settingsIcon.classList.add('smallIcon');
        settingsButton.appendChild(settingsIcon);
        settingsButton.addEventListener('click', e => Settings.open(Settings.chatbotPage));
        rightFooterList.appendChild(settingsButton);

        footer.appendChild(rightFooterList);
        promptEditorContainer.appendChild(footer);
        elements.push(promptEditorContainer);
    } else {
        // Output container
        const outputContainer = fromHTML(`<div class="divList gap-4">`);
        Flow.outputElement = outputContainer;
        outputContainer.textContent = Flow.noOutputMessage;
        elements.push(outputContainer);
    }

    return elements;
}

window.addEventListener('pageloaded', e => Flow.onPageLoaded());
