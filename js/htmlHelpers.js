class HtmlHelpers {

    static createBar(htmlElement, rawTextElement, bottom = false) {
        // Code bar
        const codeBar = fromHTML(`<div class="${bottom ? 'htmlBottomBar' : 'htmlTopBar'} listContainerHorizontal">`);
        const codeLanguage = fromHTML(`<div class="codeLanguage">`);
        codeLanguage.textContent = bottom ? 'end of html' : 'html';
        codeBar.appendChild(codeLanguage);

        const rightList = fromHTML(`<div class="listHorizontal">`);
        const isText = htmlElement.classList.contains('hide');
        const toggle = fromHTML(`<button tooltip="${isText ? 'Preview Html' : 'Show Raw Text'}" class="largeElement hoverable">`);
        const toggleIcon = icons.retry();
        toggle.addEventListener('click', e => {
            const wasText = htmlElement.classList.contains('hide');
            if (wasText) {
                htmlElement.classList.remove('hide');
                rawTextElement.classList.add('hide');
                toggle.setAttribute('tooltip', 'Show Raw Text');
            }
            else {
                htmlElement.classList.add('hide');
                rawTextElement.classList.remove('hide');
                toggle.setAttribute('tooltip', 'Preview Html');
            }
        });
        toggle.appendChild(toggleIcon);
        rightList.appendChild(toggle);
        const copyButton = fromHTML('<button tooltip="Copy Html" class="largeElement hoverable">');
        let copyTime = Date.now();
        copyButton.addEventListener('click', e => {
            copyToClipboard(rawTextElement.innerText);
            copyButton.setAttribute('tooltip', 'Copied!');
            copyTime = Date.now();
            const oldCopyTime = copyTime;
            window.setTimeout(function () {
                if (oldCopyTime == copyTime) copyButton.setAttribute('tooltip', 'Copy Html'); // Only update if it hasn't been modified in the meantime.
            }, seconds(3));
        });
        const copyIcon = icons.copy();
        copyButton.appendChild(copyIcon);
        rightList.appendChild(copyButton);
        codeBar.appendChild(rightList);

        return codeBar;
    }
}