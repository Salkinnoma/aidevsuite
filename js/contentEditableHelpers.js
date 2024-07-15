class ContentEditableHelpers {
    static setupEventListeners() {
        // Select all elements with the contenteditable-type attribute
        const editableElements = document.querySelectorAll('[contenteditable-type]');

        // Check and register the paste and input event listener for existing elements
        editableElements.forEach(ContentEditableHelpers.checkAndConvertPlainTextOnly);


        // Create a MutationObserver to monitor for newly added elements
        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.hasAttribute('contenteditable-type')) {
                                ContentEditableHelpers.checkAndConvertPlainTextOnly(node);
                                node.addEventListener('input', e => ContentEditableHelpers.onInput());
                            }
                            node.querySelectorAll('[contenteditable-type]').forEach(child => {
                                ContentEditableHelpers.checkAndConvertPlainTextOnly(child);
                                child.addEventListener('input', e => ContentEditableHelpers.onInput());
                            });
                        }
                    });
                } else if (mutation.type === 'attributes' && mutation.attributeName === 'contenteditable-type') {
                    ContentEditableHelpers.checkAndConvertPlainTextOnly(mutation.target);
                }
            }
        });

        // Start observing the document for added nodes and attribute changes
        observer.observe(document.body, { childList: true, attributes: true, subtree: true });
    }

    static convertToPlainText(element) {
        element.addEventListener('paste', function (event) {
            event.preventDefault();

            // Get pasted data via clipboard API
            const text = (event.clipboardData || window.clipboardData).getData('text');
            document.execCommand('insertText', false, text);
        });
    }

    // Function to check and convert elements with contenteditable-type="plainTextOnly"
    static checkAndConvertPlainTextOnly(element) {
        if (element.getAttribute('contenteditable-type') === 'plainTextOnly') {
            if (isFirefox) {
                ContentEditableHelpers.convertToPlainText(element);
            } else {
                element.setAttribute('contenteditable', 'plaintext-only');
            }
        }
    }

    static onInput(event) {
        doScrollTick();
    }

    static checkForTab(event) {
        if (event.key !== "Tab") return;

        event.preventDefault();

        const tabCharacter = "\u00a0\u00a0\u00a0\u00a0";
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);

        // Create the text node and insert it
        const textNode = document.createTextNode(tabCharacter);
        range.insertNode(textNode);

        // Move the cursor immediately after the inserted tab
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges(); // Clear any selections
        selection.addRange(range); // Update the range
    }

    static textNeedsFixing(text) {
        return text === '\n';
    }

    static fixText(text) {
        return text === '\n' ? '' : text;
    }
}

ContentEditableHelpers.setupEventListeners();