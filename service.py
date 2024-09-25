# service.py

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import aiohttp
import json
import asyncio
import ollama
from concurrent.futures import ThreadPoolExecutor

app = FastAPI()

# Tillad CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://192.168.1.66:5500"],  # Juster til din frontends adresse
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

executor = ThreadPoolExecutor()

@app.get("/")
async def read_root():
    return {"message": "SikkerGPT backend kører korrekt."}

@app.post("/api/chat")
async def chat(request: Request):
    data = await request.json()
    conversation = data.get('conversation')

    if not conversation or not isinstance(conversation, list):
        return JSONResponse({"error": "Ingen samtale modtaget."}, status_code=400)

    # Filtrer samtalen for at fjerne afviste brugerbeskeder
    filtered_conversation = []
    for message in conversation:
        if message.get('role') == 'user':
            is_sensitive = await asyncio.get_event_loop().run_in_executor(
                executor, check_with_ollama, message.get('content'))
            if is_sensitive:
                # Hvis det er den aktuelle prompt, returner en fejl
                if message == conversation[-1]:
                    return JSONResponse({"error": "Din prompt indeholder muligvis sensitiv information og kan ikke behandles."}, status_code=400)
                continue  # Udelad beskeden fra samtalen
        filtered_conversation.append(message)

    # Trin 2: Stream svaret fra OpenAI tilbage til frontend
    try:
        return StreamingResponse(stream_openai_response(filtered_conversation), media_type='text/plain')
    except Exception as e:
        return JSONResponse({"error": f"Fejl ved hentning af svar fra OpenAI: {str(e)}"}, status_code=500)

def check_with_ollama(prompt):
    ollama_prompt = f"""
    Hvis følgende brugerinput faktisk indeholder reel information, der ville være brud på GDPR, hvis det blev sendt til en 3. part uden for EU, og som ikke har databehanlderaftale, svar kun med 'True'.
    Hvis ikke, skal du svare med 'False'.

    Brugerinput:
    \"\"\"
    {prompt}
    \"\"\"

    Svar kun med 'True' eller 'False'.
    """

    output = ollama.generate(
        model="sikkerGPT-detector:latest",
        prompt=ollama_prompt,
        stream=False
    )
    response = output["response"].strip().lower()
    print("Ollama's svar:", response)  # For debugging
    return response == 'true'

async def stream_openai_response(conversation):
    api_key = os.getenv('OPENAI_API_KEY')

    if not api_key:
        raise Exception("OpenAI API-nøgle ikke fundet. Sæt miljøvariablen 'OPENAI_API_KEY'.")

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    data = {
        "model": "gpt-4o-mini",
        "messages": conversation,
        "stream": True,
        "temperature": 0.7,
        # Tilføj eventuelle andre parametre her
    }

    async with aiohttp.ClientSession() as session:
        async with session.post('https://api.openai.com/v1/chat/completions', headers=headers, json=data) as resp:
            if resp.status != 200:
                error = await resp.text()
                raise Exception(f"OpenAI API-fejl: {error}")

            async for line in resp.content:
                if line:
                    decoded_line = line.decode('utf-8').strip()
                    # Håndter Server-Sent Events (SSE)
                    if decoded_line.startswith('data:'):
                        content = decoded_line[5:].strip()
                        if content == '[DONE]':
                            break
                        else:
                            try:
                                chunk = json.loads(content)
                                if 'choices' in chunk:
                                    delta = chunk['choices'][0]['delta']
                                    if 'content' in delta:
                                        text = delta['content']
                                        yield text
                            except json.JSONDecodeError:
                                continue
