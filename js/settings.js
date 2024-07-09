
class Settings {
    static element = null;
    static pagesElement = null;

    static chatbotPage = 'chatbot';

    static getChatbotPage() {
        const chatbotPage = fromHTML(`<div class="hide">`);
        chatbotPage.setAttribute('settings-page', Settings.chatbotPage);
        const apiKeySetting = fromHTML(`<div class="listHorizontal">`);
        const apiKeyLabel = fromHTML(`<div>OpenAI Api Key`);
        apiKeySetting.appendChild(apiKeyLabel);
        const apiKeyElement = fromHTML(`<input type="password" placeholder="Enter api key...">`);
        apiKeyElement.value = localStorage.getItem('openAIApiKey')
        apiKeyElement.addEventListener('input', e => localStorage.setItem('openAIApiKey', apiKeyElement.value));
        apiKeySetting.appendChild(apiKeyElement);
        chatbotPage.appendChild(apiKeySetting);
        return chatbotPage;
    }

    static changePage(page) {
        [...Settings.pagesElement.children].forEach(e => e.getAttribute('settings-page') == page ? e.classList.remove('hide') : e.classList.add('hide'));
    }

    static open(page = null) {
        page ??= Settings.chatbotPage;
        Settings.close();
    
        const dialogsContainer = document.getElementById('dialogs');
        const dialogElement = fromHTML(`<div class="dialog">`);
        const contentElement = fromHTML(`<div class="dialogContent">`);
    
        const element = fromHTML(`<div class="dialogInnerContent largeElement bordered grounded">`);
        const titleBar = fromHTML(`<div class="listContainerHorizontal">`);
        titleBar.appendChild(fromHTML(`<h1>Settings`));
        const closeButton = fromHTML(`<button class="h-100">`);
        closeButton.setAttribute('tooltip', 'Settings are saved automatically even before closing.');
        closeButton.appendChild(icons.close());
        closeButton.addEventListener('click', e => Settings.close());
        titleBar.appendChild(closeButton);
        element.appendChild(titleBar);
        element.appendChild(hb(2));
        const pageBar = fromHTML(`<div class="listHorizontal">`);
        const chatbotPageButton = fromHTML(`<button class="largeElement complexButton raised">`);
        chatbotPageButton.textContent = 'chatbot';
        pageBar.appendChild(chatbotPageButton);
        element.appendChild(pageBar);
        element.appendChild(hb(6));
        const pagesElement = fromHTML(`<div>`);
    
        // Settings pages
        pagesElement.appendChild(Settings.getChatbotPage());
    
        element.appendChild(pagesElement);
        Settings.pagesElement = pagesElement;
        element.appendChild(hb(6));
    
        contentElement.appendChild(element);
        dialogElement.appendChild(contentElement);
        const overlayElement = fromHTML(`<div class="dialogOverlay">`);
        overlayElement.addEventListener('click', e => Settings.close());
        dialogElement.appendChild(overlayElement);
        dialogsContainer.appendChild(dialogElement);
    
        Settings.element = dialogElement;
        
        Settings.changePage(page);
    }
    
    static close() {
        if (Settings.element) Settings.element.remove();
    }
}
