FROM --platform=linux/amd64 python:3.9-slim

# Install curl
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Download CLIProxyAPI linux/amd64 binary
RUN mkdir -p bin && \
    echo "Downloading CLIProxyAPI for linux_amd64..." && \
    curl -L -s "https://github.com/router-for-me/CLIProxyAPI/releases/download/v6.9.0/CLIProxyAPI_6.9.0_linux_amd64.tar.gz" -o bin/cliproxy.tar.gz && \
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
