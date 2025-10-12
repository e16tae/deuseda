# Environment Variables & Secrets Guide

This document outlines all environment variables, Kubernetes secrets, and GitHub Actions secrets used in the Deuseda Console project.

## Table of Contents
- [Kubernetes ConfigMap](#kubernetes-configmap)
- [Kubernetes Secrets](#kubernetes-secrets)
- [GitHub Actions Secrets](#github-actions-secrets)
- [Security Best Practices](#security-best-practices)
- [Setup Instructions](#setup-instructions)

---

## Kubernetes ConfigMap

**File**: `k8s/base/configmap.yaml`

Non-sensitive application configuration that can be modified without rebuilding images.

### Application Identity
| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | `deuseda-console` | Application identifier |
| `APP_ENV` | `base` | Environment (overridden by overlays: `dev`, `production`) |

### Domain Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_DOMAIN` | `console.deuseda.com` | Frontend domain name |
| `BACKEND_DOMAIN` | `api.deuseda.com` | Backend API domain name |
| `API_URL` | `https://api.deuseda.com` | Full API URL |
| `VITE_WS_URL` | `wss://api.deuseda.com/ws` | WebSocket URL for frontend |

### Backend Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_HOST` | `0.0.0.0` | Server bind address |
| `SERVER_PORT` | `8080` | Server listen port |
| `RUST_LOG` | `info,deuseda_console=debug` | Rust logging level |

### SSH Target Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `SSH_HOST` | `deuseda.com` | SSH server hostname |
| `SSH_PORT` | `22` | SSH server port |

### Database Configuration (Non-Sensitive)
| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `deuseda-postgres` | PostgreSQL service name |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `deuseda_console` | Database name |
| `DB_USER` | `deuseda` | Database username |

### Session Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_TIMEOUT` | `3600` | Session timeout in seconds (1 hour) |
| `JWT_EXPIRATION` | `86400` | JWT token expiration in seconds (24 hours) |

---

## Kubernetes Secrets

**File**: `k8s/base/secret.yaml`

⚠️ **SECURITY WARNING**: The base secrets file contains example values for LOCAL DEVELOPMENT ONLY. These MUST be replaced in production!

### Secret: `postgres-secret`

PostgreSQL database credentials.

| Key | Description | Generate With |
|-----|-------------|---------------|
| `database` | Database name | Manual (e.g., `deuseda_console`) |
| `username` | Database username | Manual (e.g., `deuseda`) |
| `password` | Database password | `openssl rand -base64 32` |

**Usage**:
```yaml
env:
  - name: POSTGRES_PASSWORD
    valueFrom:
      secretKeyRef:
        name: postgres-secret
        key: password
```

### Secret: `backend-secret`

Backend application secrets.

| Key | Description | Generate With |
|-----|-------------|---------------|
| `database-url` | Full PostgreSQL connection string | Construct manually |
| `jwt-secret` | JWT signing secret | `openssl rand -base64 64` |

**database-url Format**:
```
postgresql://username:password@host:port/database
```

**Example**:
```
postgresql://deuseda:SECURE_PASSWORD@deuseda-postgres:5432/deuseda_console
```

**Usage**:
```yaml
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: backend-secret
        key: database-url
```

---

## GitHub Actions Secrets

**Location**: Repository Settings → Secrets and variables → Actions

### Required Secrets

#### 1. `GH_PAT` (GitHub Personal Access Token)
- **Purpose**: Update Kubernetes manifests in the repository
- **Required Permissions**:
  - `repo` (Full control of private repositories)
  - `workflow` (Update GitHub Action workflows)
- **Generate**: GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
- **Used In**: `cd-production.yaml` (update-manifests job)

#### 2. `ARGOCD_SERVER`
- **Purpose**: ArgoCD server URL for deployment
- **Format**: `argocd.example.com` (no https://)
- **Example**: `argocd.deuseda.com`
- **Used In**: `cd-production.yaml` (trigger-argocd-sync job)

#### 3. `ARGOCD_TOKEN`
- **Purpose**: ArgoCD authentication token
- **Generate**:
  ```bash
  argocd account generate-token --account github-actions
  ```
- **Used In**: `cd-production.yaml` (trigger-argocd-sync job)

### Optional Secrets

#### 4. `DOCKER_REGISTRY_TOKEN` (Future Use)
- **Purpose**: Alternative to `GITHUB_TOKEN` for private registries
- **Not currently used**: We use `GITHUB_TOKEN` for GHCR authentication

---

## Security Best Practices

### 1. Secret Generation

**Always use cryptographically secure random values**:

```bash
# PostgreSQL password (32 bytes = 256 bits)
openssl rand -base64 32

# JWT secret (64 bytes = 512 bits)
openssl rand -base64 64

# Generate UUID for identifiers
uuidgen
```

### 2. Production Secret Management

**DO NOT commit production secrets to Git!**

Use one of these approaches:

#### Option A: Sealed Secrets (Recommended for GitOps)
```bash
# Install Sealed Secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Seal a secret
echo -n "SECURE_PASSWORD" | kubectl create secret generic postgres-secret \
  --dry-run=client \
  --from-file=password=/dev/stdin \
  -o yaml | \
  kubeseal -o yaml > sealed-secret.yaml

# Commit sealed-secret.yaml to Git (it's encrypted)
```

#### Option B: External Secrets Operator
Integrate with cloud secret managers:
- AWS Secrets Manager
- Google Cloud Secret Manager
- Azure Key Vault
- HashiCorp Vault

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: postgres-secret
spec:
  secretStoreRef:
    name: aws-secrets-manager
  target:
    name: postgres-secret
  data:
    - secretKey: password
      remoteRef:
        key: deuseda/postgres-password
```

#### Option C: Manual kubectl
```bash
# Create secrets directly in the cluster
kubectl create secret generic backend-secret \
  --from-literal=database-url='postgresql://...' \
  --from-literal=jwt-secret='...' \
  -n deuseda
```

### 3. Secret Rotation

**Rotate secrets regularly** (recommended: every 90 days):

```bash
# 1. Generate new secret
NEW_PASSWORD=$(openssl rand -base64 32)

# 2. Update database
kubectl exec -it prod-deuseda-postgres-0 -n deuseda -- \
  psql -U postgres -c "ALTER USER deuseda WITH PASSWORD '$NEW_PASSWORD';"

# 3. Update Kubernetes secret
kubectl patch secret postgres-secret -n deuseda \
  -p "{\"data\":{\"password\":\"$(echo -n $NEW_PASSWORD | base64)\"}}"

# 4. Restart pods to pick up new secret
kubectl rollout restart deployment/prod-deuseda-backend -n deuseda
```

### 4. Access Control

**Restrict secret access with RBAC**:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: secret-reader
  namespace: deuseda
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    resourceNames: ["postgres-secret", "backend-secret"]
    verbs: ["get"]
```

---

## Setup Instructions

### Local Development

1. **Copy environment files**:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. **Edit `.env` with local values**:
   ```bash
   DATABASE_URL=postgres://deuseda:local_dev_password@localhost:5432/deuseda_console
   JWT_SECRET=local_jwt_secret_change_me
   ```

3. **Start services**:
   ```bash
   docker-compose up -d
   ```

### Kubernetes Development Environment

1. **Deploy base secrets** (dev environment):
   ```bash
   kubectl apply -k k8s/overlays/dev
   ```

2. **Verify deployment**:
   ```bash
   kubectl get secrets -n deuseda
   kubectl get configmap -n deuseda
   ```

### Kubernetes Production Environment

1. **Generate production secrets**:
   ```bash
   # PostgreSQL password
   POSTGRES_PASSWORD=$(openssl rand -base64 32)

   # JWT secret
   JWT_SECRET=$(openssl rand -base64 64)
   ```

2. **Create secrets manually** (recommended):
   ```bash
   kubectl create secret generic postgres-secret \
     --from-literal=database='deuseda_console' \
     --from-literal=username='deuseda' \
     --from-literal=password="$POSTGRES_PASSWORD" \
     -n deuseda

   kubectl create secret generic backend-secret \
     --from-literal=database-url="postgresql://deuseda:$POSTGRES_PASSWORD@prod-deuseda-postgres:5432/deuseda_console" \
     --from-literal=jwt-secret="$JWT_SECRET" \
     -n deuseda
   ```

3. **OR use Sealed Secrets** (GitOps approach):
   ```bash
   # See "Option A: Sealed Secrets" above
   ```

4. **Configure GitHub Secrets**:
   - Go to Repository Settings → Secrets and variables → Actions
   - Add `GH_PAT`, `ARGOCD_SERVER`, `ARGOCD_TOKEN`

5. **Deploy production**:
   ```bash
   kubectl apply -f k8s/argocd-application.yaml
   ```

### Verify Configuration

```bash
# Check ConfigMap
kubectl describe configmap app-config -n deuseda

# Check secrets (will show "Opaque" data, not actual values)
kubectl describe secret postgres-secret -n deuseda
kubectl describe secret backend-secret -n deuseda

# Decode a secret value (for debugging)
kubectl get secret backend-secret -n deuseda -o jsonpath='{.data.jwt-secret}' | base64 -d

# Check pod environment variables
kubectl exec -it prod-deuseda-backend-xxx -n deuseda -- env | grep -E '(DATABASE|JWT|SERVER)'
```

---

## Troubleshooting

### Secret Not Found
```bash
# Error: secret "postgres-secret" not found

# Solution: Verify secret exists in correct namespace
kubectl get secrets -n deuseda

# If missing, create the secret
kubectl apply -f k8s/base/secret.yaml -n deuseda
```

### Pod Cannot Connect to Database
```bash
# Check DATABASE_URL format
kubectl logs prod-deuseda-backend-xxx -n deuseda

# Verify secret value
kubectl get secret backend-secret -n deuseda -o jsonpath='{.data.database-url}' | base64 -d

# Test database connection
kubectl exec -it prod-deuseda-postgres-0 -n deuseda -- psql -U deuseda -d deuseda_console -c "SELECT 1;"
```

### JWT Authentication Failing
```bash
# Verify JWT_SECRET is set
kubectl exec -it prod-deuseda-backend-xxx -n deuseda -- env | grep JWT_SECRET

# Check secret exists and is not empty
kubectl get secret backend-secret -n deuseda -o jsonpath='{.data.jwt-secret}' | base64 -d | wc -c
# Should output >= 32 bytes
```

---

## References

- [Kubernetes Secrets Documentation](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- [External Secrets Operator](https://external-secrets.io/)
- [12-Factor App: Config](https://12factor.net/config)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
