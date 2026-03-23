#!/bin/bash
set -e

mkdir -p bin

echo "Downloading CLIProxyAPI v6.9.0 for darwin_arm64..."
URL="https://github.com/router-for-me/CLIProxyAPI/releases/download/v6.9.0/CLIProxyAPI_6.9.0_darwin_arm64.tar.gz"

curl -L -s "$URL" -o bin/cliproxy.tar.gz
cd bin
tar -xzf cliproxy.tar.gz cli-proxy-api
rm cliproxy.tar.gz
mv cli-proxy-api CLIProxyAPI
chmod +x CLIProxyAPI
cd ..

if [ ! -f .gitignore ]; then
  touch .gitignore
fi

if ! grep -q "^bin/" .gitignore; then
  echo "bin/" >> .gitignore
fi

echo "CLIProxyAPI downloaded and extracted to bin/CLIProxyAPI successfully."
