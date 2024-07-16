const securityId = "aidevsuite_a1b2c3";

const defaultPages = new Set([
    '',
    'home',
    'flow',
    'extern',
    'worker',
    'help',
]);

const specialFlowPages = new Set([
    'flow',
    'extern',
]);

let localPages = new Map();
let linkedPages = new Map();

const samples = ['data/Fetch.json', 'data/Simple Chat.json', 'data/Chat.json'];

const pageLoadedEvent = new CustomEvent("pageloaded");
function loadLocalPages() {
    const localPagesJSON = localStorage.getItem('pages');
    if (localPagesJSON) {
        localPages = new Map(Object.entries(JSON.parse(localPagesJSON)));
        for (let page of localPages.values()) {
            page.id ??= generateUniqueId();
            page.securityId = securityId;
        }

        return localPages;
    }
    return localPages = new Map();
}

function saveLocalPages() {
    const localPagesObj = {};
    for (let entry of localPages.entries()) localPagesObj[entry[0]] = entry[1];
    localStorage.setItem('pages', JSON.stringify(localPagesObj));

    updatePagesSidebar();
}

function addLocalPage(name, link, code, options = null) {
    if (defaultPages.has(link)) return;

    options ??= {};
    if (link.trim() == '') {
        Flow.updateDefaultCode(code);
        return;
    }

    // Just to be extra sure check for collisions
    const ids = new Set();
    localPages.values().forEach(p => ids.add(p.id));
    let id;
    do {
        id = generateUniqueId();
    } while (ids.has(id));

    localPages.set(link, {
        securityId, id, name, link, code,
        prompt: options.prompt,
        autoRun: options.autoRun,
    });
    saveLocalPages();
}

function updateLocalPage(page) {
    if (defaultPages.has(page.link)) return;

    localPages.set(page.link, page);
    saveLocalPages();
}

function deleteLocalPage(page) {
    if (defaultPages.has(page.link)) return;

    localPages.delete(page.link);

    const scriptStorage = JSON.parse(localStorage.getItem('scriptStorage'));
    delete scriptStorage[id];
    localStorage.setItem('scriptStorage', JSON.stringify(scriptStorage));

    saveLocalPages();
}

function moveLocalPage(page, newLink) {
    addLocalPage(page.name, newLink, page.code, page);
    deleteLocalPage(page);
    saveLocalPages();
}

async function fetchExternalPage(url) {
    const localIdentifier = '#local/';
    if (url.startsWith(localIdentifier)) {
        const page = localPages.get(url.split(localIdentifier)[1].split('?')[0]);
        return { code: page.code };
    }

    const data = await fetchJson(url);
    if (data.securityId !== securityId) {
        console.log("Error Source:", url, data);
        throw new Error('Security check failed.')
    };

    return data;
}

function loadLinkedPages() {
    const linkedPagesJSON = localStorage.getItem('linkedPages');
    if (linkedPagesJSON) {
        linkedPages = new Map(Object.entries(JSON.parse(linkedPagesJSON)));
    } else linkedPages = new Map();

    const chatInjected = localStorage.getItem("chat_injected");
    if (!chatInjected) {
        const chatLink = "data/Chat.json";
        fetchExternalPage(chatLink).then(p => {
            addLinkedPage(p.name, chatLink);
            localStorage.setItem('chat_injected', true);
        });
    }

    return linkedPages;
}

function saveLinkedPages() {
    const linkedPagesObj = {};
    for (let entry of linkedPages.entries()) linkedPagesObj[entry[0]] = entry[1];
    localStorage.setItem('linkedPages', JSON.stringify(linkedPagesObj));

    updatePagesSidebar();
}

function addLinkedPage(name, url, options = null) {
    options ??= {};
    linkedPages.set(url, {
        name, link: url,
        autoRun: options.autoRun,
    });
    saveLinkedPages();
}

function updateLinkedPage(page) {
    linkedPages.set(page.link, page);
    saveLinkedPages();
}

function deleteLinkedPage(link) {
    linkedPages.delete(link);
    saveLinkedPages();
}

function suggestNameForPageLink(link) {
    return escapeFileNameMinimal(link);
}

function getValidHashUrls() {
    return [...defaultPages, ...localPages.keys()];
}

function updatePagesSidebar() {
    const name = getPathFromHash();
    const url = getHashQueryVariable('url');

    // Local pages
    const localPagesList = document.getElementById('localPagesList');
    localPagesList.innerHTML = '';
    localPages.values().forEach(p => {
        let link = '#local/' + p.link;
        if (p.autoRun) link += '?mode=run';

        const element = fromHTML(`<a class="element sidebarElement hoverable">`);
        element.textContent = p.name;
        element.setAttribute('href', link);
        if (p.link == name) {
            element.setAttribute('title', "You are here. F5 to reload.");
            element.setAttribute('disabled', '');
        }

        localPagesList.appendChild(element)
    });
    if (localPages.size == 0) localPagesList.classList.add('hide');
    else localPagesList.classList.remove('hide');

    // Linked pages
    const linkedPagesList = document.getElementById('linkedPagesList');
    linkedPagesList.innerHTML = '';
    linkedPages.values().forEach(p => {
        let link = '#extern?url=' + p.link;
        if (p.autoRun) link += '&mode=run';

        const element = fromHTML(`<a class="element sidebarElement hoverable">`);
        element.textContent = p.name;
        element.setAttribute('href', link);
        if (p.link == getHashQueryVariable('url')) {
            element.setAttribute('title', "You are here. F5 to reload.");
            element.setAttribute('disabled', '');
        }

        linkedPagesList.appendChild(element)
    });
    if (linkedPages.size == 0) linkedPagesList.classList.add('hide');
    else linkedPagesList.classList.remove('hide');
}

