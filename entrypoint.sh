#!/bin/sh

# This script runs on container startup in the production stage.
# It extracts all environment variables starting with VITE_ 
# and writes them to config.js in the served directory.

CONFIG_FILE="/app/config.js"

echo "window.__MARK36_CONFIG__ = {" > $CONFIG_FILE

# Filter env vars starting with VITE_ and format as JS object properties
env | grep '^VITE_' | while read -r line; do
    key=$(echo $line | cut -d '=' -f 1)
    value=$(echo $line | cut -d '=' -f 2-)
    echo "  \"$key\": \"$value\"," >> $CONFIG_FILE
done

echo "};" >> $CONFIG_FILE

echo "Configuration generated in $CONFIG_FILE:"
cat $CONFIG_FILE

# Execute the original command (serve)
exec "$@"
