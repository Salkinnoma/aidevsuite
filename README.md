# aidevsuite
Automatically and quickly create tools with by hand or with AI. Simple syntax allows quickly iterating through and creating highly specific tools for you or your clients without the need to go through the pain and effort of setting up **yet another website**.

Often enough, a small tool is all that is needed, but the effort of creating even the smallest of tools far exceeds the effort of just doing it manually. For example, what if you have 10 strings that are urls with a json encoded in a data property that contains a name property that you need to extract?

**That's where this tool comes in.**

_Prompt:_

i have a url with a json encoded in a data query parameter that contains a name property that you need to extract

_Result:_

```javascript
const urlInput = createInput(textInputType, {
    placeholder: "Enter the URL here..."
});
await show(urlInput, { noAccept: true });

const resultElement = createMarkdown("");
await show(resultElement);

async function extractName(url) {
    try {
        const urlObj = new URL(url);
        const data = urlObj.searchParams.get("data");

        if (!data) throw new Error("No data query parameter found.");

        const jsonData = JSON.parse(data);
        if (!jsonData.name) throw new Error("No name property found in the JSON data.");

        return jsonData.name;
    } catch (error) {
        return `Error: ${error.message}`;
    }
}

async function run() {
    const url = (await read(urlInput.id)).text;
    const name = await extractName(url);
    await update(resultElement.id, { markdown: `**Result:** ${name}` });
}

const button = createButton(createText(paragraphType, "Extract Name"), run);
const wrapper = createFloatRightWrapper(button);
await show(wrapper);

await forever();
```

_Test url:_ https://example.com/?data=%7B%22name%22%3A%22aidevsuite%22%2C%22value%22%3A%229999%22%7D

_Try it out:_ https://deadlyartist.github.io/aidevsuite/#flow


_**For devs that want to develop in the future.**_

## Goals

Welcome to **aidevsuite**! This project empowers developers to create and share simple JavaScript tools on demand. Most programs are about input/output, so this project takes that to heart and streamlines this as much as possible. For example, you can simply await any input, such as text, file upload, code, markdown and many more. Essentially, this is a tool to create tools.

## Getting Started

Follow these steps to get started with creating and customizing your own tools:

1. **Open the Website:**
   Navigate to https://deadlyartist.github.io/aidevsuite/.

2. **Enter API Key:**
   Enter at least one API key to enable AI integration. If you don't have one, head over to https://console.groq.com/keys to create one.

3. **Open the Simple Chat Sample:**
   Click on the "Simple Chat" sample to open it.

4. **Edit the Script:**
   - Click on the "star" icon.
   - Uncheck "Link to External Url" to enable editing.
   - Click "Save" to confirm changes.
   - Press "Play" to run the script.

5. **Interact with AI:**
   Ask the AI something to ensure it is working correctly.

6. **Modify the Script:**
   - Click "edit" to open the script editor.
   - Try adding a delete button with a close icon to the right of each message. This button should remove the message both visually and from the context.

7. **Explore More Features:**
   For advanced functionalities such as saving (exclusive to local scripts), exporting, and importing the current chat, check out the "Chat" sample. Experiment to your heart's content to create your ultimate chatbot.

8. **Share Your Chatbot:**
    - Download the script
    - Either send the file to others so they can import it, or branch the repo (see the "Branch It!" section further below) and add the file into the data folder before deploying it via GitHub Pages.
    - If you chose to deploy, others can access it by pasting [your github pages website name]/data/[your file name] into the "Extern" page and pressing "Load Script".

## Samples

This project is currently deployed using GitHub Pages to https://deadlyartist.github.io/aidevsuite/. Check out the samples to see how everything works, or browse the repo. The project is still in very early stages, so there are still a lot of bugs and no documentation.

## Branch It!

This tool is primarily targeted towards devs. As it is serverless and written in vanilla js without any dependencies or build steps, you can easily branch this on github and one click setup github pages ([just like this repo](https://deadlyartist.github.io/aidevsuite/)), or throw them into just about any web project, **whether public or private**. 

Then you can export your favorite scripts, throw them into the project, and voila, everyone with the link can access the script.

## AI Integration

A very simple and straightforward input/ouput syntax even for complex inputs allows AI to effortlessly write your tools. AI is tightly integrated into the core, allowing you to quickly generate or rewrite tools.

This uses chatbots like OpenAI ChatGPT or Llama using groq.com (Claude doesn't work due to cors) and requires API keys to work. If you don’t like AI or don’t have an API key, you can simply disable it in the settings. However, it seems as though groq.com currently (23.07.2024) allows [creating API keys for free](https://console.groq.com/keys).

## Safe Execution

Code is run in a worker from a sandboxed iframe, allowing secure execution of arbitrary code. Both the worker and the iframe are recreated for every code execution.

For security, please do not enter sensitive data into scripts that rely on external code.

## License

I have not yet settled on a license.

## Author

Deadly Artist