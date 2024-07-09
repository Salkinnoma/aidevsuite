class ChatGptApi {
    static ToSystemMessage(prompt){
        let message = {
            "role": "system",
            "content": prompt
        };

        return message;
    }

    static ToUserMessage(prompt){
        let message = {
            "role": "user",
            "content": prompt
        };

        return message;
    }

    static ToAssistantMessage(prompt){
        let message = {
            "role": "assistant",
            "content": prompt
        };

        return message;
    }

    static ToImageMessage(prompt, url){
        let message = {
            "role": "user",
            "content": [
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
            ],
        };

        return message;
    }

    static logMessage(message){
        console.log(message.role + ":", message.content);
    }

    static gpt4OmniName = "GPT-4 Omni";
    static gpt4TurboName = "GPT-4 Turbo";
    static gpt4Name = "GPT-4";
    static gpt3_5TurboName = "GPT-3.5 Turbo";

    static gpt4OmniIdentifier = "gpt-4o";
    static gpt4TurboIdentifier = "gpt-4-turbo";
    static gpt4Identifier = "gpt-4";
    static gpt3_5TurboIdentifier = "gpt-3.5-turbo";

    static defaultModel = ChatGptApi.gpt4OmniIdentifier;

    static gptModelNamesByIdentifier = {
        [ChatGptApi.gpt4OmniIdentifier]: ChatGptApi.gpt4OmniName,
        [ChatGptApi.gpt4TurboIdentifier]: ChatGptApi.gpt4TurboName,
        [ChatGptApi.gpt4Identifier]: ChatGptApi.gpt4Name,
        [ChatGptApi.gpt3_5TurboIdentifier]: ChatGptApi.gpt3_5TurboName
    }

    static gptModels = new Set(Object.keys(ChatGptApi.gptModelNamesByIdentifier));

    static gptModelsThatAllowImages = new Set([
        ChatGptApi.gpt4OmniIdentifier,
        ChatGptApi.gpt4TurboIdentifier
    ]);

    static getModelName(gptModel){
        let model = ChatGptApi.gptModelNamesByIdentifier.get(gptModel) ?? ChatGptApi.gptModelNamesByIdentifier.get(ChatGptApi.defaultModel);
        return model;
    }

    static setLocalApiKey(apiKey) {
        return localStorage.setItem('openAIApiKey', apiKey);
    }

    static getLocalApiKey() {
        return localStorage.getItem('openAIApiKey');
    }

    /**
     * options:
     * gptModel = ChatGptApi.defaultModel, seed = null, apiKey = null
     */
    static async getChatResponse(messages, options = null) {
        options ??= {};
        const model = options.gptModel ?? ChatGptApi.defaultModel;
        const apiKey = options.apiKey ?? ChatGptApi.getLocalApiKey();
        if (!apiKey) throw new Error('Required OpenAI Api Key was missing.');

        const messagesCopy = [...messages];

        let body = {
            model: model,
            max_tokens: 4096,
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
            if(json && json['choices'] && json['choices'].length > 0) {
                console.log('Request:', messagesCopy);
                console.log('Response:', json);
                console.log('Response content:', json['choices'][0]['message']['content']);
                if (openAiSeed) {
                    console.log('Seed:', openAiSeed, 'Fingerprint:', json.system_fingerprint);
                }
                return json['choices'][0]['message'];
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
                await sleep((retries + 1 + Math.random())*1000);
            } else throw lastError;
        }
    }

    /**
     * options:
     * gptModel = ChatGptApi.defaultModel, seed = null, apiKey = null
     */
    static async getChatStream(messages, options = null) {
        options ??= {};
        const model = options.gptModel ?? ChatGptApi.defaultModel;
        const apiKey = options.apiKey ?? ChatGptApi.getLocalApiKey();
        if (!apiKey) throw new Error('Required OpenAI Api Key was missing.');

        const messagesCopy = [...messages];

        let body = {
            model: model,
            max_tokens: 4096,
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
                await sleep((retries + 1 + Math.random())*1000);
            } else throw lastError;
        }
    }

    /**
     * Fetches and reads a stream.
     * 
     * options:
     * gptModel = ChatGptApi.defaultModel, applyToText = t => t, seed = null, apiKey = null, stopStream = false
     * 
     * Note: Keep the options object, so you can later set stopStream to true to stop the stream as soon as possible.
     */
    static async streamChat(messages, onUpdate, options) {
        options ??= {};
        const streamOptions = {gptModel: options.gptModel, seed: options.seed, apiKey: options.apiKey};
        let reader = await ChatGptApi.getChatStream(messages, streamOptions);

        let fullResponse = '';
        const textDecoder = new TextDecoder("utf-8");
        let buffer = "";
        while (true) {
            if (options.stopStream) {
                options.stopStream = false;
                break;
            }

            let value, done;
            try{
                ( { value, done } = await reader.read());
            } catch (e) {
                console.log("Error reading stream:", e.message);
                if (e.message === "network error") {
                    await sleep((1 + Math.random())*1000);
                    reader = await ChatGptApi.getChatStream(messages, streamOptions);
                    fullResponse = '';
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
               try{
                   let obj;
                   if (buffer === "") {
                       obj = JSON.parse(json);
                   } else {
                       try {
                           obj = JSON.parse(json);
                           console.warn("Failed resolving chunk split error. Skipped data:", buffer);
                       } catch (e) {
                           const fullData = buffer + json;
                           obj = JSON.parse(fullData);
                           console.log("Successfully resolved chunk split error. Full data:", fullData);
                       }
                       buffer = "";
                   }

                   const content = obj.choices?.[0]?.delta?.content?.toString() ?? "";

                   fullResponse = fullResponse.concat(content);
                   onUpdate(fullResponse);
               } catch (e) {
                   if (e.message.includes("JSON") && json != null) {
                       buffer += json;
                       console.log("Chunk split error:", e.message, "For stream:", json);
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
        return fullResponse;
    }
}
