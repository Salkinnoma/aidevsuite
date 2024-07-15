class Monaco {
    static onInitMonacoEditor = new Map();
    static setupEventListeners() {
        document.querySelectorAll('[monaco-editor-init]').forEach(e => Monaco._tryInitializeMonaco(e));

        const observer = new MutationObserver((mutationsList) => {
            for (let mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check the node itself
                            Monaco._tryInitializeMonaco(node);

                            // Query and check all descendants
                            node.querySelectorAll('*').forEach(descendant => {
                                Monaco._tryInitializeMonaco(descendant);
                            });
                        }
                    });
                }
            }
        });

        // Start observing the body for child additions
        observer.observe(document.body, { childList: true, subtree: true });

        monaco.editor.defineTheme('my-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#222222',
            },
        });
        monaco.editor.setTheme('my-dark');
    }

    static _tryInitializeMonaco(element) {
        if (element.hasAttribute('monaco-editor-init')) {
            const id = element.getAttribute('monaco-editor-init');
            const callback = Monaco.onInitMonacoEditor.get(id);

            if (callback) {
                // Call the callback with the element
                callback(element);

                // Clean up
                Monaco.onInitMonacoEditor.delete(id);
                element.removeAttribute('monaco-editor-init');
            }
        }
    }

    static addContext(content, language, path = null) {
        return monaco.editor.createModel(content, language, path);
    }

    static clearContext() {
        monaco.editor.getModels().forEach(model => model.dispose());
    }

    static _createEditor(containerElement, content, language, options = null) {
        options ??= {};
        options.value = content;
        options.language = language;
        options.theme ??= 'my-dark';
        options.wordWrap ??= 'on';
        options.automaticLayout ??= true;
        options.formatOnPaste ??= true;
        options.formatOnType ??= true;
        options.wrappingIndent ??= 'deepIndent';
        options.autoDetectHighContrast = false;
        options.padding ??= { top: '25px' };
        return monaco.editor.create(containerElement, options);
    }

    static initEditor(containerElement, content, language, options) {
        return new Promise((resolve, reject) => {
            if (document.contains(containerElement)) {
                // Element is already in the DOM, initialize Monaco Editor immediately
                const editor = Monaco._createEditor(containerElement, content, language, options);
                resolve(editor);
            } else {
                // Generate a unique ID for the element
                const uniqueId = generateUniqueId();
                containerElement.setAttribute('monaco-editor-init', uniqueId);

                // Register the callback that initializes Monaco Editor
                Monaco.onInitMonacoEditor.set(uniqueId, (element) => {
                    const editor = Monaco._createEditor(element, content, language, options);
                    resolve(editor);
                });

            }
        });
    }

    static replaceCodeWithUndo(codeEditor, text) {
        codeEditor.pushUndoStop()

        codeEditor.executeEdits('replace', [
            {
                range: codeEditor.getModel().getFullModelRange(), // full range
                text: text, // target value here
            },
        ])

        codeEditor.pushUndoStop()
    }
}

require.config({ paths: { vs: 'dist/monaco-editor/min/vs' } });

window.addEventListener('load', e => Monaco.setupEventListeners());