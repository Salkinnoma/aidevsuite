class ScrollingHelpers {
    static scrolledBottomLastFrame = false;
    static userHasScrolled = false;
    static autoScrollBotom = true;
    static pageLoaded = true;

    static setupEventListeners() {
        // Use MutationObserver to monitor the DOM for added images
        const observer = new MutationObserver((mutations) => {
            doScrollTick();
        });

        // Observe the document body for changes
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    static injectScrollTopButton() {
        const scrollButtons = document.getElementById('scrollButtons');
        const topButton = fromHTML(`<button class="largeElement complexButton scrollButtonTop" title="Scroll to the top of the page">`);
        topButton.addEventListener('click', e => scrollToTop());
        topButton.appendChild(icons.expandLess());
        if (isScrolledTop()) topButton.classList.add('invisible');
        scrollButtons.appendChild(topButton);

        getScrollingElement().addEventListener('scroll', () => {
            if (isScrolledTop()) topButton.classList.add('invisible');
            else topButton.classList.remove('invisible');
        });
    }

    static injectScrollBottomButton() {
        const scrollButtons = document.getElementById('scrollButtons');
        const bottomButton = fromHTML(`<button class="largeElement complexButton scrollButtonBottom" title="Scroll to the bottom of the page">`);
        bottomButton.addEventListener('click', e => scrollToBottom());
        bottomButton.appendChild(icons.expandMore());
        if (isScrolledBottom()) bottomButton.classList.add('invisible');
        scrollButtons.appendChild(bottomButton);

        getScrollingElement().addEventListener('scroll', () => {
            if (isScrolledBottom()) bottomButton.classList.add('invisible');
            else bottomButton.classList.remove('invisible');
        });
    }

    static injectScrollButtons() {
        ScrollingHelpers.injectScrollTopButton();
        ScrollingHelpers.injectScrollBottomButton();
    }
}

function getScrollingElement() {
    return document.getElementById('scrollingElement');
}

function isScrolledBottom() {
    let scrollingElement = getScrollingElement();
    return Math.abs(scrollingElement.scrollHeight - scrollingElement.scrollTop - scrollingElement.clientHeight) <= 3.0;
}

function scrollToBottom() {
    let scrollingElement = getScrollingElement();
    scrollingElement.scroll({ top: scrollingElement.scrollHeight });
}

function isScrolledTop() {
    let scrollingElement = getScrollingElement();
    return scrollingElement.scrollTop === 0;
}

function scrollToTop() {
    let scrollingElement = getScrollingElement();
    scrollingElement.scroll({ top: 0 });
}

getScrollingElement().addEventListener('scroll', () => {
    ScrollingHelpers.userHasScrolled = true;
});

window.addEventListener('pageloaded', e => ScrollingHelpers.pageLoaded = true);

async function doScrollTick() {
    if (isScrolledBottom()) {
        ScrollingHelpers.scrolledBottomLastFrame = true;
    } else if (ScrollingHelpers.userHasScrolled || ScrollingHelpers.pageLoaded) {
        ScrollingHelpers.scrolledBottomLastFrame = false;
    } else if (ScrollingHelpers.autoScrollBotom && ScrollingHelpers.scrolledBottomLastFrame) {
        scrollToBottom();
    }

    ScrollingHelpers.userHasScrolled = false;
    ScrollingHelpers.pageLoaded = false;

    await sleep(10);
}

// Check scroll periodically
(async function () {
    while (true) {
        await doScrollTick();
    }
})();

ScrollingHelpers.injectScrollButtons();
window.addEventListener('load', e => ScrollingHelpers.setupEventListeners());