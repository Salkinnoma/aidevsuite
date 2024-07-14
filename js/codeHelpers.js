
class CodeHelpers {
    static createCodeElement(code, language) {
        const preContainer = fromHTML(`<div class="preContainer ">`);
        const languageClass = language != null ? 'language-' + escapeHTML(language) : null;

        const pre = fromHTML(`<pre>`);
        const codeElement = fromHTML(`<code>`);
        if (language != null) codeElement.classList.add(languageClass);
        codeElement.textContent = code;
        if (language != null) highlightCode(codeElement);


        // Code bar
        const codeBar = fromHTML(`<div class="codeBar listContainerHorizontal">`);
        const codeLanguage = fromHTML(`<div class="codeLanguage">`);
        codeLanguage.textContent = language ? CodeHelpers.extractLanguage(languageClass) : 'any';
        codeBar.appendChild(codeLanguage);
        const copyButton = fromHTML('<button tooltip="Copy Code" class="largeElement hoverable">');
        let copyTime = Date.now();
        copyButton.addEventListener('click', e => {
            copyToClipboard(codeElement.innerText);
            copyButton.setAttribute('tooltip', 'Copied!');
            copyTime = Date.now();
            const oldCopyTime = copyTime;
            window.setTimeout(function() {
                if (oldCopyTime == copyTime) copyButton.setAttribute('tooltip', 'Copy Code'); // Only update if it hasn't been modified in the meantime.
            }, seconds(3));
        });
        const copyIcon = icons.copy();
        //copyIcon.classList.add('code-copy-icon');
        copyButton.appendChild(copyIcon);
        codeBar.appendChild(copyButton);
        preContainer.appendChild(codeBar);

        pre.appendChild(codeElement);
        preContainer.appendChild(pre);

        return preContainer;
    }

    static findLanguageClass(codeElement) {
        return [...codeElement.classList].find(c => c.startsWith('language-'));
    }

    static extractLanguage(languageClass) {
        if (!languageClass) return null;

        const parts = languageClass.split('language-');
        return parts.length == 1 ? null : parts[1];
    }

    static _adjustPre(pre) {
        const code = pre.querySelector('code');
        const languageClass = CodeHelpers.findLanguageClass(code);
        const wrappedElement = CodeHelpers.createCodeElement(code.innerText, CodeHelpers.extractLanguage(languageClass));
        pre.replaceWith(wrappedElement);
    }

    static adjustCodeBlocks(element) {
        if (element.nodeType != Node.ELEMENT_NODE) return;

        const pres = (element.matches('pre')) ? [element] : [...element.querySelectorAll('pre')];
        for (let pre of pres) CodeHelpers._adjustPre(pre);
    }

}

function highlightCode(codeElement) {
    codeElement.removeAttribute('data-highlighted');
    codeElement.classList.remove('hljs');
    hljs.highlightElement(codeElement);
}