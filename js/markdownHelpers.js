
class MarkdownHelpers {
    static escapeMarkdownChars = {
        '\\': '\\\\',
        '`': '\\`',
        '*': '\\*',
        '_': '\\_',
        '{': '\\{',
        '}': '\\}',
        '[': '\\[',
        ']': '\\]',
        '(': '\\(',
        ')': '\\)',
        '#': '\\#',
        '+': '\\+',
        '-': '\\-',
        '.': '\\.',
        '!': '\\!'
    };

    static escapeMarkdownRegex = new RegExp(`${Object.keys(MarkdownHelpers.escapeMarkdownChars).map(k => escapeRegex(k)).join('|')}`, 'g');

    static adjustMarkedOuput(...elements) {
        for (let element of elements) {
            if (!element.nodeType == Node.ELEMENT_NODE) return;
            const tag = element.tagName?.toLowerCase();
            CodeHelpers.adjustCodeBlocks(element);
            if (tag == 'table') element.classList.add('tableBordered');
        }
    }
}

function escapeMarkdown(text) {
    return text.replace(MarkdownHelpers.escapeMarkdownRegex, (match) => MarkdownHelpers.escapeMarkdownChars[match]);
}

/**
 * the `options` parameter can have the following properties:
 *   - **katex** (bool) [optional]: Whether to render katex. Default is `true`.
 *   - **sanitize** (bool) [optional]: Whether to sanitize the markdown html. Defaults is `false`.
 */
function renderMarkdown(element, markdown, options = null) {
    options ??= {};
    options.katex ??= true;

    if (options.katex) markdown = KatexHelpers.escapeMathFromMarkdown(markdown);
    let html = marked.parse(markdown);
    if (options.sanitize) html = sanitizeHtml(html);
    const children = fromHTML(html, false);
    MarkdownHelpers.adjustMarkedOuput(...children);
    for (let child of children) {
        if (options.katex) renderMathInElement(child);
    }
    element.replaceChildren(...children);
    element.classList.add('markdown');
}