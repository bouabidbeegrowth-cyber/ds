#!/bin/bash
cd /home/z/my-project
while true; do
  NEXT_TELEMETRY_DISABLED=1 npx next dev --port 3000 2>&1
  echo "Server died, restarting in 2s..." 
  sleep 2
done
