#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_CMD="${SCRIPT_DIR}/mark-36"
TARGET_DIR="${HOME}/.local/bin"
TARGET_CMD="${TARGET_DIR}/mark-36"

if [[ ! -f "${SOURCE_CMD}" ]]; then
  echo "Source command not found: ${SOURCE_CMD}" >&2
  exit 1
fi

mkdir -p "${TARGET_DIR}"
chmod +x "${SOURCE_CMD}"
ln -sf "${SOURCE_CMD}" "${TARGET_CMD}"

echo "Installed: ${TARGET_CMD}"

case ":${PATH}:" in
  *":${TARGET_DIR}:"*)
    echo "Path already contains ${TARGET_DIR}"
    ;;
  *)
    echo "Add this to your shell profile if needed:"
    echo "  export PATH=\"${TARGET_DIR}:\$PATH\""
    ;;
esac

echo "Usage:"
echo "  mark-36 /path/to/file.md"

