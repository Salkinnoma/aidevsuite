let tooltipQuery = ".tooltipAnchor, [tooltip], [tooltip-url]";

const tooltipMethods = {
    cachedHtmlsByUrl: {},
    fetchPromisesByUrl: {},
    currentElement: null,
    keepTooltipsOpenKey: "q",
    setupTooltips(element = document) {
        let elementsWithTooltip = [...element.querySelectorAll(tooltipQuery)];
        for (let element of elementsWithTooltip) {
            element.addEventListener('mouseenter', e => this.onMouseenter(e));
            element.classList.add('tooltipTarget');
        }
    },
    updatePosition() {
        if (!tooltipMethods.currentElement) return;
        tooltipMethods.positionTooltipRelativeTo(tooltipMethods.currentElement);
    },
    minEdgeDistance: 6,
    positionTooltipRelativeTo(element) {
        let tooltipTop = 0;
        let tooltipLeft = 0;
        let elementRect = element.getBoundingClientRect();

        let tooltipRect = tooltip.getBoundingClientRect();
        let distance = 8;
        let position = 'top';
        let match = true;

        let elementXCenter = elementRect.left + elementRect.width / 2;
        let tooltipXLeftFromCenter = elementXCenter - tooltipRect.width / 2;
        let tooltipXRightFromCenter = elementXCenter + tooltipRect.width / 2;
        let elementYCenter = elementRect.top + elementRect.height / 2;
        let tooltipYTopFromCenter = elementYCenter - tooltipRect.height / 2;
        let tooltipYBottomFromCenter = elementYCenter + tooltipRect.height / 2;

        let yFitsTop = elementRect.top - tooltipRect.height - distance >= 0;
        let yFitsBottom = elementRect.bottom + tooltipRect.height + distance <= window.innerHeight;
        let xCenterFitsLeft = tooltipXLeftFromCenter >= 0;
        let xCenterFitsRight = tooltipXRightFromCenter <= window.innerWidth;
        let xCenterFits = xCenterFitsLeft && xCenterFitsRight;
        let xFitsLeft = elementRect.left - tooltipRect.width - distance >= 0;
        let xFitsRight = elementRect.right + tooltipRect.width + distance <= window.innerWidth;
        let yCenterFitsTop = tooltipYTopFromCenter >= 0;
        let yCenterFitsBottom = tooltipYBottomFromCenter <= window.innerHeight;
        let yCenterFits = yCenterFitsTop && yCenterFitsBottom;

        if (xCenterFits) {
            if (!yFitsTop) {
                if (yFitsBottom) {
                    position = 'bottom';
                } else if (yCenterFits) {
                    if (xFitsLeft) {
                        position = 'left';
                    } else if (xFitsRight) {
                        position = 'right';
                    }
                }
            }
        } else {
            match = false;
            if (!yFitsTop) {
                if (yFitsBottom) {
                    position = 'bottom';
                }
            }
        }

        tooltip.setAttribute('tooltip-position', position);

        if (match) {
            if (position === 'top') {
                tooltipTop = elementRect.top - tooltipRect.height - distance;
                tooltipLeft = tooltipXLeftFromCenter;
            } else if (position === 'bottom') {
                tooltipTop = elementRect.bottom + distance;
                tooltipLeft = tooltipXLeftFromCenter;
            } else if (position === 'left') {
                tooltipTop = tooltipYTopFromCenter;
                tooltipLeft = elementRect.left - tooltipRect.width - distance;
            } else if (position === 'right') {
                tooltipTop = tooltipYTopFromCenter;
                tooltipLeft = elementRect.right + distance;
            }

            tooltip.style.top = tooltipTop + 'px';
            tooltip.style.left = Math.max(tooltipLeft, this.minEdgeDistance) + 'px';
            tooltipStyle.innerHTML = "";
        } else {
            if (position === 'top') {
                tooltipTop = elementRect.top - tooltipRect.height - distance;
            } else if (position === 'bottom') {
                tooltipTop = elementRect.bottom + distance;
            }
            tooltip.style.top = tooltipTop + 'px';

            let currentLeft = this.minEdgeDistance;
            let newCenterIfLeft = this.minEdgeDistance + tooltipRect.width / 2;
            let newCenterIfRight = window.innerWidth - tooltipRect.width / 2;
            if (Math.abs(elementXCenter - newCenterIfLeft) > Math.abs(elementXCenter - newCenterIfRight)) {
                // Closer to right than left.
                currentLeft = window.innerWidth - this.minEdgeDistance - tooltipRect.width;
            }
            tooltip.style.left = currentLeft + 'px';
            let normalLeft = tooltipXLeftFromCenter;
            // (normal left - current left) / width + 50%
            let leftPercent = ((normalLeft - currentLeft) / tooltipRect.width) * 100 + 50;
            leftPercent = Math.max(10, Math.min(90, leftPercent));
            tooltipStyle.innerHTML = `#tooltip::after {
                left: ${leftPercent}% !important;
            }`;
        }
    },
    async onMouseenter(event) {
        if (isChildEvent(event)) return;

        let element = event.currentTarget;
        this.currentElement = element;
        let tooltipAttribute = element.getAttribute('tooltip');
        if (tooltipAttribute == null) {
            let url = element.getAttribute('tooltip-url');
            let alreadyLoading = false;
            if (url) {
                if (this.fetchPromisesByUrl[url]) {
                    alreadyLoading = true;
                } else {
                    if (!this.cachedHtmlsByUrl[url]) {
                        tooltip.innerHTML = "Loading...";
                    }
                    try {
                        const fetchPromise = fetch(url);
                        this.fetchPromisesByUrl[url] = fetchPromise;
                        const response = await fetchPromise;
                        this.cachedHtmlsByUrl[url] = await response.text();
                        tooltip.innerHTML = this.cachedHtmlsByUrl[url];
                    } catch (e) {
                        tooltip.innerHTML = "Error loading tooltip.";
                    }

                    delete this.fetchPromisesByUrl[url];
                }
            }


            if (!alreadyLoading) {
                tooltip.classList.remove('smallTooltip');
                tooltip.classList.add('cardTooltip');
            }
        } else {
            tooltip.innerHTML = tooltipAttribute;
            tooltip.classList.add('smallTooltip');
            tooltip.classList.remove('cardTooltip');
        }

        if (tooltipMethods.currentElement) {
            tooltip.classList.remove('hide');
            tooltipMethods.updatePosition();
        }
    },
    eventWithinDistance(event, element) {
        const buffer = 8; // Distance in pixels that is allowed
        const rect = element.getBoundingClientRect();

        // Get mouse position
        const mouseX = event.clientX;
        const mouseY = event.clientY;

        // Check if mouse is within `buffer` pixels of the element
        if (between(mouseY, rect.top - buffer, rect.bottom + buffer) &&
            between(mouseX, rect.left - buffer, rect.right + buffer)) {
            return true;
        }

        return false;
    },
    onMousemove(event) {
        let currentElement = tooltipMethods.currentElement;
        if (!currentElement) return;
        if (currentElement.contains(event.toElement) || currentElement == event.toElement) return;
        if (pressedKeys[tooltipMethods.keepTooltipsOpenKey]) return;
        //if (tooltip.contains(event.toElement) || tooltip == event.toElement) return;
        if (tooltipMethods.eventWithinDistance(event, currentElement)) return;

        tooltip.classList.add('hide');
        tooltipMethods.currentElement = null;
    },
}

let tooltip;
let tooltipStyle;
window.addEventListener('load', () => {
    tooltip = document.getElementById('tooltip');
    tooltipStyle = document.getElementById('tooltipStyle');
    tooltipMethods.setupTooltips();
});


document.addEventListener('scroll', tooltipMethods.updatePosition, true);
window.addEventListener('resize', tooltipMethods.updatePosition, true);
document.addEventListener('mousemove', tooltipMethods.onMousemove, true);