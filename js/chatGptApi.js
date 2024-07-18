class ChatGptApi {
    static systemRole = "system";
    static userRole = "user";
    static assistantRole = "assistant";

    static toMessage(role, content) {
        return { role, content };
    }

    static toSystemMessage(prompt) {
        return ChatGptApi.toMessage(ChatGptApi.systemRole, prompt);
    }

    static toUserMessage(prompt) {
        return ChatGptApi.toMessage(ChatGptApi.userRole, prompt);
    }

    static toAssistantMessage(prompt) {
        return ChatGptApi.toMessage(ChatGptApi.assistantRole, prompt);
    }

    static toImageMessage(prompt, url) {
        return ChatGptApi.toMessage(ChatGptApi.userRole, [
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

    static gpt4OmniName = "GPT-4 Omni";
    static gpt4OmniMiniName = "GPT-4 Omni Mini";
    static gpt4TurboName = "GPT-4 Turbo";
    static gpt4Name = "GPT-4";
    static gpt3_5TurboName = "GPT-3.5 Turbo";

    static gpt4OmniIdentifier = "gpt-4o";
    static gpt4OmniMiniIdentifier = "gpt-4o-mini";
    static gpt4TurboIdentifier = "gpt-4-turbo";
    static gpt4Identifier = "gpt-4";
    static gpt3_5TurboIdentifier = "gpt-3.5-turbo";

    static defaultModel = ChatGptApi.gpt4OmniIdentifier;

    static gptModelNamesByIdentifier = {
        [ChatGptApi.gpt4OmniIdentifier]: ChatGptApi.gpt4OmniName,
        [ChatGptApi.gpt4OmniMiniIdentifier]: ChatGptApi.gpt4OmniMiniName,
        [ChatGptApi.gpt4TurboIdentifier]: ChatGptApi.gpt4TurboName,
        [ChatGptApi.gpt4Identifier]: ChatGptApi.gpt4Name,
        [ChatGptApi.gpt3_5TurboIdentifier]: ChatGptApi.gpt3_5TurboName
    }

    static gptModels = new Set(Object.keys(ChatGptApi.gptModelNamesByIdentifier));

    static gptModelsThatAllowImages = new Set([
        ChatGptApi.gpt4OmniIdentifier,
        ChatGptApi.gpt4OmniMiniIdentifier,
        ChatGptApi.gpt4TurboIdentifier
    ]);

    static getModelName(gptModel) {
        let model = ChatGptApi.gptModelNamesByIdentifier.get(gptModel) ?? ChatGptApi.gptModelNamesByIdentifier.get(ChatGptApi.defaultModel);
        return model;
    }

    /**
     * options:
     * gptModel = ChatGptApi.defaultModel, seed = null, apiKey = null, continueAfterMaxTokens = true, maxTokens = 4096
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
            response = await ChatGptApi._internalGetChatResponse(messages, options);
            result += response.response;
            messagesCopy.push(ChatGptApi.toAssistantMessage(response.response));
        } while (options.continueAfterMaxTokens && response.finish_reason == 'length');

        return result;
    }

    static async _internalGetChatResponse(messages, options = null) {
        options ??= {};
        const model = options.gptModel ?? ChatGptApi.defaultModel;
        const apiKey = options.apiKey ?? settings.openAIApiKey;
        if (!apiKey) throw new Error('Required OpenAI Api Key was missing.');

        const messagesCopy = [...messages];

        let body = {
            model: model,
            max_tokens: options.maxTokens ?? 4096,
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
                json = await fetch('https://api.openai.com/v1/chat/completions', {
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
            console.warn('ChatGptApi.getChatResponse ERROR Try Again', retries, errorMessage);
            lastError = errorMessage;

            if (retries < maxRetries) {
                await sleep((retries + 1 + Math.random()) * 1000);
            } else throw lastError;
        }
    }
    /**
     * options:
     * gptModel = ChatGptApi.defaultModel, seed = null, apiKey = null, maxTokens = 4096
     */
    static async getChatStream(messages, options = null) {
        options ??= {};
        const model = options.gptModel ?? ChatGptApi.defaultModel;
        const apiKey = options.apiKey ?? settings.openAIApiKey;
        if (!apiKey) throw new Error('Required OpenAI Api Key was missing.');

        const messagesCopy = [...messages];

        let body = {
            model: model,
            max_tokens: options.maxTokens ?? 4096,
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
                response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            console.warn('ChatGptApi.getChatResponse ERROR Try Again', retries, errorMessage);
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
     * gptModel = ChatGptApi.defaultModel, seed = null, apiKey = null, stopStream = false, continueAfterMaxTokens = true, maxTokens = 4096
     * 
     * Returns the full response string.
     */
    static async streamChat(messages, onUpdate, options) {
        options ??= {};
        options.continueAfterMaxTokens ??= true;
        console.log("Chat Model:", options.model ?? ChatGptApi.defaultModel);

        const messagesCopy = [...messages];
        let response;
        let result = '';
        do {
            response = await ChatGptApi._internalStreamChat(messagesCopy, onUpdate, options);
            result = response.response;
            messagesCopy.push(ChatGptApi.toAssistantMessage(response.response));
        } while (options.continueAfterMaxTokens && response.finish_reason == 'length');

        return result;
    }

    static async _internalStreamChat(messages, onUpdate, options, previousResponse = null) {
        options ??= {};
        const streamOptions = { gptModel: options.gptModel, seed: options.seed, apiKey: options.apiKey };
        let reader = await ChatGptApi.getChatStream(messages, streamOptions);

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
                    reader = await ChatGptApi.getChatStream(messages, streamOptions);
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
