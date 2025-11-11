## Secrets & Configuration Hardening Plan

Goal: move application secrets out of `.env` files and into managed storage (AWS Systems Manager Parameter Store), while keeping local development ergonomics.

---

### 1. Inventory the Required Keys

Collect every secret currently stored in `.env` or Docker Compose:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `JWT_SECRET`
- `MAERSK_API_KEY`
- `MAERSK_API_SECRET`
- Any additional API keys (Portcast, Salesforce, etc.)

Record non-sensitive configuration (e.g. `PORT`, `NODE_ENV`) – these can remain in plain env vars.

---

### 2. Create Secure Parameters in AWS SSM

For each secret:

```bash
aws ssm put-parameter \
  --name "/rms-mcp/prod/SUPABASE_SERVICE_KEY" \
  --type "SecureString" \
  --description "Supabase service key for RMS MCP server (prod)" \
  --value "YOUR_SECRET_VALUE" \
  --overwrite
```

Guidelines:

- Use a consistent naming scheme: `/{app}/{env}/{key}`.
- Set `--key-id` if using a custom CMK; default AWS-managed KMS is acceptable to start.
- Repeat for staging/dev, e.g. `/rms-mcp/dev/...`.

---

### 3. Grant IAM Access

- **EC2 / ECS role**: allow `ssm:GetParameter`, `ssm:GetParameters`, and `kms:Decrypt` on the new parameter paths.
- **CI/CD role**: limited read access if build pipelines need secrets (e.g., for smoke tests).
- Avoid giving developers blanket access; use IAM policies scoped to specific paths.

Example IAM policy snippet:

```json
{
  "Effect": "Allow",
  "Action": [
    "ssm:GetParameter",
    "ssm:GetParameters",
    "ssm:GetParametersByPath"
  ],
  "Resource": [
    "arn:aws:ssm:ap-south-1:123456789012:parameter/rms-mcp/prod/*"
  ]
}
```

---

### 4. Update Docker Compose / Runtime Bootstrapping

#### Option A: Entrypoint Script (recommended)

Create `scripts/fetch-secrets.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

fetch_secret() {
  aws ssm get-parameter \
    --with-decryption \
    --name "$1" \
    --query "Parameter.Value" \
    --output text
}

export SUPABASE_URL=$(fetch_secret "/rms-mcp/prod/SUPABASE_URL")
export SUPABASE_SERVICE_KEY=$(fetch_secret "/rms-mcp/prod/SUPABASE_SERVICE_KEY")
export JWT_SECRET=$(fetch_secret "/rms-mcp/prod/JWT_SECRET")
export MAERSK_API_KEY=$(fetch_secret "/rms-mcp/prod/MAERSK_API_KEY")
export MAERSK_API_SECRET=$(fetch_secret "/rms-mcp/prod/MAERSK_API_SECRET")

exec "$@"
```

Update `Dockerfile`/`docker-compose.yml` to call the script before starting the app:

```yaml
command: ["./scripts/fetch-secrets.sh", "node", "dist/index.js"]
```

Ensure AWS creds/role are available in the container (instance profile, ECS task role, or `~/.aws/credentials` for dev).

#### Option B: Use `env_file` + SSM CLI (temporary fallback)

```bash
aws ssm get-parameters-by-path \
  --path "/rms-mcp/prod" \
  --with-decryption \
  --query "Parameters[*].{Name:Name,Value:Value}" \
  --output text \
  | awk '{print toupper($1)"="$2}' > .env.runtime
```

Then reference `.env.runtime` in Docker Compose. This is suitable for quick testing but less secure than fetching on boot.

---

### 5. Local Development Workflow

- Keep `.env.local` (ignored by git) for developers.
- Provide a helper script to sync from SSM when needed:

```bash
./scripts/pull-dev-secrets.sh
```

where the script fetches dev/staging parameters into `.env.local`.

---

### 6. Clean Up Existing Secrets

Once the application reads from SSM:

- Remove plain secrets from the committed `.env.example`.
- Rotate `JWT_SECRET`, Supabase service key, and Maersk credentials (generate new values) to ensure old values are not leaked.
- Update deployment runbooks noting that manual edits to `.env` are no longer required.

---

### 7. Validation Checklist

1. Deploy to staging with new bootstrapping; confirm API responses and Maersk fallback still function.
2. Rebuild Docker image locally to ensure AWS CLI is available (or use `aws-sdk` within Node to fetch secrets if preferred).
3. Run smoke tests against staging/prod after rotation.
4. Add monitoring/alerts for failed secret fetch attempts (non-zero exit in entrypoint).

---

### Future Enhancements

- Integrate HashiCorp Vault or AWS Secrets Manager if we require secret rotation automation.
- Use Parameter Store dynamic references (`{{resolve:ssm-secure:/path}}`) directly in ECS task definitions once we move away from docker-compose.
- Audit secret access with AWS CloudTrail to detect anomalies.


