let scrolledBottomLastFrame = false;
let userHasScrolled = false;
let autoScrollBotom = true;

function getScrollingElement() {
    return document.getElementById('scrollingElement');
}

function isScrolledBottom() {
    let scrollingElement = getScrollingElement();
    return Math.abs(scrollingElement.scrollHeight - scrollingElement.scrollTop - scrollingElement.clientHeight) <= 3.0;
}

function scrollToBottom() {
    let scrollingElement = getScrollingElement();
    scrollingElement.scroll({top: scrollingElement.scrollHeight});
}

function isScrolledTop() {
    let scrollingElement = getScrollingElement();
    return scrollingElement.scrollTop === 0;
}

function scrollToTop() {
    let scrollingElement = getScrollingElement();
    scrollingElement.scroll({top: 0});
}

getScrollingElement().addEventListener('scroll', () => {
    userHasScrolled = true;
});

async function doScrollTick(){
    if (isScrolledBottom()) {
        scrolledBottomLastFrame = true;
    } else if (userHasScrolled) {
        scrolledBottomLastFrame = false;
    } else if (autoScrollBotom && scrolledBottomLastFrame) {
        scrollToBottom();
    }

    userHasScrolled = false;

    await sleep(10);
}

// Check scroll periodically
(async function() {
    while (true) {
        await doScrollTick();
    }
})();

class ScrollHelpers {
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
        ScrollHelpers.injectScrollTopButton();
        ScrollHelpers.injectScrollBottomButton();
    }
}

ScrollHelpers.injectScrollButtons();