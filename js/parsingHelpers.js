class ParsingHelpers {
    static extractCode(markdown, codeBlocksOnly = true, concatenate = true) {
        let amount = 0;
        let isCodeBlock = false;
        let isIndentedCode = false;
        let codes = [];
        let codeStart = 0;
        for (let i = 0; i < markdown.length; i++) {
            if (markdown[i] === "\`") {
                amount++;
            } else {
                if (amount === 3) {
                    if (isCodeBlock) {
                        codes.push(markdown.substring(codeStart, i - 2));
                        isCodeBlock = false;
                    } else if (isIndentedCode) {
                        continue;
                    } else {
                        let cutOff = false;
                        while (markdown[i] !== "\n") {
                            i++;
                            if (i === markdown.length || i + 1 === markdown.length) {
                                cutOff = true;
                                break;
                            }
                        }
                        if (cutOff) break;
                        codeStart = i + 1;
                        isCodeBlock = true;
                    }
                } else if (amount === 1) {
                    if (isIndentedCode) {
                        if (!codeBlocksOnly) codes.push(markdown.substring(codeStart, i));
                        isIndentedCode = false;
                    } else if (isCodeBlock) {
                        continue;
                    } else {
                        if (i + 1 === markdown.length) break;
                        codeStart = i + 1;
                        isIndentedCode = true;
                    }
                }
                amount = 0;
            }
        }

        if (isCodeBlock) {
            codes.push(markdown.substring(codeStart, markdown.length - amount));
        } else if (isIndentedCode) {
            if (!codeBlocksOnly) codes.push(markdown.substring(codeStart, markdown.length - amount));
        }

        if (concatenate) codes = codes.join('\n');

        return codes;
    }
}

function sanitizeHtml(html) {
    return DOMPurify.sanitize(html);
}