


class Flow {
    static runMode = 'run';
    static editMode = 'edit';
    static isRunning = false;
    static progress = 0;
    static maxProgress = 1;
    static status = "Running...";
    static noOutputMessage = "No output yet...";
    static output = [];
    static groupByElement = new Map();

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
            console.log(localPages.get(name), name);
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
        const systemPrompt = `The user will ask you to write a script for a custom interactive tool that clearly communicates with the user. Your script will be evaluated in the eval part of onmessage on a worker. Below is the worker script that will eval your script. All code you write will be executed within an async funciton within eval. Write the whole script and only the script within a single code block, such that it can be easily parsed.\n\n` +
            await Flow.getWorkerScript();
        const prompt = Flow.getPrompt();
        const systemMessage = ChatGptApi.ToSystemMessage(systemPrompt);
        const userMessage = ChatGptApi.ToUserMessage(prompt);
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

        Flow.codeEditorElement.focus();

        // Get the current selection
        const selection = window.getSelection();
        selection.removeAllRanges();

        const range = document.createRange();
        range.selectNodeContents(Flow.codeEditorElement);
        selection.addRange(range);

        document.execCommand('insertText', false, code);

        Flow.updateCode(code);
    }

    static async executeCode() {
        Flow.isRunning = true;

        Flow.progress = 0;
        Flow.status = "Running...";
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

        if (error) Flow.status = "Script Error: " + error.toString();
        else Flow.status = "Finished";
        console.log(Flow.status);
        Flow.progress = Flow.maxProgress;

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

    // Event status types
    static successStatus = 'successStatus';
    static errorStatus = 'errorStatus';

    // Event types
    static logEventType = "logEventType";
    static evalEventType = "evalEventType";
    static showEventType = "showEventType";
    static validateInputEventType = "validateInputEventType";
    static delayedValidateInputEventType = "delayedValidateInputEventType";
    static fileDownloadEventType = "fileDownloadEventType";
    static dataURLDownloadEventType = "dataURLDownloadEventType";
    static setProgressEventType = "setProgressEventType";
    static setStatusEventType = "setStatusEventType";

    // Element types
    static breakType = "breakType";
    static codeType = "codeType";
    static markdownType = "markdownType"; // Includes Katex math parser.
    static paragraphType = "paragraphType";
    static titleType = "titleType";
    static subTitleType = "subTitleType";
    static imageType = "imageType";
    static iconType = "iconType";

    // Icon types
    static materialIconType = "materialIconType";
    static heroIconType = "heroIconType";

    // Container element types
    static divType = "divType";
    static barType = "barType";

    // Bar types
    static navBarType = "navBarType";
    static listBarType = "listBarType";
    static fillBarType = "fillBarType";

    // Interactable types
    static buttonType = "buttonType";

    // Input element types
    static textInputType = "textInputType";
    static numberInputType = "numberInputType";
    static passwordInputType = "passwordInputType";
    static codeInputType = "codeInputType";
    static checkboxInputType = "checkboxInputType";
    static selectInputType = "selectInputType";
    static pasteInputType = "pasteInputType";
    static fileInputType = "fileInputType";

    // Element type sets
    static allTypes = new Set([
        Flow.breakType,
        Flow.markdownType,
        Flow.paragraphType,
        Flow.titleType,
        Flow.subTitleType,
        Flow.codeType,
        Flow.imageType,
        Flow.iconType,
        Flow.divType,
        Flow.barType,
        Flow.buttonType,
        Flow.textInputType,
        Flow.numberInputType,
        Flow.passwordInputType,
        Flow.codeInputType,
        Flow.checkboxInputType,
        Flow.selectInputType,
        Flow.pasteInputType,
        Flow.fileInputType,
    ]);

    static containerTypes = new Set([
        Flow.divType,
        Flow.barType,
    ]);

    static textTypes = new Set([
        Flow.markdownType,
        Flow.paragraphType,
        Flow.titleType,
        Flow.subTitleType,
    ]);

    static inputTypes = new Set([
        Flow.textInputType,
        Flow.numberInputType,
        Flow.passwordInputType,
        Flow.codeInputType,
        Flow.checkboxInputType,
        Flow.selectInputType,
        Flow.pasteInputType,
        Flow.fileInputType,
    ]);


    static htmlPasteItemType = "html";
    static textPasteItemType = "text";
    static rtfPasteItemType = "rtf";
    static filesPasteItemType = "files";
    
    // Event logic to communicate with worker
    static postRequest(type, content, id = null, pingId = null) {
        Flow.worker.postMessage({id, pingId, type, content});
    }

    static postSuccessResponse(requestEvent, content, message = null) {
        Flow.worker.postMessage({ id:requestEvent.data.id, type: requestEvent.data.type, response: true, status: Flow.successStatus, content, message });
    }

    static postErrorResponse(requestEvent, message, content = null) {
        Flow.worker.postMessage({ id:requestEvent.data.id, type: requestEvent.data.type, response: true, status: Flow.errorStatus, content, message });
    }

    static requireResponse(type, content, onPing = null){
        return new Promise((resolve, reject) => {
            const id = generateUniqueId();
            const pingId = null;
            if (onPing != null) {
                pingId = generateUniqueId();
                Flow.onEvent.set(pingId, async (event) => {
                    if (event.data.id !== pingId) return;
        
                    try {
                        const result = await onPing(event.data.content);
                        Flow.postSuccessResponse(event, result);
                    } catch (e) {
                        Flow.postErrorResponse(event, e.message);
                    }
                });
            }
    
            Flow.onEvent.set(id, (event) => {
                if (event.data.id !== id) return;
    
                Flow.onEvent.delete(id);
                if (pingId != null) Flow.onEvent.delete(pingId);
    
                if (event.data.status === Flow.errorStatus) reject(event.data.message);
                else resolve(event.data.content);
            });
    
    
            Flow.postRequest(type, content, id, pingId);
        });
    }
    
    static onWorkerMessage(event) {
        const e = event;
        if (e.data.type !== Flow.logEventType) console.log("Worker Message Received:", e.data);

        try {
            if (e.data.type === Flow.logEventType) {
                Flow.onLogRequest(e);
            } else if (e.data.type === Flow.showEventType) {
                Flow.onShowRequest(e);
            } else if (e.data.type === Flow.fileDownloadEventType) {
                Flow.onFileDownloadRequest(e);
            } else if (e.data.type === Flow.dataURLDownloadEventType) {
                Flow.onDataURLDownloadRequest(e);
            } else if (e.data.type === Flow.setProgressEventType) {
                Flow.onSetProgressRequest(e);
            } else if (e.data.type === Flow.setStatusEventType) {
                Flow.onSetStatusRequest(e);
            } else if (Flow.onEvent.has(e.data.id)) {
                Flow.onEvent.get(e.data.id)(e);
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

    // Element of group
    static extractSettingsFromElement(element) {
        const type = element.type;
        const options = element.options ?? {};
    
        const settings = {type, id: element.id};
        if (Flow.textTypes.has(type)) {
            settings.text = element.text;
            settings.title = options.title;
            settings.useTooltipInstead = options.useTooltipInstead ?? true;
            if (type == Flow.markdownType) {
                settings.katex = options.katex ?? true;
                settings.katexDelimiters = options.katexDelimiters;
            }
        } else if (type === Flow.codeType) {
            settings.code = element.code;
            settings.language = options.language;
        } else if (type === Flow.imageType) {
            settings.url = element.url;
            settings.caption = options.caption;
            settings.title = options.title;
            settings.useTooltipInstead = options.useTooltipInstead ?? true;
        } else if (type === Flow.iconType) {
            settings.ds = element.ds;
            settings.iconType = element.iconType;
            settings.caption = options.caption;
            settings.title = options.title;
            settings.useTooltipInstead = options.useTooltipInstead ?? true;
        } else if (Flow.containerTypes.has(type)) {
            settings.children = element.elements.map(e => Flow.extractSettingsFromElement(e));
            settings.children.forEach(s => s.parent = settings);
            if (type === Flow.barType) {
                settings.barType = options.barType;
            }
        } else if (Flow.inputTypes.has(type)) {
            settings.name = element.name;
            settings.hasValidation = element.hasValidation ?? false;
            settings.hasDelayedValidation = element.hasDelayedValidation ?? false;
            settings.isInvalid = options.isInvalid ?? false;
            settings.validationMessage = options.validationMessage ?? null;
    
            if (type === Flow.textInputType) {
                settings.text = options.defaultValue ?? '';
                settings.placeholder = options.placeholder ?? 'Enter text here...';
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
        const settings = {};
        settings.children = group.map(e => Flow.extractSettingsFromElement(e));
        settings.children.forEach(s => s.parent = settings);
        settings.accepted = false;
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
        // Add validation
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

        settings.html = html;
        settings.text = text;
        settings.rtf = rtf;
        settings.files = files;

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
    }

    static fromElementSettings(settings) {
        const type = settings.type;

        const element = fromHTML(`<div>`);
        settings.htmlElement = element;
        const containered = Flow.containerTypes.has(settings.parent.type);
        if (!containered) element.classList.add('w-100');
        

        if (type == Flow.breakType) {
            if (containered) element.classList.add('vb-1');
            else element.classList.add('hb-1');
        } else if (type == Flow.markdownType) {
            Flow.tryAddTitle(element, settings);
            renderMarkdown(element, settings.text, {options: {delimiters: settings.katexDelimiters}, sanitize: true, katex: settings.katex});
        } else if (type == Flow.paragraphType) {
            Flow.tryAddTitle(element, settings);
            element.classList.add('fixText');
            element.textContent = settings.text;
        } else if (type == Flow.titleType) {
            Flow.tryAddTitle(element, settings);
            element.classList.add('fixText');
            const titleElement = fromHTML(`<h1>`);
            titleElement.textContent = settings.text;
            element.appendChild(titleElement);
        } else if (type == Flow.subTitleType) {
            Flow.tryAddTitle(element, settings);
            const subTitleElement = fromHTML(`<h2>`);
            subTitleElement.textContent = settings.text;
            element.appendChild(subTitleElement);
        }  else if (type == Flow.codeType) {
            Flow.tryAddTitle(element, settings);
            element.classList.add('fixText');
            element.textContent = settings.code;
        } else if (type == Flow.imageType) {
            Flow.tryAddTitle(element, settings);
            const figureElement = fromHTML(`<figure>`);
            const imgElement = fromHTML(`<img class="rounded-xl">`);
            imgElement.setAttribute('src', settings.url);
            imgElement.setAttribute('alt', settings.caption ?? "");
            figureElement.appendChild(imgElement);
            if (settings.caption) {
                const captionElement = fromHTML(`<i>`);
                captionElement.textContent = settings.caption;
                figureElement.appendChild(captionElement);
            }
            element.appendChild(figureElement);
        } else if (type == Flow.iconType) {
            const pathHtml = icons.dsToPathHtml(settings.ds, settings.iconType);
            const svgElement = icons.icon(pathHtml, settings.iconType, settings.title, settings.useTooltipInstead);
            element.appendChild(svgElement);
        } else if (Flow.containerTypes.has(settings.type)) {
            const childElements = settings.children.map(s => Flow.fromElementSettings(s));

            if (type == Flow.barType) {
                if (settings.barType == Flow.navBarType) {
                    element.classList.add('listContainerHorizontal');
                } else if (settings.barType == Flow.listBarType) {
                    element.classList.add('listHorizontal');
                } else if (settings.barType == Flow.fillBarType) {
                    element.classList.add('listHorizontal');
                    childElements.map(e => {
                        const wrapper = fromHTML(`<div class="flexFill">`);
                        wrapper.appendChild(e);
                        return wrapper;
                    });
                }
            }

            childElements.forEach(e => element.appendChild(e));
        } else if (type == Flow.textInputType) {
            const editorContainer = fromHTML(`<div class="contenteditableContainer largeElement bordered">`);
            const codeEditor = fromHTML(`<div contenteditable-type="plainTextOnly" contenteditable="true" class="fixText">`);
            codeEditor.setAttribute('placeholder', settings.placeholder);
            codeEditor.textContent = settings.text;
            codeEditor.addEventListener('input', e => Flow.processContentEditableInput(e.srcElement, settings, 'text'));
            codeEditor.addEventListener('keydown', e => ContentEditableHelpers.checkForTab(e));
            editorContainer.appendChild(codeEditor);
            element.appendChild(editorContainer);
        } else if (type == Flow.numberInputType) {
            const inputElement = fromHTML(`<input type="number">`);
            inputElement.value = settings.number;
            inputElement.addEventListener('input', e => {
                InputHelpers.fixNumberInput(e.srcElement);
                Flow.processInput(e.srcElement, settings, 'number', 'value');
            });
            element.appendChild(inputElement);
        } else if (type == Flow.passwordInputType) {
            const passwordElement = fromHTML(`<input type="password">`);
            passwordElement.value = settings.password;
            passwordElement.setAttribute('placeholder', settings.placeholder);
            passwordElement.addEventListener('input', e => Flow.processInput(e.srcElement, settings, 'password', 'value'));
            element.appendChild(passwordElement);
        } else if (type == Flow.codeInputType) {
            const editorContainer = fromHTML(`<div class="contenteditableContainer largeElement bordered">`);
            const codeEditor = fromHTML(`<div contenteditable-type="plainTextOnly" contenteditable="true" class="fixText">`);
            codeEditor.setAttribute('placeholder', settings.placeholder);
            codeEditor.textContent = settings.code;
            codeEditor.addEventListener('input', e => Flow.processContentEditableInput(e.srcElement, settings, 'code'));
            codeEditor.addEventListener('keydown', e => ContentEditableHelpers.checkForTab(e));
            editorContainer.appendChild(codeEditor);
            element.appendChild(editorContainer);
        } else if (type == Flow.checkboxInputType) {
            const checkboxElement = fromHTML(`<input type="checkbox">`);
            checkboxElement.checked = settings.ticked;
            checkboxElement.addEventListener('change', e => Flow.processInput(e.srcElement, settings, 'ticked', 'checked'));
            element.appendChild(checkboxElement);
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
        }

        return element;
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
            } else if (type == Flow.checkboxInputType) {
                value.ticked = settings.ticked;
            } else if (type == Flow.selectInputType) {
                value.value = settings.value;
            } else if (type == Flow.fileInputType) {
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

    static onAccept(groupSettings) {
        const inputValues = Flow.extractInputValues(groupSettings);
        groupSettings.accepted = true;
        groupSettings.acceptButtonElement.remove();
        Flow.postSuccessResponse(groupSettings.event, inputValues);

        const inputs = Flow.extractInputElements(groupSettings);
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
            } else if (type == Flow.checkboxInputType) {
                const checkboxElement = fromHTML(`<input type="checkbox" disabled>`);
                checkboxElement.checked = settings.ticked;
                element.appendChild(checkboxElement);
            } else if (type == Flow.selectInputType) {
                element.classList.add('fixText');
                const selectedChoice = settings.choices.find(c => c.value == settings.value);
                element.textContent = selectedChoice ? selectedChoice.name : '';
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
        if (settings.children.length > 1) {
            groupElement.classList.add('bordered');
            groupElement.classList.add('largeElement');
        }

        for (const child of settings.children) {
            const childElement = Flow.fromElementSettings(child);
            groupElement.appendChild(childElement);
        }

        const inputs = Flow.extractInputElements(settings);
        if (inputs.length != 0) {
            groupElement.appendChild(hb(4));
            const footer = fromHTML(`<div class="listContainerHorizontal">`);
            footer.appendChild(fromHTML(`<div>`));
            const acceptButton = fromHTML(`<button class="largeElement complexButton">`);
            acceptButton.textContent = "Accept";
            acceptButton.addEventListener('click', e => Flow.onAccept(settings));
            footer.appendChild(acceptButton);
            groupElement.appendChild(footer);
            settings.acceptButtonElement = acceptButton;
        }

        return groupElement;
    }

    static spliceOutput(start = -1, deleteCount = 0, ...insertGroupSettings) {
        if (start < 0) start = Flow.output.length + 1 + start;

        if (Flow.output.length == 0 && insertGroupSettings.length > 0) Flow.outputElement.innerHTML = '';

        // Splice settings
        Flow.output.splice(start, deleteCount, ...insertGroupSettings);

        // Splice elements
        spliceChildren(Flow.outputElement, start, deleteCount, ...insertGroupSettings.map(s => Flow.fromGroupSettings(s)));

        if (Flow.output.length == 0) Flow.outputElement.textContent = Flow.noOutputMessage;
    }

    static onShowRequest(event) {
        const e = event;
        const content = e.data.content;
        const settings = Flow.extractSettingsFromGroup(content.group);
        settings.event = e;
        Flow.spliceOutput(content.insertAt, content.deleteAfter, settings);
        const inputs = Flow.extractInputElements(settings);
        if (inputs.length == 0) Flow.postSuccessResponse(e);
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
        console.log(item);
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
                openPage(page.link);
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

    const bar = fromHTML(`<div class="listContainerHorizontal sticky">`);
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
        const editButton = fromHTML(`<button class="largeElement dark-only-raised dark-only-hoverable light-only-complexButton">`);
        editButton.addEventListener('click', e => Flow.edit());
        editButton.appendChild(icons.edit());
        if (mode == Flow.editMode) editButton.setAttribute('disabled', '');
        leftBarList.appendChild(editButton);
    }
    const runButton = fromHTML(`<button class="largeElement dark-only-raised dark-only-hoverable light-only-complexButton">`);
    runButton.addEventListener('click', e => Flow.run());
    runButton.appendChild(icons.play());
    leftBarList.appendChild(runButton);

    elements.push(bar);
    elements.push(hb(7));

    if (mode == Flow.editMode) {
        // Code editor
        const codeEditorContainer = fromHTML(`<div class="contenteditableContainer">`);
        const codeEditor = fromHTML(`<div contenteditable-type="plainTextOnly" contenteditable="true" class="fixText" placeholder="Enter code here...">`);
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
