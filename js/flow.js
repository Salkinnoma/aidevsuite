


class Flow {
    static runMode = 'run';
    static editMode = 'edit';
    static isRunning = false;
    static progress = 0;
    static maxProgress = 1;
    static status = "Running...";
    static output = [];
    static groupByElement = new Map();

    static onPageLoaded() {
        const name = getPathFromHash();
        if (name !== 'flow' && !localPages.has(name)) return;

        const mode = getHashQueryVariable('mode') ?? Flow.editMode;
        if (mode == Flow.runMode) Flow.run();
    }

    static updateCode(code) {
        const name = getPathFromHash();
        if (name == 'flow') {
            localStorage.setItem('lastCode', code);
        } else {
            const page = localPages.get(name);
            page.code = code;
            updateLocalPage(page);
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
        text = fixContentEditableText(text);
        if (text === '\n') event.srcElement.textContent = '';
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
            const url = HelperFunctions.getUrlWithChangedHashParam("mode", null);
            window.location.assign(url);
            window.location.reload();
        } else {
            goToUrl(getUrlWithChangedHashParam('mode', null));
            return;
        }
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
    static codeType = "codeType";
    static breakType = "breakType";
    static imageType = "imageType";
    static paragraphType = "paragraphType";
    static titleType = "titleType";
    static subTitleType = "subTitleType";

    // Container element types
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
    static checkboxInputType = "checkboxInputType";
    static selectInputType = "selectInputType";
    static pasteInputType = "pasteInputType";
    static fileInputType = "fileInputType";

    // Element type sets
    static allTypes = new Set([
        Flow.codeType,
        Flow.breakType,
        Flow.imageType,
        Flow.paragraphType,
        Flow.titleType,
        Flow.subTitleType,
        Flow.barType,
        Flow.buttonType,
        Flow.textInputType,
        Flow.numberInputType,
        Flow.passwordInputType,
        Flow.checkboxInputType,
        Flow.selectInputType,
        Flow.pasteInputType,
        Flow.fileInputType,
    ]);

    static containerTypes = new Set([
        Flow.barType,
    ]);

    static simpleTypes = new Set([
        Flow.paragraphType,
        Flow.titleType,
        Flow.subTitleType,
    ]);

    static inputTypes = new Set([
        Flow.textInputType,
        Flow.numberInputType,
        Flow.passwordInputType,
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
}

function getFlowPage() {
    const name = getPathFromHash();
    let code;
    if (name == 'flow') {
        code = localStorage.getItem('lastCode') ?? "";
    } else {
        code = localPages.get(name).code;
    }

    const elements = [];

    const mode = getHashQueryVariable('mode') ?? Flow.editMode;
    const locked = getHashQueryVariable('locked') ?? false;
    if (locked) mode = Flow.runMode;

    const bar = fromHTML(`<div class="listContainerHorizontal">`);
    const leftBarList = fromHTML(`<div class="listHorizontal">`);
    bar.appendChild(leftBarList);
    if (!locked) {
        const editButton = fromHTML(`<button class="largeElement raised hoverable">`);
        editButton.addEventListener('click', e => Flow.edit());
        editButton.appendChild(icons.edit());
        if (mode == Flow.editMode) editButton.setAttribute('disabled', '');
        leftBarList.appendChild(editButton);
    }
    const runButton = fromHTML(`<button class="largeElement raised hoverable">`);
    runButton.addEventListener('click', e => Flow.run());
    runButton.appendChild(icons.play());
    leftBarList.appendChild(runButton);
    elements.push(bar);

    elements.push(hb(7));

    if (mode == Flow.editMode) {
        const editorContainer = fromHTML(`<div class="contenteditableContainer largeElement raised">`);
        const codeEditor = fromHTML(`<div contenteditable-type="plainTextOnly" contenteditable="true" class="fixText" placeholder="Enter code here...">`);
        codeEditor.textContent = code;
        codeEditor.addEventListener('input', e => Flow.onCodeInput(e));
        codeEditor.addEventListener('keydown', e => ContentEditableHelpers.checkForTab(e));
        editorContainer.appendChild(codeEditor);
        elements.push(editorContainer);
    } else {
        const outputContainer = fromHTML(`<div>`);
        outputContainer.textContent = "No output yet...";
        elements.push(outputContainer);
    }

    return elements;
}

window.addEventListener('pageloaded', e => Flow.onPageLoaded());
