#!/bin/bash
set -e

mkdir -p bin

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

if [ "$OS" = "darwin" ]; then
  if [ "$ARCH" = "arm64" ]; then
    DL_TARGET="darwin_arm64"
  else
    DL_TARGET="darwin_amd64"
  fi
elif [ "$OS" = "linux" ]; then
  if [ "$ARCH" = "aarch64" ]; then
    DL_TARGET="linux_arm64"
  else
    DL_TARGET="linux_amd64"
  fi
else
  echo "Unsupported OS: $OS"
  exit 1
fi

echo "Downloading CLIProxyAPI v6.9.0 for ${DL_TARGET}..."
URL="https://github.com/router-for-me/CLIProxyAPI/releases/download/v6.9.0/CLIProxyAPI_6.9.0_${DL_TARGET}.tar.gz"

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

echo "CLIProxyAPI downloaded and extracted to bin/CLIProxyAPI (${DL_TARGET}) successfully."
