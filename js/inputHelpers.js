class InputHelpers {
    static fixNumberInput(element) {
        let newValue = parseInt(element.value);
        if (isNaN(newValue)) newValue = 0;
        if (element.value !== newValue) element.value = newValue;
        return newValue;
    }

    static replaceTextWithUndo(targetElement, newText) {
        targetElement.focus();

        // Get the current selection
        const selection = window.getSelection();
        selection.removeAllRanges();

        const range = document.createRange();
        range.selectNodeContents(targetElement);
        selection.addRange(range);

        document.execCommand('insertText', false, newText);
    }
}