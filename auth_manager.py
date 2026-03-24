import os
import glob
import json
import re
import subprocess
import asyncio
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

CLI_PATH = os.path.join(os.path.dirname(__file__), "bin", "CLIProxyAPI")
AUTH_DIR = os.path.join(os.path.dirname(__file__), "data", ".cli-proxy-api")
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.yaml")

def get_available_providers():
    """
    Runs CLIProxyAPI --help and parses all -login, -*-login, -*-cookie flags.
    Returns a list of dicts: {"flag": "-claude-login", "label": "Claude"}
    """
    if not os.path.exists(CLI_PATH):
        return []
        
    try:
        result = subprocess.run([CLI_PATH, "--help"], capture_output=True, text=True, timeout=5)
        output = result.stdout + result.stderr
    except Exception as e:
        logger.error(f"Failed to get CLI help: {e}")
        return []
        
    providers = []
    lines = output.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if line.startswith("-") and ("-login" in line or "-cookie" in line) and "no-browser" not in line:
            flag = line.split()[0]
            label = ""
            if i + 1 < len(lines) and not lines[i+1].strip().startswith("-"):
                desc = lines[i+1].strip()
                match = re.search(r'Login to (.*?) using', desc)
                if match:
                    label = match.group(1).strip()
                elif "Google Account" in desc:
                    label = "Google (Gemini)"
            
            if not label:
                label = flag.replace("-login", "").replace("-", " ").strip().title()
                if not label:
                    label = "Google (Gemini)"
                    
            if flag.endswith("-device-login"):
                label += " (Device)"
            elif flag.endswith("-cookie"):
                label += " (Cookie)"
            elif flag.endswith("-login") and label in ["Codex", "IFlow", "iFlow"]:
                if label == "IFlow": label = "iFlow"
                label += " (OAuth)"
                    
            providers.append({"flag": flag, "label": label})
        i += 1
    
    # Filter out unsupported providers
    blocked = {"-iflow-login", "-iflow-cookie", "-kimi-login", "-qwen-login", "-codex-device-login", "-antigravity-login"}
    providers = [p for p in providers if p["flag"] not in blocked]
    
    # Simplify labels
    label_map = {"-claude-login": "Claude", "-codex-login": "Codex", "-login": "Gemini"}
    for p in providers:
        if p["flag"] in label_map:
            p["label"] = label_map[p["flag"]]
        
    return providers

def get_all_auth_status():
    """
    Reads ~/.cli-proxy-api/*.json and returns token status.
    """
    status_list = []
    if not os.path.exists(AUTH_DIR):
        return status_list
        
    for file in glob.glob(os.path.join(AUTH_DIR, "*.json")):
        try:
            with open(file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            provider_type = data.get("type", "unknown")
            email = data.get("email", "unknown")
            expired_str = data.get("expired", "")
            
            is_valid = False
            if expired_str:
                try:
                    expired_dt = datetime.fromisoformat(expired_str)
                    if expired_dt.tzinfo is None:
                        expired_dt = expired_dt.replace(tzinfo=timezone.utc)
                    if expired_dt > datetime.now(timezone.utc):
                        is_valid = True
                except Exception:
                    pass
            elif provider_type != "unknown":
                is_valid = True
            
            status_list.append({
                "provider": provider_type,
                "email": email,
                "expired": expired_str,
                "is_valid": is_valid
            })
        except Exception:
            continue
            
    return status_list

async def start_oauth_login(provider_flag: str, extra_input: str = None):
    """
    Async generator that runs CLIProxyAPI -no-browser <flag>,
    yields the OAuth URL, then monitors for completion with a timeout.
    """
    cmd = [CLI_PATH, "-config", CONFIG_PATH, "-no-browser", provider_flag]
    
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE if extra_input else None,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT
        )
        if extra_input and process.stdin:
            process.stdin.write((extra_input + "\n").encode())
            await process.stdin.drain()
            process.stdin.close()
    except Exception as e:
        yield json.dumps({"type": "error", "message": f"Failed to start CLI: {e}"})
        return

    url_yielded = False
    
    try:
        # Phase 1: Read lines until we find the URL (max 30 seconds)
        try:
            while True:
                line = await asyncio.wait_for(process.stdout.readline(), timeout=30)
                if not line:
                    break
                    
                decoded = line.decode('utf-8', errors='replace').strip()
                if not decoded:
                    continue
                    
                logger.info(f"[OAuth {provider_flag}] {decoded}")
                
                if "https://" in decoded and not url_yielded:
                    urls = re.findall(r'(https?://[^\s]+)', decoded)
                    if urls:
                        yield json.dumps({"type": "oauth_url", "url": urls[0]})
                        url_yielded = True
                        
                if "Successfully" in decoded or "Token updated" in decoded or "Saved" in decoded:
                    yield json.dumps({"type": "complete"})
                    return
                    
                # Once URL is yielded, stop reading and let user authenticate
                if url_yielded:
                    break
        except asyncio.TimeoutError:
            if not url_yielded:
                yield json.dumps({"type": "error", "message": "Timeout waiting for auth URL"})
                process.kill()
                return

        # Phase 2: Wait for process to finish (max 5 minutes) 
        # This runs asynchronously — user is authenticating in their browser
        if url_yielded:
            try:
                await asyncio.wait_for(process.wait(), timeout=300)
                yield json.dumps({"type": "complete"})
            except asyncio.TimeoutError:
                yield json.dumps({"type": "timeout"})
                process.kill()
        else:
            await process.wait()
            if process.returncode == 0:
                yield json.dumps({"type": "complete"})
            else:
                yield json.dumps({"type": "error", "message": f"CLI exited with code {process.returncode}"})
                
    except asyncio.CancelledError:
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), timeout=2.0)
        except asyncio.TimeoutError:
            process.kill()
        raise
