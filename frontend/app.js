// app.js

// Inkluderet systemprompt i samtalen
let conversation = [{
    role: 'system',
    content: `Du er SikkerGPT, en hjælpsom og vidende assistent, der besvarer spørgsmål på dansk.
        Du er designet til at hjælpe brugere på en sikker måde ved at beskytte personfølsomme oplysninger.
        Hvis en bruger spørger, hvorfor du hedder "SikkerGPT", eller hvordan systemet fungerer, skal du forklare,
        at du hjælper med at overholde GDPR ved at filtrere personfølsomme data, inden beskeder behandles. Når det er passende,
        skal du formatere dine svar ved hjælp af Markdown, herunder tabeller, kodeblokke og andre formateringsmuligheder.`
}];








function sendMessage() {
    const promptInput = document.getElementById('prompt');
    const prompt = promptInput.value.trim();
    const chatWindow = document.getElementById('chat-window');

    if (prompt === '') {
        return;
    }

    // Midlertidigt tilføj brugerens besked til UI for at vise den med det samme
    addMessageToChat('user', prompt);

    // Ryd inputfeltet
    promptInput.value = '';
    promptInput.focus();

    // Send samtalen uden at tilføje brugerens besked endnu
    const tempConversation = [...conversation, {
        role: 'user',
        content: prompt
    }];

    fetch('http://127.0.0.1:8000/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                conversation: tempConversation
            })
        })
        .then(async (response) => {
            if (!response.ok) {
                const errorData = await response.json();
                // Fjern brugerens besked fra UI, da den blev afvist
                removeLastMessageFromChat();
                addMessageToChat('error', errorData.error || 'Der opstod en fejl.');
                return;
            }

            // Tilføj brugerens besked til samtalehistorikken
            conversation.push({
                role: 'user',
                content: prompt
            });

            // Modtag og vis svaret fra SikkerGPT
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let done = false;
            let assistantMessage = '';

            (async function processChunks() {
                while (!done) {
                    const {
                        value,
                        done: doneReading
                    } = await reader.read();
                    done = doneReading;
                    const chunkValue = decoder.decode(value || new Uint8Array(), {
                        stream: !doneReading
                    });
                    assistantMessage += chunkValue;
                    addMessageChunkToChat('assistant', chunkValue);
                }

                // Tilføj assistentens svar til samtalehistorikken
                conversation.push({
                    role: 'assistant',
                    content: assistantMessage
                });
            })();
        })
        .catch((error) => {
            // Fjern brugerens besked fra UI, hvis der opstod en fejl
            removeLastMessageFromChat();
            addMessageToChat('error', 'Der opstod en netværksfejl.');
            console.error('Fejl:', error);
        });
}

// Funktion til at fjerne den sidste besked fra chatvinduet
function removeLastMessageFromChat() {
    const chatWindow = document.getElementById('chat-window');
    const lastMessage = chatWindow.lastElementChild;
    if (lastMessage) {
        chatWindow.removeChild(lastMessage);
    }
}

// Funktion til at tilføje en besked til chatvinduet
function addMessageToChat(role, content) {
    const chatWindow = document.getElementById('chat-window');
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', role);

    const contentElement = document.createElement('div');
    contentElement.classList.add('content');

    if (role === 'assistant') {
        // Konverter Markdown til HTML og sanitér det
        const html = marked.parse(content);
        contentElement.innerHTML = DOMPurify.sanitize(html);
    } else {
        contentElement.innerText = content;
    }

    messageElement.appendChild(contentElement);
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Funktion til at tilføje dele af en besked til chatvinduet (for streaming)
function addMessageChunkToChat(role, content) {
    const chatWindow = document.getElementById('chat-window');
    let lastMessage = chatWindow.lastElementChild;

    // Hvis den sidste besked ikke er fra assistenten, opret en ny
    if (!lastMessage || !lastMessage.classList.contains(role)) {
        lastMessage = document.createElement('div');
        lastMessage.classList.add('message', role);

        const contentElement = document.createElement('div');
        contentElement.classList.add('content');

        if (role === 'assistant') {
            // Start med tomt indhold
            contentElement.innerHTML = '';
            contentElement.dataset.rawContent = '';
        } else {
            contentElement.innerText = content;
        }

        lastMessage.appendChild(contentElement);
        chatWindow.appendChild(lastMessage);
    } else {
        // Tilføj til eksisterende besked
        const contentElement = lastMessage.querySelector('.content');
        if (role === 'assistant') {
            // Opdater indholdet med det nye Markdown-indhold
            const previousContent = contentElement.dataset.rawContent || '';
            const newContent = previousContent + content;
            contentElement.dataset.rawContent = newContent; // Gem råt indhold

            const html = marked.parse(newContent);
            contentElement.innerHTML = DOMPurify.sanitize(html);
        } else {
            contentElement.innerText += content;
        }
    }

    chatWindow.scrollTop = chatWindow.scrollHeight;
}


// Funktion til at tilføje dele af en besked til chatvinduet (for streaming)
function addMessageChunkToChat(role, content) {
    const chatWindow = document.getElementById('chat-window');
    let lastMessage = chatWindow.lastElementChild;

    // Hvis den sidste besked ikke er fra assistenten, opret en ny
    if (!lastMessage || !lastMessage.classList.contains(role)) {
        lastMessage = document.createElement('div');
        lastMessage.classList.add('message', role);

        const contentElement = document.createElement('div');
        contentElement.classList.add('content');

        if (role === 'assistant') {
            // Initialiser med det første indhold
            contentElement.dataset.rawContent = content; // Gem råt indhold
            const html = marked.parse(content);
            contentElement.innerHTML = DOMPurify.sanitize(html);
        } else {
            contentElement.innerText = content;
        }

        lastMessage.appendChild(contentElement);
        chatWindow.appendChild(lastMessage);
    } else {
        // Tilføj til eksisterende besked
        const contentElement = lastMessage.querySelector('.content');
        if (role === 'assistant') {
            // Opdater indholdet med det nye Markdown-indhold
            const previousContent = contentElement.dataset.rawContent || '';
            const newContent = previousContent + content;
            contentElement.dataset.rawContent = newContent; // Gem råt indhold

            const html = marked.parse(newContent);
            contentElement.innerHTML = DOMPurify.sanitize(html);
        } else {
            contentElement.innerText += content;
        }
    }

    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Håndtering af 'Info'-knappen og modal
document.getElementById('info-btn').addEventListener('click', function () {
    document.getElementById('info-modal').style.display = 'block';
});

document.querySelector('.close').addEventListener('click', function () {
    document.getElementById('info-modal').style.display = 'none';
});

window.addEventListener('click', function (event) {
    const modal = document.getElementById('info-modal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
});

// Function to auto-expand the textarea
function autoExpandTextarea(element) {
    element.style.height = 'auto'; // Reset the height
    element.style.height = (element.scrollHeight) + 'px'; // Set the height to scrollHeight
}

// Add event listener to the textarea
const promptInput = document.getElementById('prompt');
promptInput.addEventListener('input', function() {
    autoExpandTextarea(this);
});

document.getElementById('send-btn').addEventListener('click', sendMessage);
promptInput.addEventListener('keypress', function(e) {
    // Hvis Enter trykkes uden Shift eller Ctrl, send besked
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault(); // Forhindrer linjeskift
        sendMessage(); // Sender beskeden
    }
    // Hvis Shift + Enter eller Ctrl + Enter trykkes, lav linjeskift
});