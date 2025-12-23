#!/bin/bash
set -e

# Remove old container
docker rm -f garage 2>/dev/null || true

# Generate secret
SECRET=$(openssl rand -hex 32)
ADMIN_TOKEN="hereisthetoken"

echo "Secret: $SECRET"
echo "Admin Token: $ADMIN_TOKEN"

# Create config inside volume
docker run --rm -v garage-data:/data alpine sh -c "mkdir -p /data/meta /data/data && cat > /data/garage.toml << 'CONFIGEOF'
metadata_dir = \"/data/meta\"
data_dir     = \"/data/data\"
db_engine    = \"sqlite\"

replication_factor = 1

rpc_bind_addr = \"[::]:3901\"
rpc_secret    = \"REPLACEME_SECRET\"

[s3_api]
s3_region = \"garage\"
api_bind_addr = \"[::]:3900\"
root_domain = \".s3.garage.localhost\"

[admin]
api_bind_addr = \"[::]:3902\"
admin_token = \"REPLACEME_TOKEN\"
CONFIGEOF
chown -R 1000:1000 /data"

# Replace placeholders with actual values
docker run --rm -v garage-data:/data alpine sh -c "sed -i 's/REPLACEME_SECRET/$SECRET/g' /data/garage.toml && sed -i 's/REPLACEME_TOKEN/$ADMIN_TOKEN/g' /data/garage.toml && cat /data/garage.toml"

# Start Garage with config file
docker run -d --name garage \
  -p 3900:3900 \
  -p 3901:3901 \
  -p 3902:3902 \
  -v garage-data:/data \
  dxflrs/garage:v2.1.0 \
  /garage -c /data/garage.toml server

sleep 2
echo "=== Container Status ==="
docker ps --filter name=garage
echo ""
echo "=== Garage Logs ==="
docker logs garage --tail 30
