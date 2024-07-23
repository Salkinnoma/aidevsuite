
class Settings {
    static _initialSettings = JSON.parse(localStorage.getItem('settings')) || {};

    static _settingsHandler = {
        set(settings, property, value) {
            settings[property] = value;
            localStorage.setItem('settings', JSON.stringify(settings));
            window.settings = settings;
            return true;
        }
    };

    static element = null;
    static pagesElement = null;

    static chatbotPage = 'chatbot';

    static checkHasApiKey() {
        if (ChatApi.getDefaultModel()) {
            Flow.rewriteScriptButton?.removeAttribute('disabled');
            Flow.generateScriptButton?.removeAttribute('disabled');
        } else {
            Flow.rewriteScriptButton?.setAttribute('disabled', '');
            Flow.generateScriptButton?.setAttribute('disabled', '');
        }
    }

    static getChatbotPage() {
        const chatbotPage = fromHTML(`<div class="hide">`);
        chatbotPage.setAttribute('settings-page', Settings.chatbotPage);

        // Disable AI
        const disableAISetting = fromHTML(`<div tooltip="Disables all AI functionality." class="listHorizontal">`);
        const disableAILabel = fromHTML(`<div>Disable AI`);
        disableAISetting.appendChild(disableAILabel);
        const disableAIElement = fromHTML(`<input type="checkbox">`);
        disableAIElement.checked = settings.disableAI;
        disableAIElement.addEventListener('input', async e => {
            settings.disableAI = disableAIElement.checked;
            Flow.refreshMonacoContext();
            WorkerPage.workerEditor?.setValue(await Flow.getWorkerScript());
            if (settings.disableAI) Flow.promptEditorContainerElement?.classList.add('hide');
            else Flow.promptEditorContainerElement?.classList.remove('hide');
        });
        disableAISetting.appendChild(disableAIElement);
        chatbotPage.appendChild(disableAISetting);

        // OpenAI Api key
        const openAIApiKeySetting = fromHTML(`<div class="listHorizontal">`);
        const openAIApiKeyLabel = fromHTML(`<div>OpenAI Api Key`);
        openAIApiKeySetting.appendChild(openAIApiKeyLabel);
        const openAIApiKeyElement = fromHTML(`<input type="password" placeholder="Enter api key...">`);
        openAIApiKeyElement.value = settings.openAIApiKey;
        openAIApiKeyElement.addEventListener('input', e => {
            settings.openAIApiKey = openAIApiKeyElement.value;
            Settings.checkHasApiKey();
        });
        openAIApiKeySetting.appendChild(openAIApiKeyElement);
        chatbotPage.appendChild(openAIApiKeySetting);

        // Groq Api key
        const groqApiKeySetting = fromHTML(`<div class="listHorizontal">`);
        const groqApiKeyLabel = fromHTML(`<div>Groq Api Key`);
        groqApiKeySetting.appendChild(groqApiKeyLabel);
        const groqApiKeyElement = fromHTML(`<input type="password" placeholder="Enter api key...">`);
        groqApiKeyElement.value = settings.groqApiKey;
        groqApiKeyElement.addEventListener('input', e => {
            settings.groqApiKey = groqApiKeyElement.value;
            Settings.checkHasApiKey();
        });
        groqApiKeySetting.appendChild(groqApiKeyElement);
        chatbotPage.appendChild(groqApiKeySetting);

        // // Anthropic Api key
        // const anthropicApiKeySetting = fromHTML(`<div class="listHorizontal">`);
        // const anthropicApiKeyLabel = fromHTML(`<div>Anthropic Api Key`);
        // anthropicApiKeySetting.appendChild(anthropicApiKeyLabel);
        // const anthropicApiKeyElement = fromHTML(`<input type="password" placeholder="Enter api key...">`);
        // anthropicApiKeyElement.value = settings.anthropicApiKey;
        // anthropicApiKeyElement.addEventListener('input', e => {
        //     settings.anthropicApiKey = anthropicApiKeyElement.value;
        //     Settings.checkHasApiKey();
        // });
        // anthropicApiKeySetting.appendChild(anthropicApiKeyElement);
        // chatbotPage.appendChild(anthropicApiKeySetting);

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

// Create a proxy for the settings object
const settings = new Proxy(Settings._initialSettings, Settings._settingsHandler);
window.settings = settings;