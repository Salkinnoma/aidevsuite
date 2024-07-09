

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

class ColorSchemeHelpers {
    // Observer functions
    static setupEventListeners() {
        const observer = new MutationObserver(mutationsList => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => ColorSchemeHelpers.processAddedNode(node));
                } else if (mutation.type === 'attributes' && (mutation.attributeName === 'class')) {
                    const target = mutation.target;
                    const oldClasses = (mutation.oldValue ?? '').split(/\s+/);
                    const newClasses = target.className.split(/\s+/);
                    const addedClasses = newClasses.filter(cls => !oldClasses.includes(cls));
                    const removedClasses = oldClasses.filter(cls => !newClasses.includes(cls));
                    const relevantClasses = [...addedClasses, ...removedClasses].filter(cls => cls.startsWith('light-only-') || cls.startsWith('dark-only-'));

                    if (relevantClasses.length > 0) {
                        ColorSchemeHelpers.updateClassesBasedOnColorScheme(target);
                    }
                }
            }
        });
        
        observer.observe(document.body, { childList: true, attributes: true, subtree: true,  attributeOldValue : true });
        
        // Event listener for color scheme changes
        window.addEventListener('color-scheme-changed', () => {
            document.querySelectorAll('[class*="light-only-"], [class*="dark-only-"]').forEach(ColorSchemeHelpers.updateClassesBasedOnColorScheme);
        });
    }

    static updateClassesBasedOnColorScheme(element) {
        const lightOnlyClasses = [...element.classList].filter(cls => cls.startsWith('light-only-'));
        const darkOnlyClasses = [...element.classList].filter(cls => cls.startsWith('dark-only-'));

        if (colorScheme === lightColorScheme) {
            lightOnlyClasses.forEach(cls => element.classList.add(cls.replace('light-only-', '')));
            darkOnlyClasses.forEach(cls => element.classList.remove(cls.replace('dark-only-', '')));
        } else {
            lightOnlyClasses.forEach(cls => element.classList.remove(cls.replace('light-only-', '')));
            darkOnlyClasses.forEach(cls => element.classList.add(cls.replace('dark-only-', '')));
        }
    }

    static processAddedNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            ColorSchemeHelpers.updateClassesBasedOnColorScheme(node);
            node.querySelectorAll('*').forEach(child => ColorSchemeHelpers.updateClassesBasedOnColorScheme(child));
        }
    }
}

window.addEventListener('body-created', e => ColorSchemeHelpers.setupEventListeners());

