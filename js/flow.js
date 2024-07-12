


class Flow {
    static runMode = 'run';
    static editMode = 'edit';
    static isRunning = false;
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
        if (name !== 'flow' && !localPages.has(name)) return;

        let mode = getHashQueryVariable('mode') ?? Flow.editMode;
        const locked = getHashQueryVariable('locked') ?? false;
        if (locked) mode = Flow.runMode;

        if (mode == Flow.runMode) Flow.run();
    }

    static updateDefaultCode(code) {
        localStorage.setItem('lastCode', code);
    }

    static updateCode(code) {
        const name = getPathFromHash();
        if (name == 'flow') {
            Flow.updateDefaultCode(code);
        } else {
            const page = localPages.get(name);
            page.code = code;
            updateLocalPage(page);
        }
    }

    static getPage() {
        const name = getPathFromHash();
        if (name == 'flow') {
            const item = {
                prompt: localStorage.getItem('lastPrompt'),
                code: localStorage.getItem('lastCode'),
            };
            return item;
        } else {
            return localPages.get(name);
        }
    }

    static getCode() {
        const name = getPathFromHash();
        if (name == 'flow') {
            return localStorage.getItem('lastCode');
        } else {
            return localPages.get(name).code;
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
        } else {
            const page = localPages.get(name);
            page.prompt = prompt;
            updateLocalPage(page);
        }
    }

    static getPrompt() {
        const name = getPathFromHash();
        if (name == 'flow') {
            return localStorage.getItem('lastPrompt');
        } else {
            return localPages.get(name).prompt;
        }
    }
    
    static onPromptInput(event) {
        let text = event.srcElement.innerText;
        if (ContentEditableHelpers.textNeedsFixing(text)) event.srcElement.textContent = text = ContentEditableHelpers.fixText(text);
        Flow.updatePrompt(text);
    }

    static run() {
        const mode = getHashQueryVariable('mode') ?? Flow.editMode;
        if (Flow.isRunning) {
            window.location.reload();
        } else if (mode == Flow.runMode) {
            Flow.executeCode();
        } else {
            goToUrl(getUrlWithChangedHashParam('mode', Flow.runMode));
            return;
        }
    }

    static edit() {
        if (Flow.isRunning) {
            const url = getUrlWithChangedHashParam("mode", null);
            window.location.assign(url);
            window.location.reload();
        } else {
            goToUrl(getUrlWithChangedHashParam('mode', null));
            return;
        }
    }

    static async generateScript() {
        if (Flow.generating) return;
        Flow.generating = true;
        Flow.generateScriptButton.setAttribute('disabled', '');
        Flow.setStatus('Generating script...');

        const systemPrompt = `The user will ask you to write a script for a custom interactive tool that clearly communicates with the user. Your script will be evaluated in the eval part of onmessage on a worker. Below is the worker script that will eval your script. All code you write will be executed within an async funciton within eval. Write the whole script and only the script within a single code block (use \`\`\`code here\`\`\`), such that it can be easily parsed.\n\n` +
            await Flow.getWorkerScript();
        const prompt = Flow.getPrompt();
        const systemMessage = ChatGptApi.toSystemMessage(systemPrompt);
        const userMessage = ChatGptApi.toUserMessage(prompt);
        const context = [systemMessage, userMessage];

        Flow.codeEditorContainerElement.classList.add('hide');
        Flow.streamTargetElement.classList.remove('hide');

        const result = await ChatGptApi.streamChat(context, t => {
            const code = ParsingHelpers.extractCode(t);
            Flow.streamTargetElement.innerText = code;
        });
        const code = ParsingHelpers.extractCode(result);

        Flow.codeEditorContainerElement.classList.remove('hide');
        Flow.streamTargetElement.classList.add('hide');

        InputHelpers.replaceTextWithUndo(Flow.codeEditorElement, code);

        Flow.updateCode(code);

        Flow.setStatus('Finished');
        Flow.generating = false;
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

    static setStatus(message) {
        Flow.status = message;
        Flow.statusElement.textContent = Flow.status;
    }

    static async executeCode() {
        Flow.isRunning = true;

        Flow.setStatus("Running...");
        console.log(Flow.status);
        Flow.output = [];
        Flow.groupByElement.clear();

        Flow.createWorker();
        let error = false;
        try {
            let result = await Flow.evalOnWorker(Flow.getCode());
        } catch (e) {
            error = e;
        }
        Flow.worker.terminate();
        Flow.hideProgress();

        if (error) Flow.setStatus("Script Error: " + error);
        else Flow.setStatus("Finished");
        console.log(Flow.status);

        Flow.isRunning = false;
    }
    

    static destroyWorker() {
        if (Flow.worker == null) return;

        Flow.worker.terminate();
        Flow.worker = null;
    }

    static createWorker() {
        Flow.destroyWorker();
        const worker = new Worker('js/worker.js');
        Flow.worker = worker;
        console.log("Worker created:", worker);
        worker.onmessage = Flow.onWorkerMessage;
        return worker;
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
    static showEventType = "showEventType";
    static readEventType = "readEventType";
    static updateEventType = "updateEventType";
    static removeEventType = "removeEventType";
    static validateInputEventType = "validateInputEventType";
    static delayedValidateInputEventType = "delayedValidateInputEventType";
    static clickEventType = "clickEventType";
    static chatEventType = "chatEventType";
    static chatStreamEventType = "chatStreamEventType";
    static fileDownloadEventType = "fileDownloadEventType";
    static dataURLDownloadEventType = "dataURLDownloadEventType";
    static setProgressEventType = "setProgressEventType";
    static setStatusEventType = "setStatusEventType";

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


    static htmlPasteItemType = "html";
    static textPasteItemType = "text";
    static rtfPasteItemType = "rtf";
    static filesPasteItemType = "files";
    
    // Event logic to communicate with worker
    static postRequest(type, content, id = null, pingId = null, pingSourceEvent = null) {
        Flow.worker.postMessage({id, pingId, pingSourceId: pingSourceEvent?.data.pingId, type, content});
    }

    static postSuccessResponse(requestEvent, content = null, message = null) {
        Flow.worker.postMessage({ id:requestEvent.data.id, type: requestEvent.data.type, response: true, status: Flow.successStatus, content, message });
    }

    static postErrorResponse(requestEvent, message, content = null) {
        Flow.worker.postMessage({ id:requestEvent.data.id, type: requestEvent.data.type, response: true, status: Flow.errorStatus, content, message });
    }

    static requireResponse(type, content, onPing = null, pingSourceEvent = null){
        return new Promise((resolve, reject) => {
            const id = generateUniqueId();
            let pingId = null;
            if (onPing != null) {
                pingId = generateUniqueId();
                Flow.onPingEvent.set(pingId, async (event) => {
                    try {
                        const result = await onPing(event.data.content, event);
                        Flow.postSuccessResponse(event, result);
                    } catch (e) {
                        Flow.postErrorResponse(event, "Executing request produced an error.");
                    }
                });
            }
    
            Flow.onEvent.set(id, (event) => {
                Flow.onEvent.delete(id);
                if (pingId != null) Flow.onPingEvent.delete(pingId);

                if (event.data.status === Flow.errorStatus) reject(event.data.stack);
                else resolve(event.data.content);
            });
    
    
            Flow.postRequest(type, content, id, pingId, pingSourceEvent);
        });
    }
    
    static onWorkerMessage(event) {
        const e = event;
        if (e.data.type !== Flow.logEventType) console.log("Worker Message Received:", e.data);

        try {
            if (Flow.onEvent.has(e.data.id)) {
                Flow.onEvent.get(e.data.id)(e);
            } else if (Flow.onPingEvent.has(e.data.pingSourceId)) {
                Flow.onPingEvent.get(e.data.pingSourceId)(e);
            } else if (e.data.type === Flow.logEventType) {
                Flow.onLogRequest(e);
            } else if (e.data.type === Flow.showEventType) {
                Flow.onShowRequest(e);
            } else if (e.data.type === Flow.readEventType) {
                Flow.onRead(e);
            } else if (e.data.type === Flow.updateEventType) {
                Flow.onUpdate(e);
            }  else if (e.data.type === Flow.removeEventType) {
                Flow.onRemove(e);
            } else if (e.data.type === Flow.clickEventType) {
                Flow.onClick(e);
            } else if (e.data.type === Flow.chatEventType) {
                Flow.onChat(e);
            } else if (e.data.type === Flow.fileDownloadEventType) {
                Flow.onFileDownloadRequest(e);
            } else if (e.data.type === Flow.dataURLDownloadEventType) {
                Flow.onDataURLDownloadRequest(e);
            } else if (e.data.type === Flow.setProgressEventType) {
                Flow.onSetProgressRequest(e);
            } else if (e.data.type === Flow.setStatusEventType) {
                Flow.onSetStatusRequest(e);
            }
        } catch (error) {
            console.error("Error while executing worker request:", error.stack);
            Flow.postErrorResponse(e, "Error while executing worker request.");
        }
    }

    static onLogRequest(event) {
        const e = event;
        if (e.data.content == null) {
            console.log("Worker Log:", e.data.content);
        } else {
            const contentArray = JSON.parse(e.data.content);

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
            settings.validationMessageElement.classList.add('hide');
        } else {
            settings.validationMessageElement.textContent = response.message ?? 'Invalid value. Please choose a different value.';
            settings.validationMessageElement.classList.remove('hide');
        }

        settings.group.isInvalid = inputs.some(s => s.isInvalid);
        
        if (settings.group.isInvalid) {
            settings.group.validationMessageElement.classList.remove('hide');
            settings.group.acceptButtonElement.setAttribute('disabled', '');
        } else {
            settings.group.validationMessageElement.classList.add('hide');
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
        settings.hide = element.hide ?? false;
        settings.disabled = element.disabled ?? false;
        Flow.settingsByGroupNameAndName.get(groupSettings.name).set(settings.name, settings);

        if (Flow.textTypes.has(type)) {
            settings.text = element.text;
            settings.title = options.title;
            settings.useTooltipInstead = options.useTooltipInstead ?? true;
        } else if (type === Flow.emptyType) {
            // Do nothing
        } else if (type === Flow.rulerType) {
            settings.vertical = options.vertical;
        } else if (type === Flow.codeType) {
            settings.code = element.code;
            settings.language = options.language;
        } else if (type === Flow.markdownType) {
            settings.markdown = element.markdown;
            settings.katex = options.katex ?? true;
            settings.katexDelimiters = options.katexDelimiters;
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
            } else if (type === Flow.markdownInputType) {
                settings.markdown = options.defaultValue ?? '';
                settings.placeholder = options.placeholder ?? 'Enter markdown here...';
                settings.spellcheck = options.spellcheck ?? false;
                settings.katex = options.katex ?? true;
                settings.katexDelimiters = options.katexDelimiters;
            } else if (type === Flow.checkboxInputType) {
                settings.ticked = options.defaultValue ?? false;
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
        console.log(group);
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
        settings.sticky = options.sticky ?? false;
        const inputs = Flow.extractInputElements(settings.children);
        settings.isInvalid = inputs.some(s => s.isInvalid);
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
        if (settings.disabled) element.setAttribute('disabled', '');
        settings.contentElement = element;
    
        if (type == Flow.breakType) {
            if (containered) element.classList.add('vb-1');
            else element.classList.add('hb-1');
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
            console.log(markdownContainer, settings);
            renderMarkdown(markdownContainer, settings.markdown, { options: { delimiters: settings.katexDelimiters }, sanitize: true, katex: settings.katex });
            settings.markdownElement = markdownContainer;
            const rawTextElement = fromHTML(`<div class="w-100 fixText hide">`);
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

            const streamTarget = fromHTML(`<div contenteditable-type="plainTextOnly" contenteditable="true" class="w-100 fixText hide">`);
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

            const streamTarget = fromHTML(`<code contenteditable-type="plainTextOnly" contenteditable="true" class="w-100 fixText hide">`);
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
            codeEditor.setAttribute('spellcheck', settings.spellcheck);
            codeEditor.setAttribute('placeholder', settings.placeholder);
            codeEditor.textContent = settings.markdown;
            codeEditor.addEventListener('input', e => {
                Flow.processContentEditableInput(e.srcElement, settings, 'markdown');
                renderMarkdown(settings.markdownElement, settings.markdown, { options: { delimiters: settings.katexDelimiters }, sanitize: true, katex: settings.katex });
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

            const streamTarget = fromHTML(`<div contenteditable-type="plainTextOnly" contenteditable="true" class="w-100 fixText hide">`);
            settings.streamTarget = streamTarget;
            editorContainer.appendChild(streamTarget);

            contentContainer.appendChild(editorContainer);
            settings.editorContainer = editorContainer;
            settings.codeEditor = codeEditor;
            const markdownElement = fromHTML(`<div class="w-100 markdownPreview" placeholder="Markdown Output">`);
            renderMarkdown(markdownElement, settings.markdown, { options: { delimiters: settings.katexDelimiters }, sanitize: true, katex: settings.katex });
            settings.markdownElement = markdownElement;
            contentContainer.appendChild(markdownElement);
            element.appendChild(contentContainer);
        } else if (type == Flow.checkboxInputType) {
            const checkboxContainer = fromHTML(`<div class="checkboxContainer">`);
            const checkboxElement = fromHTML(`<input type="checkbox">`);
            checkboxElement.checked = settings.ticked;
            checkboxElement.addEventListener('change', e => Flow.processInput(e.srcElement, settings, 'ticked', 'checked'));
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
            element.appendChild(hb(1));
            const validationMessageElement = fromHTML(`<div class="validationMessage">`);
            if (!settings.isInvalid) validationMessageElement.classList.add('hide');
            validationMessageElement.textContent = settings.validationMessage;
            element.appendChild(validationMessageElement);
            settings.validationMessageElement = validationMessageElement;
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
                value.ticked = settings.ticked;
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

    static async onAccept(groupSettings) {
        const inputValues = Flow.extractInputValues(groupSettings);
        groupSettings.accepted = true;
        groupSettings.acceptButtonElement.remove();

        const inputs = Flow.extractInputElements(groupSettings);
        for (let settings of inputs) {
            await Flow.requestDelayedValidation(settings)
        }

        if (groupSettings.isInvalid) return;

        groupSettings.accepted = true;
        Flow.postSuccessResponse(groupSettings.event, inputValues);

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
                renderMarkdown(markdownContainer, settings.markdown, { options: { delimiters: settings.katexDelimiters }, sanitize: true, katex: settings.katex });
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
                checkboxElement.checked = settings.ticked;
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
        const groupElement = fromHTML(`<div class="w-100">`);
        settings.htmlElement = groupElement;
        if (settings.bordered) {
            groupElement.classList.add('bordered');
            groupElement.classList.add('largeElement');
        }

        for (const child of settings.children) {
            const childElement = Flow.fromElementSettings(child);
            groupElement.appendChild(childElement);
        }

        const inputs = Flow.extractInputElements(settings);
        if (inputs.length != 0) {
            groupElement.appendChild(hb(1));
            const validationContainer = fromHTML(`<div class="listContainerHorizontal">`);
            validationContainer.appendChild(fromHTML(`<div>`));
            const validationMessageElement = fromHTML(`<div class="validationMessage">Some inputs are invalid.`);
            if (!settings.isInvalid) validationMessageElement.classList.add('hide');
            settings.validationMessageElement = validationMessageElement;
            validationContainer.appendChild(validationMessageElement);
            groupElement.appendChild(validationContainer);
            groupElement.appendChild(hb(1));
            const footer = fromHTML(`<div class="listContainerHorizontal">`);
            footer.appendChild(fromHTML(`<div>`));
            const acceptButton = fromHTML(`<button class="largeElement complexButton">`);
            if (settings.isInvalid) acceptButton.setAttribute('disabled', '');
            acceptButton.textContent = "Accept";
            acceptButton.addEventListener('click', e => Flow.onAccept(settings));
            footer.appendChild(acceptButton);
            groupElement.appendChild(footer);
            settings.acceptButtonElement = acceptButton;
            if (settings.noAccept) footer.classList.add('hide');
        }

        return groupElement;
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
    
        // Find the count of sticky and non-sticky elements up to the start index
        let stickyCountBeforeStart = 0;
        let normalCountBeforeStart = 0;
    
        for (let i = 0; i < start; i++) {
            if (Flow.output[i].sticky) {
                stickyCountBeforeStart++;
            } else {
                normalCountBeforeStart++;
            }
        }
    
        // Insert new elements into their respective parent elements
        const stickyParent = Flow.stickyOutputElement;
        const normalParent = Flow.outputElement;
    
        let stickyInsertIndex = stickyCountBeforeStart;
        let normalInsertIndex = normalCountBeforeStart;
    
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            const groupSettings = insertGroupSettings[i];
    
            if (groupSettings.sticky) {
                // If sticky, insert into the stickyParent
                if (stickyInsertIndex < stickyParent.children.length) {
                    stickyParent.insertBefore(element, stickyParent.children[stickyInsertIndex]);
                } else {
                    stickyParent.appendChild(element);
                }
                stickyInsertIndex++;
            } else {
                // If not sticky, insert into the normalParent
                if (normalInsertIndex < normalParent.children.length) {
                    normalParent.insertBefore(element, normalParent.children[normalInsertIndex]);
                } else {
                    normalParent.appendChild(element);
                }
                normalInsertIndex++;
            }
        }
    
        if (Flow.output.length == 0) Flow.outputElement.textContent = Flow.noOutputMessage;
    }

    static async onShowRequest(event) {
        const e = event;
        const content = e.data.content;
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
            if (options.insertAfterInstead) groupIndex += 1;
        }

        const settings = Flow.extractSettingsFromGroup(content);
        settings.event = e;

        const inputs = Flow.extractInputElements(settings);

        await Flow.spliceOutput(insertAt, options.deleteAfter, settings);
        if (options.deleteBefore > 0) {
            await Flow.spliceOutput(insertAt - options.deleteBefore, options.deleteBefore);
        }

        if (inputs.length == 0) Flow.postSuccessResponse(e);
    }

    static async onRead(event) {
        const e = event;
        const content = e.data.content;
        console.log(content);
        const group = Flow.groupByName.get(content.groupName);
        let values = Flow.extractInputValues(group);
        if (content.elementName != null) values = values.find(v => v.name == content.elementName);
        
        Flow.postSuccessResponse(e, values);
    }

    static async onUpdate(event) {
        const e = event;
        const content = e.data.content;
    
        const settings = Flow.settingsByGroupNameAndName.get(content.groupName).get(content.elementName);
        if (Flow.inputTypes.has(settings.type) && settings.group.accepted) return;
    
        // Update settings and corresponding elements
        if (content.hide !== undefined) {
            settings.hide = content.hide;
            if (content.hide) settings.htmlElement.classList.add('hide');
            else settings.htmlElement.classList.remove('hide');
        }
        if (content.disabled !== undefined) {
            settings.disabled = content.disabled;
            if (settings.disabled) {
                settings.contentElement.setAttribute('disabled', '');
            } else {
                settings.contentElement.removeAttribute('disabled');
            }
        }
        if (content.text !== undefined) {
            settings.text = content.text;
            if (settings.type === Flow.paragraphType || settings.type === Flow.titleType || settings.type === Flow.subTitleType) {
                settings.textElement.textContent = content.text;
            } else if (settings.type === Flow.codeType) {
                settings.codeElement.textContent = content.text;
            } else if (settings.type === Flow.textInputType || settings.type === Flow.codeInputType) {
                settings.codeEditor.textContent = content.text;
            }
        }
        if (content.url !== undefined) {
            settings.url = content.url;
            if (settings.type === Flow.imageType) {
                settings.imgElement.setAttribute('src', content.url);
            }
        }
        if (content.caption !== undefined) {
            settings.caption = content.caption;
            if (settings.type === Flow.imageType) {
                settings.captionElement.textContent = content.caption;
            } else if (settings.type === Flow.imageInputType) {
                settings.captionCodeEditor.textContent = content.caption;
            }
        }
        if (content.editableCaption !== undefined && settings.type === Flow.imageInputType) {
            if (content.editableCaption) {
                settings.captionCodeEditor.classList.remove('hide');
            } else {
                settings.captionCodeEditor.classList.add('hide');
            }
        }
        if (content.ticked !== undefined && settings.type === Flow.checkboxInputType) {
            settings.ticked = content.ticked;
            settings.checkboxElement.checked = content.ticked;
        }
        if (content.value !== undefined && settings.type === Flow.selectInputType) {
            settings.value = content.value;
            settings.selectElement.value = content.value;
        }
        if (content.spellcheck !== undefined) {
            settings.spellcheck = content.spellcheck;
            if (settings.type === Flow.textInputType || settings.type === Flow.markdownInputType) {
                settings.codeEditor.setAttribute('spellcheck', content.spellcheck);
            } else if (settings.type === Flow.imageInputType) {
                settings.captionCodeEditor.setAttribute('spellcheck', content.spellcheck);
            }
        }
        if (content.placeholder !== undefined && (settings.type === Flow.textInputType || settings.type === Flow.codeInputType || settings.type === Flow.passwordInputType)) {
            settings.placeholder = content.placeholder;
            settings.codeEditor.setAttribute('placeholder', content.placeholder);
        }
        if (content.number !== undefined && settings.type === Flow.numberInputType) {
            settings.number = content.number;
            settings.inputElement.value = content.number;
        }
        if (content.password !== undefined && settings.type === Flow.passwordInputType) {
            settings.password = content.password;
            settings.passwordElement.value = content.password;
        }
        if (content.markdown !== undefined) {
            settings.markdown = content.markdown;
            if (settings.type === Flow.markdownType) {
                settings.rawTextElement.textContent = settings.markdown;
                renderMarkdown(settings.markdownElement, settings.markdown, {
                    options: { delimiters: settings.katexDelimiters },
                    sanitize: true,
                    katex: settings.katex
                });
            } else if (settings.type === Flow.markdownInputType) {
                settings.codeEditor.value = settings.markdown;
                renderMarkdown(settings.markdownElement, settings.markdown, {
                    options: { delimiters: settings.katexDelimiters },
                    sanitize: true,
                    katex: settings.katex
                });
            }
         

        }
        if (content.files !== undefined && settings.type === Flow.fileInputType) {
            settings.filesDisplayElement.innerHTML = '';
            settings.files = [];
            Flow.addFiles(content.files, settings);
        }
        if (settings.type === Flow.pasteInputType) {
            if (content.html !== undefined ||
                content.rtf !== undefined ||
                content.text !== undefined ||
                content.files !== undefined) {
                Flow.updatePaste(settings, content);
            }
            if (content.emptyDescription !== undefined) {
                settings.emptyDescription = content.pasemptyDescriptionsword;
            }
            if (content.replaceDescription !== undefined) {
                settings.replaceDescription = content.replaceDescription;
            }
        }

    
        Flow.postSuccessResponse(e);
    }
    

    static async onRemove(event) {
        const e = event;
        const content = e.data.content;
        if (content.elementName == null) {
            const start = Flow.output.findIndex(s => s.name == content.groupName);
            Flow.spliceOutput(start, 1);
        } else {
            const settings = Flow.settingsByGroupNameAndName.get(content.groupName).get(content.elementName);
            Flow.settingsByGroupNameAndName.get(content.groupName).delete(content.elementName);
            const start = settings.parent.children.findIndex(s => s.name == content.elementName);
            settings.parent.children.splice(start, 1);
            settings.htmlElement.remove();
        }
        Flow.postSuccessResponse(e);
    }

    static async onClick(event) {
        const e = event;
        const id = e.data.content;
        Flow.clickEventById.set(id, event);
        // No response here
    }

    static async onChat(event) {
        const e = event;
        const content = e.data.content;
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
                                options: { delimiters: settings.katexDelimiters },
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
                                options: { delimiters: settings.katexDelimiters },
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
            Flow.postErrorResponse(e, error.message);
        }
    }

    static async onSetProgressRequest(event) {
        const e = event;
        Flow.showProgress();
        Flow.setProgress(e.data.content);
        Flow.postSuccessResponse(e);
    }

    static async onSetStatusRequest(event) {
        const e = event;
        Flow.setStatus(e.data.content);
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
        const item = {};

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
        Flow.starData.name = page.name ?? '';
        Flow.starData.link = page.link ?? '';
        Flow.starData.hasChanged = false;

        Flow.starData.nameInputElement.value = Flow.starData.name;
        Flow.starData.linkInputElement.value = Flow.starData.link;

        Flow.starDialog.classList.remove('hide');
    }

    static saveStarSettings() {
        const page = Flow.getPage();
        if (page.link) {
            if (Flow.starData.link.trim() == '') {
                // Delete bookmark
                deleteLocalPage(page.link);
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
        Flow.closeStarDialog();
    }

    static updateSaveButton() {
        const page = Flow.getPage();
        if (Flow.starData.link == page.link && Flow.starData.name == page.name) {
            Flow.starData.saveButton.setAttribute('disabled', '');
            Flow.starData.saveButton.setAttribute('tooltip', 'No changes');
        } else {
            Flow.starData.saveButton.removeAttribute('disabled');
            Flow.starData.saveButton.setAttribute('tooltip', 'Save changes');
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
        Flow.starData = {};
        const settingsElement = fromHTML(`<div class="listHorizontal">`);
        const fileNameElement = fromHTML(`<div>`);
        fileNameElement.textContent = 'Bookmark As:';
        settingsElement.appendChild(fileNameElement);
        const nameInputElement = fromHTML(`<input type="text" tooltip="Enter name. Discarded if link is empty." placeholder="Enter name here...">`);
        settingsElement.appendChild(nameInputElement);
        const linkInputElement = fromHTML(`<input type="text" placeholder="Enter link here...">`);
        const linkInputTooltip = `Enter link. An empty link will delete the bookmark. Please export code to json before deleting a bookmark. ` +
            `Using an existing link will override the existing one.`;
        linkInputElement.setAttribute('tooltip', linkInputTooltip);

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
        Flow.starData.nameInputElement = nameInputElement;
        Flow.starData.linkInputElement = linkInputElement;

        settingsElement.appendChild(linkInputElement);
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

    static setupDialogs() {
        Flow.setupImportDialog();
        Flow.setupStarDialog();
    }
}

window.addEventListener('load', e => Flow.setupDialogs());

function getFlowPage() {
    const name = getPathFromHash();
    let code;
    let prompt;
    if (name == 'flow') {
        code = localStorage.getItem('lastCode') ?? "";
        prompt = localStorage.getItem('lastPrompt') ?? "";
    } else {
        code = localPages.get(name).code;
        prompt = localPages.get(name).prompt;
    }

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
    starButton.setAttribute('tooltip', name == 'flow' ? 'Bookmark for Easy Access' : 'Edit Bookmark');
    starButton.addEventListener('click', e => Flow.openStarDialog());
    const starIcon = name == 'flow' ? icons.star() : icons.starFilled();
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

    sticky.appendChild(bar);
    sticky.appendChild(hb(2));
    const progressBar = fromHTML(`<progress value="0" max="100" class="w-100 hide">`);
    Flow.progressBar = progressBar;
    sticky.appendChild(progressBar);
    const status = fromHTML(`<div class="info indented">Not running...`);
    Flow.statusElement = status;
    sticky.appendChild(status);
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
        // Code editor
        const codeEditorContainer = fromHTML(`<pre class="contenteditableContainer">`);
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
        const streamTargetElement = fromHTML(`<div class="largeElement bordered fixText hide">`);
        Flow.streamTargetElement = streamTargetElement;
        elements.push(streamTargetElement);
        elements.push(hb(7));

        // Prompt editor
        const promptEditorContainer = fromHTML(`<div class="contenteditableContainer">`);
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
        const outputContainer = fromHTML(`<div>`);
        Flow.outputElement = outputContainer;
        outputContainer.textContent = Flow.noOutputMessage;
        elements.push(outputContainer);
    }

    return elements;
}

window.addEventListener('pageloaded', e => Flow.onPageLoaded());
