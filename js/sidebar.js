let preSidebarStyleElement;
function preSidebar() {
    var width = document.documentElement.clientWidth;

    let css;
    if (width <= 1878) {
        // Close
        css = '.sidebar { display: none!important; } .sidebarOpenOnly { display: none!important; } .sidebarControlsDisabledOnly { display: none!important; }';
    }
    else {
        // Open
        css = '.sidebarClosedOnly { display: none!important; } .sidebarControlsEnabledOnly { display: none!important; }';
    }
    console.log(css);
    let head = document.head || document.getElementsByTagName('head')[0];
    let style = document.createElement('style');
    preSidebarStyleElement = style;
    head.appendChild(style);

    if (style.styleSheet) {
        style.styleSheet.cssText = css;
    } else {
        style.appendChild(document.createTextNode(css));
    }
}
preSidebar();
window.addEventListener('load', e => preSidebarStyleElement.remove());

const sidebarOpenedEvent = new CustomEvent("sidebar-opened");
const sidebarClosedEvent = new CustomEvent("sidebar-closed");
const sidebarControlsEnabledEvent = new CustomEvent("sidebar-controls-enabled");
const sidebarControlsDisabledEvent = new CustomEvent("sidebar-controls-disabled");
let sidebarOpen = null;
let sidebarControlsEnabled = null;

function openSidebar() {
    if (sidebarOpen && sidebarOpen != null) return;

    sidebarOpen = true;
    let sidebars = document.getElementsByClassName("sidebar");
    for (let e of sidebars) {
        e.classList.remove("jsSidebarHide");
    }
    let sidebarOpenOnly = document.getElementsByClassName("sidebarOpenOnly");
    for (let e of sidebarOpenOnly) {
        e.classList.remove("jsSidebarHide");
    }
    let sidebarClosedOnly = document.getElementsByClassName("sidebarClosedOnly");
    for (let e of sidebarClosedOnly) {
        e.classList.add("jsSidebarHide");
    }
    window.dispatchEvent(sidebarOpenedEvent);
}

function closeSidebar() {
    if (!sidebarOpen && sidebarOpen != null) return;

    sidebarOpen = false;
    let sidebars = document.getElementsByClassName("sidebar");
    for (let e of sidebars) {
        e.classList.add("jsSidebarHide");
    }
    let sidebarOpenOnly = document.getElementsByClassName("sidebarOpenOnly");
    for (let e of sidebarOpenOnly) {
        e.classList.add("jsSidebarHide");
    }
    let sidebarClosedOnly = document.getElementsByClassName("sidebarClosedOnly");
    for (let e of sidebarClosedOnly) {
        e.classList.remove("jsSidebarHide");
    }
    window.dispatchEvent(sidebarClosedEvent);
}

function OnResize() {
    var width = document.documentElement.clientWidth;

    if (width <= 1878) {
        closeSidebar();
        if (!sidebarControlsEnabled || sidebarControlsEnabled == null) {
            sidebarControlsEnabled = true;
            let sidebarControlsEnabledOnly = document.getElementsByClassName("sidebarControlsEnabledOnly");
            for (let e of sidebarControlsEnabledOnly) {
                e.classList.remove("jsSidebarControlsHide");
            }
            let sidebarControlsDisabledOnly = document.getElementsByClassName("sidebarControlsDisabledOnly");
            for (let e of sidebarControlsDisabledOnly) {
                e.classList.add("jsSidebarControlsHide");
            }
            window.dispatchEvent(sidebarControlsEnabledEvent);
        }
    }
    else {
        openSidebar();
        if (sidebarControlsEnabled || sidebarControlsEnabled == null) {
            sidebarControlsEnabled = false;
            let sidebarControlsEnabledOnly = document.getElementsByClassName("sidebarControlsEnabledOnly");
            for (let e of sidebarControlsEnabledOnly) {
                e.classList.add("jsSidebarControlsHide");
            }
            let sidebarControlsDisabledOnly = document.getElementsByClassName("sidebarControlsDisabledOnly");
            for (let e of sidebarControlsDisabledOnly) {
                e.classList.remove("jsSidebarControlsHide");
            }
            window.dispatchEvent(sidebarControlsDisabledEvent);
        }
    }
}

window.addEventListener("load", () => OnResize());
window.addEventListener("resize", () => OnResize());