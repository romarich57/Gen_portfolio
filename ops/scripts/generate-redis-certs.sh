#!/bin/bash
# Generate Redis TLS artifacts for local/prod-like environments.
# Outputs:
# - ops/redis/certs/stunnel.pem (server cert + private key)
# - ops/redis/certs/redis-ca.crt (CA certificate only)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$SCRIPT_DIR/../redis/certs"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$CERTS_DIR"

CA_KEY="$TMP_DIR/redis-ca.key"
CA_CERT="$TMP_DIR/redis-ca.crt"
SERVER_KEY="$TMP_DIR/stunnel.key"
SERVER_CSR="$TMP_DIR/stunnel.csr"
SERVER_CERT="$TMP_DIR/stunnel.crt"
OPENSSL_CFG="$TMP_DIR/stunnel.cnf"

cat >"$OPENSSL_CFG" <<'EOF'
[req]
distinguished_name = dn
prompt = no

[dn]
CN = redis-tls

[ext]
subjectAltName = DNS:redis-tls,DNS:localhost,IP:127.0.0.1
keyUsage = digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
EOF

openssl genrsa -out "$CA_KEY" 4096 >/dev/null 2>&1
openssl req -x509 -new -nodes -key "$CA_KEY" -sha256 -days 3650 -out "$CA_CERT" -subj "/CN=portfolio-redis-ca" >/dev/null 2>&1

openssl genrsa -out "$SERVER_KEY" 2048 >/dev/null 2>&1
openssl req -new -key "$SERVER_KEY" -out "$SERVER_CSR" -config "$OPENSSL_CFG" >/dev/null 2>&1
openssl x509 -req -in "$SERVER_CSR" -CA "$CA_CERT" -CAkey "$CA_KEY" -CAcreateserial -out "$SERVER_CERT" -days 825 -sha256 -extfile "$OPENSSL_CFG" -extensions ext >/dev/null 2>&1

cp "$CA_CERT" "$CERTS_DIR/redis-ca.crt"
cat "$SERVER_CERT" "$SERVER_KEY" >"$CERTS_DIR/stunnel.pem"

if grep -Eq 'BEGIN (RSA |EC |)PRIVATE KEY' "$CERTS_DIR/redis-ca.crt"; then
  echo "redis-ca.crt must not contain private key material"
  exit 1
fi

chmod 600 "$CERTS_DIR/stunnel.pem"
chmod 644 "$CERTS_DIR/redis-ca.crt"

echo "✅ Redis TLS certs generated in $CERTS_DIR"
echo "   - redis-ca.crt (CA certificate only)"
echo "   - stunnel.pem (server certificate + private key)"
