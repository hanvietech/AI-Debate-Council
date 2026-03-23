import httpx
import json
import logging

logger = logging.getLogger(__name__)

async def stream_chat_completion(api_url: str, model_name: str, messages: list, api_key: str = None):
    """
    Standard OpenAI-compatible streaming client.
    Automatically handles hybrid connections (direct API with api_key, or proxy without it).
    """
    headers = {"Content-Type": "application/json"}
    if api_key and api_key.strip():
        headers["Authorization"] = f"Bearer {api_key.strip()}"
        
    payload = {
        "model": model_name,
        "messages": messages,
        "stream": True
    }
    
    timeout = httpx.Timeout(120.0, connect=15.0)
    
    try:
        async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
            async with client.stream("POST", api_url, headers=headers, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue
                        
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            if "choices" in data and len(data["choices"]) > 0:
                                delta = data["choices"][0].get("delta", {})
                                if "content" in delta and delta["content"]:
                                    yield delta["content"]
                        except json.JSONDecodeError:
                            continue
    except Exception as e:
        logger.error(f"API Streaming Error: {e}")
        yield f"\n[API Error]: {e}"
