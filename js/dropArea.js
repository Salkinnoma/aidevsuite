class DropAreaHelpers {
    static setupEventListeners() {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        [...document.getElementsByClassName('dropArea')].forEach(d => this.initializeDropArea(d));
        [...document.getElementsByClassName('dropButton')].forEach(d => this.initializeDropButton(d));

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Check if it's an element node
                        if (node.classList.contains('dropArea')) {
                            this.initializeDropArea(node);
                        } else if (node.classList.contains('dropButton')) {
                            this.initializeDropButton(node);
                        }

                    }

                    // Check if any child nodes of the added node also have the dropArea class
                    const dropAreas = node.querySelectorAll ? node.querySelectorAll('.dropArea') : [];
                    dropAreas.forEach(d => this.initializeDropArea(d));
                });
            });
        });

        const container = document.body;
        const observerOptions = {
            childList: true,
            subtree: true,
        };
        observer.observe(container, observerOptions);
    }

    static highlightDrag(dropArea) {
        dropArea.classList.add('dragover');
    }

    static unhighlightDrag(dropArea) {
        dropArea.classList.remove('dragover');
    }

    static initializeDropArea(dropArea) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });
        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, e => this.highlightDrag(dropArea), false);
        });
        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, e => this.unhighlightDrag(dropArea), false);
        });

        ['dragenter'].forEach(eventName => {
            dropArea.addEventListener(eventName, e => this.validateDragenterType(e), false);
        });
        ['dragleave'].forEach(eventName => {
            dropArea.addEventListener(eventName, e => this.onDragleave(e), false);
        });
        ['drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, e => this.onDragdrop(e), false);
        });
    }

    static initializeDropButton(dropButton){
        const dropArea = dropButton.closest('.dropArea');
        if (dropArea) dropButton.addEventListener('click', e => DropAreaHelpers.clickDropInput(dropArea));
    }

    static clickDropInput(dropArea){
        const inputs = dropArea.getElementsByClassName('dropInput');
        if (inputs.length === 0) return;
        inputs[0].click();
    }

    static validateDragenterType(event) {
        if (isChildEvent(event)) return;

        let element = event.currentTarget;
        const allowedFileTypes = this.getAllowedFileTypes(element);
        const allowedTypes = new Set(allowedFileTypes);
        const wildcardTypes = [...allowedTypes].filter(type => type.includes('*'));
        const isTypeAllowed = (fileType) => {
            if (allowedTypes.size === 0) return true;
            else if (allowedTypes.has(fileType)) return true;

            // Wildcard match
            for (const wildcard of wildcardTypes) {
                const [prefix] = wildcard.split('*');
                if (fileType.startsWith(prefix)) {
                    return true;
                }
            }

            return false;
        };

        let valid = false;
        if (event.dataTransfer.items) {
            const multiple = element.getAttribute('multiple');
            if (multiple || event.dataTransfer.items.length === 1) {
                for (let item of event.dataTransfer.items) {
                    if (item.kind === "file" && isTypeAllowed(item.type)) {
                        valid = true;
                        break;
                    }
                }
            }
        }

        if (valid) element.classList.add('dragover');
        else element.classList.add('invalidFiles');
    }

    static onDragleave(event) {
        if (isChildEvent(event)) return;

        this.onDragdrop(event);
    }

    static onDragdrop(event) {
        let element = event.currentTarget;
        element.classList.remove('dragover');
        element.classList.remove('invalidFiles');
    }

    static validateFiles(files, allowedFileTypes = [], maxSize = null) {
        const allowedTypes = new Set(allowedFileTypes);
        const wildcardTypes = [...allowedTypes].filter(type => type.includes('*'));
        const isTypeAllowed = (fileType) => {
            if (allowedTypes.size === 0) return true;
            else if (allowedTypes.has(fileType)) return true;

            // Wildcard match
            for (const wildcard of wildcardTypes) {
                const [prefix] = wildcard.split('*');
                if (fileType.startsWith(prefix)) {
                    return true;
                }
            }

            return false;
        };

        let newFiles = [];
        for (let file of files) {
            if (file && isTypeAllowed(file.type) && (maxSize == null || file.size <= maxSize)) {
                newFiles.push(file);
            } else {
                console.warn("Invalid file:", file.name);
            }
        }

        return newFiles;
    }

    static getAllowedFileTypes(element){
        return element.
            closest('.dropArea')?.
            getAttribute('allowed-file-types')?.
            split(',').
            map(ext => ext.trim()).
            filter(a => a !== "") ?? [];
    }
}

window.addEventListener('load', e => DropAreaHelpers.setupEventListeners())


function getFilesFromDropInput(event, maxSize = null){
    let input = event.srcElement;
    if (!input.files || input.files.length === 0) return;

    let files = [];
    for (let file of input.files) {
        files.push(file);
    }
    input.value = '';
    return DropAreaHelpers.validateFiles(files, DropAreaHelpers.getAllowedFileTypes(input), maxSize);
}

function getFilesFromDrop(event, maxSize = null){
    event.preventDefault();

    if (!event.dataTransfer.items) return;

    let files = [];
    for (let item of event.dataTransfer.items) {
        const file = item.getAsFile();
        files.push(file);
    }

    return DropAreaHelpers.validateFiles(files, DropAreaHelpers.getAllowedFileTypes(event.target), maxSize);
}
