const securityId = "aidevsuite";

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

    updateLocalPagesSidebar();
}

function addLocalPage(name, link, code) {
    if (link.trim() == '') {
        Flow.updateDefaultCode(code);
        return;
    }

    localPages.set(link, {name, link, code, securityId});
    saveLocalPages();
}

function updateLocalPage(page) {
    localPages.set(page.link, page);
    saveLocalPages();
}

function deleteLocalPage(link) {
    localPages.delete(link);
    saveLocalPages();
}

async function fetchExternalPage(url) {
    const response = await fetch(url);
    const data = await response.json();
    if (data.securityId !== securityId) throw new Error('Security check failed.');
    
    return data;
}

function suggestNameForPageLink(link) {
    return escapeFileNameMinimal(link);
}


function moveLocalPage(page, newLink) {
    addLocalPage(page.name, newLink, page.code, page.prompt);
    deleteLocalPage(page.link);
    saveLocalPages();
}

function getValidHashUrls(){
    return [...defaultPages, ...localPages.keys()];
}

function updateLocalPagesSidebar() {
    const localPagesList = document.getElementById('localPagesList')
    localPagesList.innerHTML = '';
    localPages.values().forEach(p => localPagesList.appendChild(fromHTML(`<a class="element sidebarElement hoverable" href="#${p.link}">${p.name}</a>`)));
    if (localPages.size == 0) localPagesList.classList.add('hide');
    else localPagesList.classList.remove('hide');
}

// Function to handle hash changes
function loadPage() {
    const hash = getHashUrl();
    loadLocalPages();

    const page = document.getElementById('pages');

    // Show the section corresponding to the hash
    let newPage;
    console.log("Page loaded:", hash);
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
        openPage();
        return;
    }

    if (!Array.isArray(newPage)) newPage = [newPage];
    page.replaceChildren(...newPage);

    updateLocalPagesSidebar();
    updateSidebar();

    window.dispatchEvent(pageLoadedEvent);
}

function openPage(page = null) {
    window.location.href = page == null ? '#' : '#' + page;
}

function getHomePage() {
    const grid = fromHTML(`<div class="listHorizontal">`);
    const pages = localPages.values();
    for (let page of pages) {
        const pageElement = fromHTML(`<a class="giantElement raised xl-font">`);
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