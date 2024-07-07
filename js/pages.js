const defaultPages = new Set([
    'home',
    'flow',
    'help',
]);

let localPages = new Map();

const pageLoadedEvent = new CustomEvent("pageloaded");
function loadLocalPages() {
    const localPagesJSON = localStorage.getItem('pages');
    if (localPagesJSON) {
        localPages = new Map(Object.entries(JSON.parse(localPagesJSON)));
        return localPages;
    }
    return new Map();
}

function saveLocalPages() {
    const localPagesObj = {};
    for (let entry of localPages.entries()) localPagesObj[entry[0]] = entry[1];
    localStorage.setItem('pages', JSON.stringify(localPagesObj));
}

function addLocalPage(name, code) {
    localPages.set(name, {name, code});
    saveLocalPages();
}

function updateLocalPage(page) {
    localPages.set(page.name, page);
    saveLocalPages();
}

function getValidHashUrls(){
    return [...defaultPages, ...localPages.keys()];
}

// Function to handle hash changes
function loadPage() {
    const hash = getHashUrl();
    loadLocalPages();

    const page = document.getElementById('pages');

    // Show the section corresponding to the hash
    let newPage;
    console.log(hash);
    const name = getPathFromHash();
    if (hash == '' || hash == '#' || hash == '#home') {
        removeHash();
        newPage = getHomePage();
    } else if (name == 'flow') {
        newPage = getFlowPage();
    } else if (name == 'help') {
        newPage = getHelpPage();
    } else if (localPages.has(name)) {
        newPage = getFlowPage(localPages.get(name).code);
    } else {
        window.open('#');
        return;
    }

    if (!Array.isArray(newPage)) newPage = [newPage];
    page.replaceChildren(...newPage);
    updateSidebar();

    window.dispatchEvent(pageLoadedEvent);
}

function getHomePage() {
    const grid = fromHTML(`<div class="listHorizontal">`);
    const pages = localPages.values();
    for (let page of pages) {
        const pageElement = fromHTML(`<a class="largeElement raised">`);
        pageElement.setAttribute('href', '#' + page.name);
        pageElement.textContent = page.name;
        grid.appendChild(pageElement);
    }
    return grid;
}

function getHelpPage() {
    return 'This is very helpful help.';
}

// Listen for hashchange events
window.addEventListener('hashchange', loadPage);
window.addEventListener('load', loadPage);