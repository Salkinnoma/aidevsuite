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

function addLocalPage(name, link, code) {
    localPages.set(link, {name, link, code});
    saveLocalPages();
}

function suggestNameForPageLink(link) {
    return escapeFileNameMinimal(link);
}

function updateLocalPage(page) {
    localPages.set(page.link, page);
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
    const link = getPathFromHash();
    if (hash == '' || hash == '#' || hash == '#home') {
        removeHash();
        newPage = getHomePage();
    } else if (link == 'flow') {
        newPage = getFlowPage();
    } else if (link == 'help') {
        newPage = getHelpPage();
    } else if (localPages.has(link)) {
        newPage = getFlowPage(localPages.get(link).code);
    } else {
        window.open('#');
        return;
    }

    if (!Array.isArray(newPage)) newPage = [newPage];
    page.replaceChildren(...newPage);

    localPages.values().forEach(
        p => document.getElementById('topSidebarList').appendChild(fromHTML(`<a class="element sidebarElement hoverable" href="#${p.link}">${p.name}</a>`)));
    updateSidebar();

    window.dispatchEvent(pageLoadedEvent);
}

function getHomePage() {
    const grid = fromHTML(`<div class="listHorizontal">`);
    const pages = localPages.values();
    for (let page of pages) {
        const pageElement = fromHTML(`<a class="largeElement raised">`);
        pageElement.setAttribute('href', '#' + page.link);
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