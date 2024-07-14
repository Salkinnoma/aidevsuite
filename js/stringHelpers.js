function getIndexBeyond(searchTerm, text, startIndex = 0) {
    // Find the next occurrence of the search term starting from startIndex
    const nextIndex = text.indexOf(searchTerm, startIndex);

    // If the searchTerm is not found, return null
    if (nextIndex === -1) {
        return null;
    }

    // Return the index just after the found searchTerm
    const newIndex = nextIndex + searchTerm.length;


    // If the new index is out of bounds, return null
    if (newIndex === searchTerm.length) {
        return null;
    }

    return nextIndex;
}

const _htmlStringHelpers = {
    escapeHtmlChars: {
        '¢' : 'cent',
        '£' : 'pound',
        '¥' : 'yen',
        '€': 'euro',
        '©' :'copy',
        '®' : 'reg',
        '<' : 'lt',
        '>' : 'gt',
        '"' : 'quot',
        '&' : 'amp',
        '\'' : '#39',
    },
    getEscapeHtmlRegex(){
        let escapeHtmlRegexString = '[';
        for(let key in _htmlStringHelpers.escapeHtmlChars) {
            escapeHtmlRegexString += key;
        }
        escapeHtmlRegexString += ']';
        const regex = new RegExp(escapeHtmlRegexString, 'g');
        return regex;
    },
    htmlEntities: {
        nbsp: ' ',
        cent: '¢',
        pound: '£',
        yen: '¥',
        euro: '€',
        copy: '©',
        reg: '®',
        lt: '<',
        gt: '>',
        quot: '"',
        amp: '&',
        apos: '\''
    },
};
_htmlStringHelpers.escapeHtmlRegex = _htmlStringHelpers.getEscapeHtmlRegex();

function escapeFileName(filename) {
    return filename.replace(/[^a-zA-Z0-9]/g, "_");
}
function escapeFileNameMinimal(col) {
    col = col.toLowerCase(); // Lowercase
    col = col.replace(/[^a-z0-9_]/g, '_'); // Replace non-alphanumeric characters with an underscore
    col = col.replace(/_+/g, '_'); // Replace multiple underscores with a single one
    col = col.replace(/_$/, ''); // Remove trailing underscore

    return col;
}
function escapeHTML(str) {
    return str.replace(_htmlStringHelpers.escapeHtmlRegex, function(m) {
        return '&' + _htmlStringHelpers.escapeHtmlChars[m] + ';';
    });
}
function unescapeHTML(str) {
    return str.replace(/\\&([^;]+);/g, function (entity, entityCode) {
        let match;

        if (entityCode in _htmlStringHelpers.htmlEntities) {
            return _htmlStringHelpers.htmlEntities[entityCode];
            /*eslint no-cond-assign: 0*/
        } else if (match = entityCode.match(/^#x([\\da-fA-F]+)$/)) {
            return String.fromCharCode(parseInt(match[1], 16));
            /*eslint no-cond-assign: 0*/
        } else if (match = entityCode.match(/^#(\\d+)$/)) {
            return String.fromCharCode(~~match[1]);
        } else {
            return entity;
        }
    });
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function escapeReplacement(string) {
    return string.replace(/\$/g, '$$$$');
}

function removeFirstChar(str){
    return str.substring(1);
}
function removeLastChar(str){
    return str.substring(0, str.length - 1);
}

function isString(str, orNull = false) {
    return (orNull && str == null) || typeof str === 'string' || str instanceof String;
}

function getStringByteSize(string) {
    string.length * 2;
}