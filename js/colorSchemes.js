

const getOSColorScheme = function () {
    return window?.matchMedia?.('(prefers-color-scheme:dark)')?.matches ? darkColorScheme : lightColorScheme;
}

const lightColorScheme = "light";
const darkColorScheme = "dark";
const defaultColorScheme = lightColorScheme;
let osColorScheme = getOSColorScheme();
const storedColorScheme = localStorage.getItem('color-scheme');
const storedOSColorScheme = localStorage.getItem('os-color-scheme');
let adaptToOS = localStorage.getItem('adapt-color-scheme-to-os') ?? false;
let colorScheme = storedColorScheme ?? (adaptToOS ? osColorScheme : null) ?? defaultColorScheme;
const colorSchemeEvent = new CustomEvent("color-scheme-changed");
let initializedColorScheme = false;

const switchToColorScheme = function (newScheme) {
    if (!initializedColorScheme) initializedColorScheme = true;
    else if (newScheme == colorScheme) return;

    localStorage.setItem('color-scheme', newScheme);
    colorScheme = newScheme;
    document.documentElement.setAttribute("color-scheme", newScheme);
    window.dispatchEvent(colorSchemeEvent);
}
switchToColorScheme(colorScheme);

let preColorSchemeStyleElement;
function applyColorBeforeLoad() {
    let css = "body { background: var(--background-color); }";
    if (colorScheme == lightColorScheme) {
        css += ".darkModeOnly { display: none!important; }";
    } else {
        css += ".lightModeOnly { display: none!important; }";
    }

    let head = document.head || document.getElementsByTagName('head')[0];
    let style = document.createElement('style');
    preColorSchemeStyleElement = style;
    head.appendChild(style);

    if (style.styleSheet) {
        style.styleSheet.cssText = css;
    } else {
        style.appendChild(document.createTextNode(css));
    }
}
applyColorBeforeLoad();
window.addEventListener('load', e => preColorSchemeStyleElement.remove());


const changeAdaptToOS = function (value) {
    adaptToOS = value;
    localStorage.setItem('adapt-color-scheme-to-os', value);
}
const onOSColorSchemeChange = function (scheme) {
    if (!adaptToOS) return;

    switchToColorScheme(scheme);
    localStorage.setItem('os-color-scheme', scheme);
}
if (storedOSColorScheme !== osColorScheme) onOSColorSchemeChange(osColorScheme);

window?.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => onOSColorSchemeChange(getOSColorScheme()));

// Utilities
function swapBetweenLightAndDark() {
    if (colorScheme === lightColorScheme) {
        switchToColorScheme(darkColorScheme);
    } else {
        switchToColorScheme(lightColorScheme);
    }
}

function lm() {
    switchToColorScheme(lightColorScheme);
}
function dm() {
    switchToColorScheme(darkColorScheme);
}


