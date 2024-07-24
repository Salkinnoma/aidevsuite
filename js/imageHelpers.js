class ImageHelpers {
    static setupEventListeners() {
        document.querySelectorAll('img').forEach(observeImage);

        // Use MutationObserver to monitor the DOM for added images
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.tagName === 'IMG') {
                        ImageHelpers.observeImage(node);
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check for images within this element (in case images are nested)
                        const images = node.querySelectorAll('img');
                        images.forEach(ImageHelpers.observeImage);
                    }
                });
            });
        });

        // Observe the document body for changes
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Function to observe added images
    static observeImage(image) {
        image.addEventListener('load', ImageHelpers.handleImageLoad);
    }

    static handleImageLoad() {
        doScrollTick();
    }
}

window.addEventListener('load', e => ImageHelpers.setupEventListeners());