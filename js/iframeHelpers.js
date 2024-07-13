
// Doesn't work because sandbox iframe is treated as different origin.
function waitForIframeToLoad(iframe) {
    return new Promise((resolve, reject) => {
        const checkIframeLoaded = () => {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

            // Check if loading is complete
            if (iframeDoc.readyState === 'complete') {
                iframe.contentWindow.onload = () => {
                    console.log("Iframe content is loaded");  // You can use alert instead if needed
                };
                // iframe loading is complete, resolve the promise
                resolve();
            } else {
                // If it's not loaded yet, set a timeout to check the status again in 100 milliseconds
                window.setTimeout(checkIframeLoaded, 100);
            }
        };

        // Start checking the status
        checkIframeLoaded();
    });
}