
pressedKeys = {};
function onKeyDown(event) {
    pressedKeys[event.key] = true;
}
function onKeyUp(event) {
    delete pressedKeys[event.key];
}
document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

async function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateUniqueId() {
    return Date.now() + Math.random().toString(36).substring(2, 9) + Math.random().toString(36).substring(2, 9);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}


function isChildEvent(event) {
    return event.currentTarget.contains(event.fromElement) || event.currentTarget === event.fromElement;
}

function isChildLeaveEvent(event) {
    return event.currentTarget.contains(event.toElement) || event.currentTarget === event.toElement;
}

function clone(obj){
    return JSON.parse(JSON.stringify(obj));
}

function equalSets(set1, set2) {
    return set1.size === set2.size &&
        [...set1].every((x) => set2.has(x));
}

// Defaults to max length
function setCookie(name, value, days = null) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    } else {
        const daysToExpire = new Date(2147483647 * 1000).toUTCString();
        expires = "; expires=" + daysToExpire;
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function jsonEquals(obj1, obj2){
    return JSON.stringify(obj1) === JSON.stringify(obj2);
}

/**
 * @param {String} HTML representing a single element.
 * @param {Boolean} flag representing whether or not to trim input whitespace, defaults to true.
 * @return {Element | HTMLCollection | null}
 */
function fromHTML(html, trim = false) {
    // Process the HTML string.
    html = trim ? html.trim() : html;
    if (!html) return null;
  
    // Then set up a new template element.
    const template = document.createElement('template');
    template.innerHTML = html;
    const result = template.content.children;
  
    // Then return either an HTMLElement or HTMLCollection,
    // based on whether the input HTML had one or more roots.
    if (result.length === 1) return result[0];
    return result;
  }