import asyncio
import subprocess
import httpx
import os
import atexit
import logging

logger = logging.getLogger(__name__)

_proxy_process = None

def cleanup_proxy():
    global _proxy_process
    if _proxy_process:
        logger.info("Terminating CLIProxyAPI sidecar...")
        _proxy_process.terminate()
        try:
            _proxy_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _proxy_process.kill()

atexit.register(cleanup_proxy)

async def check_proxy_health(port: int) -> bool:
    try:
        async with httpx.AsyncClient(timeout=1.0) as client:
            resp = await client.get(f"http://127.0.0.1:{port}/v1/models")
            return resp.status_code == 200
    except Exception:
        return False

async def ensure_cli_proxy_running(port: int = 8081):
    global _proxy_process
    is_running = await check_proxy_health(port)
    if is_running:
        logger.info(f"CLIProxyAPI is already running on port {port}.")
        return

    bin_path = os.path.join(os.path.dirname(__file__), "bin", "CLIProxyAPI")
    if not os.path.exists(bin_path):
        logger.error(f"WARNING: CLIProxyAPI binary not found at {bin_path}. Please run scripts/install_cliproxy.sh")
        return

    logger.info(f"Starting CLIProxyAPI sidecar on port {port}...")
    
    # Check if log dir exists
    log_dir = os.path.join(os.path.dirname(__file__), "logs")
    os.makedirs(log_dir, exist_ok=True)
    
    config_path = os.path.join(os.path.dirname(__file__), "config.yaml")

    with open(os.path.join(log_dir, "cliproxy.log"), "w") as log_file:
        _proxy_process = subprocess.Popen(
            [bin_path, "-config", config_path],
            stdout=log_file,
            stderr=subprocess.STDOUT
        )

    # Wait up to 10 seconds for it to become healthy
    for _ in range(10):
        await asyncio.sleep(1)
        if await check_proxy_health(port):
            logger.info("CLIProxyAPI sidecar started successfully.")
            return

    logger.error("CLIProxyAPI sidecar failed to pass health check after 10 seconds.")