// Function to handle hash changes
function loadPage() {
    const hash = getHashUrl();
    loadLocalPages();
    loadLinkedPages();
    const topPath = getPathPartFromHash(0);

    const page = document.getElementById('pages');

    // Show the section corresponding to the hash
    let newPage;
    console.log("Page loaded:", hash);
    const link = getPathFromHash();
    if (hash == '' || hash == '#' || hash == '#home') {
        removeHash();
        newPage = getHomePage();
    } else if (topPath == 'local' ||
        link == 'flow' ||
        link == 'extern') {
        newPage = getFlowPage();
    } else if (link == 'worker') {
        newPage = getWorkerPage();
    } else if (link == 'help') {
        newPage = getHelpPage();
    } else {
        openPage();
        return;
    }

    if (!Array.isArray(newPage)) newPage = [newPage];
    page.replaceChildren(...newPage);

    updatePagesSidebar();
    updateSidebar();

    window.dispatchEvent(pageLoadedEvent);
}

function openPage(page = null) {
    window.location.href = page == null ? '#' : '#' + page;
}

function getHomePage() {
    const container = fromHTML(`<div>`);

    // Local pages title bar
    const titleBar = fromHTML(`<div class="listContainerHorizontal">`);
    const title = fromHTML(`<h1>Local Scripts`);
    titleBar.appendChild(title);
    const rightTitleList = fromHTML(`<div class="listHorizontal">`);
    const createButton = fromHTML(`<button class="complexButton largeElement">Start Creating`);
    createButton.addEventListener('click', e => openPage('flow'));
    rightTitleList.appendChild(createButton);
    titleBar.appendChild(rightTitleList);
    container.appendChild(titleBar);

    // Local pages grid
    const grid = fromHTML(`<div class="listHorizontal">`);
    const pages = localPages.values();
    for (let page of pages) {
        const pageElement = fromHTML(`<a class="giantElement raised xl-font">`);
        pageElement.setAttribute('href', '#' + page.link);
        pageElement.textContent = page.name;
        grid.appendChild(pageElement);
    }
    container.appendChild(grid);
    container.appendChild(hb(4));

    // Linked pages title bar
    const linkedTitleBar = fromHTML(`<div class="listContainerHorizontal">`);
    const linkedTitle = fromHTML(`<h1>Linked Scripts`);
    linkedTitleBar.appendChild(linkedTitle);
    container.appendChild(linkedTitleBar);

    // Linked pages grid
    const linkedGrid = fromHTML(`<div class="listHorizontal">`);
    const linkedValues = linkedPages.values();
    for (let page of linkedValues) {
        const pageElement = fromHTML(`<a class="giantElement raised xl-font">`);
        pageElement.setAttribute('href', '#extern?url=' + page.link);
        pageElement.textContent = page.name;
        linkedGrid.appendChild(pageElement);
    }
    if (linkedPages.size == 0) container.appendChild(fromHTML(`<div>No scripts linked yet.`));
    else container.appendChild(linkedGrid);
    container.appendChild(hb(4));

    // Samples pages title bar
    const samplesTitleBar = fromHTML(`<div class="listContainerHorizontal">`);
    const samplesTitle = fromHTML(`<h1>Sample Scripts`);
    samplesTitleBar.appendChild(samplesTitle);
    container.appendChild(samplesTitleBar);

    // Sample pages grid
    const samplesGrid = fromHTML(`<div class="listHorizontal">`);
    for (let link of samples) {
        fetchExternalPage(link).then(page => {
            const pageElement = fromHTML(`<a class="giantElement raised xl-font">`);
            pageElement.setAttribute('href', '#extern?url=' + link);
            pageElement.textContent = page.name;
            samplesGrid.appendChild(pageElement);
        });
    }
    container.appendChild(samplesGrid);

    return container;
}

class WorkerPage {
    static workerEditor = null;
}
function getWorkerPage() {
    const element = fromHTML(`<div>`);
    const title = fromHTML(`<h1>Worker Script`);
    element.appendChild(title);
    const paragraph = fromHTML(`<div>This script is where all of your code is executed.`);
    element.appendChild(paragraph);
    element.appendChild(hb(4));
    Flow.clearMonacoContext();
    const codeResult = CodeHelpers.createCodeEditor({
        placeholder: "Loading...",
        readOnly: true,
        language: 'javascript',
        showMinimap: true,
    });
    codeResult.codeEditorPromise.then(e => WorkerPage.workerEditor = e);
    element.appendChild(codeResult.codeEditorContainer);
    Flow.getWorkerScript().then(async code => {
        const editor = await codeResult.codeEditorPromise;
        editor.setValue(code);
        editor.update();
    });
    return element;
}

function getHelpPage() {
    return 'This is very helpful help.';
}

// Listen for hashchange events
window.addEventListener('hashchange', loadPage);
window.addEventListener('load', loadPage);