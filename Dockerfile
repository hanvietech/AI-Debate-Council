FROM python:3.9-slim

# Install curl
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Download CLIProxyAPI matching container architecture
RUN mkdir -p bin && \
    ARCH=$(uname -m) && \
    if [ "$ARCH" = "aarch64" ]; then DL_ARCH="arm64"; else DL_ARCH="amd64"; fi && \
    echo "Downloading CLIProxyAPI for linux_${DL_ARCH}..." && \
    curl -L -s "https://github.com/router-for-me/CLIProxyAPI/releases/download/v6.9.0/CLIProxyAPI_6.9.0_linux_${DL_ARCH}.tar.gz" -o bin/cliproxy.tar.gz && \
    cd bin && \
    tar -xzf cliproxy.tar.gz cli-proxy-api && \
    rm cliproxy.tar.gz && \
    mv cli-proxy-api CLIProxyAPI && \
    chmod +x CLIProxyAPI

# Copy and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create necessary directories
RUN mkdir -p data logs

# Copy the rest of the application
COPY . .

EXPOSE 8000

CMD ["python", "server.py"]
