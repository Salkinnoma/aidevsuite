class ChatApi {
    static systemRole = "system";
    static userRole = "user";
    static assistantRole = "assistant";

    static toMessage(role, content) {
        return { role, content };
    }

    static toSystemMessage(prompt) {
        return ChatApi.toMessage(ChatApi.systemRole, prompt);
    }

    static toUserMessage(prompt) {
        return ChatApi.toMessage(ChatApi.userRole, prompt);
    }

    static toAssistantMessage(prompt) {
        return ChatApi.toMessage(ChatApi.assistantRole, prompt);
    }

    static toImageMessage(prompt, url) {
        return ChatApi.toMessage(ChatApi.userRole, [
            {
                "type": "text",
                "text": prompt
            },
            {
                "type": "image_url",
                "image_url": {
                    "url": url
                },
            },
        ]);
    }

    static logMessage(message) {
        console.log(message.role + ":", message.content);
    }

    static gptEndpoint = "https://api.openai.com/v1/chat/completions";
    static groqEndpoint = "https://api.groq.com/openai/v1/chat/completions";

    static gpt4OmniName = "GPT-4 Omni";
    static gpt4OmniMiniName = "GPT-4 Omni Mini";
    static gpt4TurboName = "GPT-4 Turbo";
    static gpt4Name = "GPT-4";
    static gpt3_5TurboName = "GPT-3.5 Turbo";
    static llama3_1_405bName = "Llama 3.1 405b";
    static llama3_1_70bName = "Llama 3.1 70b";
    static llama3_1_8bName = "Llama 3.1 8b";

    static gpt4OmniIdentifier = "gpt-4o";
    static gpt4OmniMiniIdentifier = "gpt-4o-mini";
    static gpt4TurboIdentifier = "gpt-4-turbo";
    static gpt4Identifier = "gpt-4";
    static gpt3_5TurboIdentifier = "gpt-3.5-turbo";
    static llama3_1_405bIdentifier = "llama-3.1-405b-reasoning";
    static llama3_1_70bIdentifier = "llama-3.1-70b-versatile";
    static llama3_1_8bIdentifier = "llama-3.1-8b-instant";

    static defaultGptModel = ChatApi.gpt4OmniIdentifier;
    static defaultGroqModel = ChatApi.llama3_1_70bIdentifier;

    static chatModelNames = {
        [ChatApi.gpt4OmniIdentifier]: ChatApi.gpt4OmniName,
        [ChatApi.gpt4OmniMiniIdentifier]: ChatApi.gpt4OmniMiniName,
        [ChatApi.gpt4TurboIdentifier]: ChatApi.gpt4TurboName,
        [ChatApi.gpt4Identifier]: ChatApi.gpt4Name,
        [ChatApi.gpt3_5TurboIdentifier]: ChatApi.gpt3_5TurboName,
        //[ChatApi.llama3_1_405bIdentifier]: ChatApi.llama3_1_405bName, // Disabled
        [ChatApi.llama3_1_70bIdentifier]: ChatApi.llama3_1_70bName,
        [ChatApi.llama3_1_8bIdentifier]: ChatApi.llama3_1_8bName,
    }

    static chatModels = new Set(Object.keys(ChatApi.chatModelNames));

    static chatModelsThatAllowImages = new Set([
        ChatApi.gpt4OmniIdentifier,
        ChatApi.gpt4OmniMiniIdentifier,
        ChatApi.gpt4TurboIdentifier
    ]);

    static gptModels = new Set([
        ChatApi.gpt4OmniIdentifier,
        ChatApi.gpt4OmniMiniIdentifier,
        ChatApi.gpt4TurboIdentifier,
        ChatApi.gpt4Identifier,
        ChatApi.gpt3_5TurboIdentifier,
    ]);

    static groqModels = new Set([
        //ChatApi.llama3_1_405bIdentifier, // Disabled
        ChatApi.llama3_1_70bIdentifier,
        ChatApi.llama3_1_8bIdentifier,
    ]);

    static getModelName(model) {
        return ChatApi.chatModelNames.get(model) ?? ChatApi.chatModelNames.get(ChatApi.getDefaultModel());
    }

    static getDefaultModel() {
        if (settings.openAIApiKey) return ChatApi.defaultGptModel;
        else if (settings.groqApiKey) return ChatApi.defaultGroqModel;
    }

    static getApiKeyForModelFromSettings(model) {
        if (ChatApi.gptModels.has(model)) return settings.openAIApiKey;
        else if (ChatApi.groqModels.has(model)) return settings.groqApiKey;
    }

    static getEndpoint(model) {
        if (ChatApi.gptModels.has(model)) return ChatApi.gptEndpoint;
        else if (ChatApi.groqModels.has(model)) return ChatApi.groqEndpoint;
    }

    static getMaxTokens(model) {
        if (ChatApi.groqModels.has(model)) return 8000;
        else return 4096;
    }

    /**
     * options:
     * model = null, seed = null, apiKey = null, continueAfterMaxTokens = true, maxTokens = null
     * 
     * Returns the full response string.
     */
    static async chat(messages, options = null) {
        options ??= {};
        options.continueAfterMaxTokens ??= true;

        const messagesCopy = [...messages];
        let response;
        let result = '';
        do {
            response = await ChatApi._internalGetChatResponse(messages, options);
            result += response.response;
            messagesCopy.push(ChatApi.toAssistantMessage(response.response));
        } while (options.continueAfterMaxTokens && response.finish_reason == 'length');

        return result;
    }

    static async _internalGetChatResponse(messages, options = null) {
        options ??= {};
        const model = options.model ?? ChatApi.getDefaultModel();
        const apiKey = options.apiKey ?? ChatApi.getApiKeyForModelFromSettings(model);
        if (!apiKey) throw new Error('Required OpenAI Api Key was missing.');
        const endpoint = ChatApi.getEndpoint(model);
        if (!endpoint) throw new Error('Chat model is not supported.');

        const messagesCopy = [...messages];

        let body = {
            model: model,
            max_tokens: options.maxTokens ?? ChatApi.getMaxTokens(model),
            messages: messagesCopy,
        };
        if (options.seed != null) {
            body.seed = options.seed;
        }

        let retries = 0;
        let maxRetries = 10;
        let lastError = null;
        while (true) {
            retries++;

            let json = null;
            let error = "";
            try {
                json = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + apiKey
                    },
                    body: JSON.stringify(body)
                }).then(response => response.json());
            }
            catch (e) {
                error = e.message;
                if (error === "Failed to fetch") {
                    retries -= 1;
                }
            }

            console.log("GPT Model used:", model);
            if (json && json['choices'] && json['choices'].length > 0) {
                console.log('Request:', messagesCopy);
                console.log('Response:', json);
                console.log('Response content:', json['choices'][0]['message']['content']);
                if (openAiSeed) {
                    console.log('Seed:', openAiSeed, 'Fingerprint:', json.system_fingerprint);
                }
                return { response: json['choices'][0]['message'], finish_reason: json.finish_reason };
            }

            console.log("Json response:", json);
            console.log("Error message:", error);
            if (json?.error?.code && json.error.code === "rate_limit_exceeded") {
                retries -= 0.9;
            }
            let errorMessage = error.length > 0 ? error : json?.error?.code;
            console.warn('ChatApi.getChatResponse ERROR Try Again', retries, errorMessage);
            lastError = errorMessage;

            if (retries < maxRetries) {
                await sleep((retries + 1 + Math.random()) * 1000);
            } else throw lastError;
        }
    }
    /**
     * options:
     * model = null, seed = null, apiKey = null, maxTokens = null
     */
    static async getChatStream(messages, options = null) {
        options ??= {};
        const model = options.model ?? ChatApi.getDefaultModel();
        const apiKey = options.apiKey ?? ChatApi.getApiKeyForModelFromSettings(model);
        if (!apiKey) throw new Error('Required OpenAI Api Key was missing.');
        const endpoint = ChatApi.getEndpoint(model);
        if (!endpoint) throw new Error('Chat model is not supported.');

        const messagesCopy = [...messages];

        let body = {
            model: model,
            max_tokens: options.maxTokens ?? ChatApi.getMaxTokens(model),
            messages: messagesCopy,
            stream: true
        };
        if (options.seed != null) {
            body.seed = options.seed;
        }

        let retries = 0;
        let maxRetries = 10;
        let lastError = null;
        while (true) {
            retries++;

            let response = null;
            let error = "";
            try {
                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + apiKey
                    },
                    body: JSON.stringify(body)
                });
            }
            catch (e) {
                error = e.message;
                if (error === "Failed to fetch") {
                    retries -= 1;
                }
            }

            if (response?.ok) {
                const reader = response.body?.getReader();
                if (reader) return reader;

                error = "Error: fail to read data from response";
                console.error(error);
            } else {
                console.error(`Error: ${response?.statusText}`);
            }


            let errorMessage = error.length > 0 ? error : response?.statusText;
            console.warn('ChatApi.getChatResponse ERROR Try Again', retries, errorMessage);
            lastError = errorMessage;

            if (retries < maxRetries) {
                await sleep((retries + 1 + Math.random()) * 1000);
            } else throw lastError;
        }
    }

    /**
     * Fetches and reads a stream. The onUpdate parameter is a function that is called whenever the stream updates. This function has a string parameter of the updated full response string.
     * 
     * options:
     * model = null, seed = null, apiKey = null, stopStream = false, continueAfterMaxTokens = true, maxTokens = null
     * 
     * Returns the full response string.
     */
    static async streamChat(messages, onUpdate, options) {
        options ??= {};
        options.continueAfterMaxTokens ??= true;
        console.log("Chat Model:", options.model ?? ChatApi.getDefaultModel());

        const messagesCopy = [...messages];
        let response;
        let result = '';
        do {
            response = await ChatApi._internalStreamChat(messagesCopy, onUpdate, options);
            result = response.response;
            messagesCopy.push(ChatApi.toAssistantMessage(response.response));
        } while (options.continueAfterMaxTokens && response.finish_reason == 'length');

        return result;
    }

    static async _internalStreamChat(messages, onUpdate, options, previousResponse = null) {
        options ??= {};
        const streamOptions = { model: options.model, seed: options.seed, apiKey: options.apiKey };
        let reader = await ChatApi.getChatStream(messages, streamOptions);

        let fullResponse = previousResponse ?? '';
        const textDecoder = new TextDecoder("utf-8");
        let buffer = "";
        let finish_reason = '';
        while (true) {
            if (options.stopStream) {
                options.stopStream = false;
                break;
            }

            let value, done;
            try {
                ({ value, done } = await reader.read());
            } catch (e) {
                console.log("Error reading stream:", e.message);
                if (e.message === "network error") {
                    await sleep((1 + Math.random()) * 1000);
                    reader = await ChatApi.getChatStream(messages, streamOptions);
                    fullResponse = previousResponse ?? '';
                    onUpdate('');
                    continue;
                } else {
                    break;
                }
            }
            if (done) break;
            const chunk = textDecoder.decode(value);

            for (const line of chunk.split("\n")) {
                if (options.stopStream) {
                    break;
                }

                const trimmedLine = line.trimStart();
                if (!trimmedLine || trimmedLine.startsWith("data: [DONE]")) {
                    continue;
                }

                const json = trimmedLine.replace("data: ", "");
                try {
                    let obj;
                    if (buffer === "") {
                        obj = JSON.parse(json);
                    } else {
                        try {
                            obj = JSON.parse(json);
                            if (!obj.choices) throw new Error();
                            console.warn("Failed resolving chunk split error. Skipped data:", buffer);
                        } catch (e) {
                            let fullData = buffer + json;
                            if (fullData.startsWith('data: ')) fullData = fullData.replace("data: ", "");
                            obj = JSON.parse(fullData);
                            //console.log("Successfully resolved chunk split error. Full data:", fullData);
                        }
                        buffer = "";
                    }

                    const content = obj.choices?.[0]?.delta?.content?.toString() ?? "";
                    finish_reason = obj.finish_reason;

                    fullResponse = fullResponse.concat(content);
                    try {
                        onUpdate(fullResponse);
                    } catch (e) { }
                } catch (e) {
                    if (e.message.includes("JSON") && json != null) {
                        buffer += json;
                        //console.log("Chunk split error:", e.message, "For stream:", json);
                    } else {
                        console.warn("Error decoding stream:", e.message, "For stream:", json);
                    }

                    if (buffer.length > 1000000) {
                        options.stopStream = true;
                        console.warn("Buffer grew too large:", e.message);
                    }
                }
            }
        }

        console.log('Request:', messages);
        console.log('Response:', fullResponse);
        return { response: fullResponse, finish_reason };
    }
}
