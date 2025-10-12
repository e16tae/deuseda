# Deuseda Console - Kubernetes Deployment

This directory contains Kubernetes manifests for deploying the Deuseda Console application.

## Architecture

- **Frontend**: React application served by Nginx
- **Backend**: Rust Axum application
- **Database**: PostgreSQL 16
- **Ingress**: Kong API Gateway
- **GitOps**: ArgoCD for continuous deployment

## Directory Structure

```
k8s/
├── base/                           # Base Kubernetes resources
│   ├── configmap.yaml             # Non-sensitive configuration
│   ├── secret.yaml                # Sensitive data (JWT, DB credentials)
│   ├── postgres.yaml              # PostgreSQL StatefulSet
│   ├── backend.yaml               # Backend Deployment & Service
│   ├── frontend.yaml              # Frontend Deployment & Service
│   ├── ingress.yaml               # Kong Ingress for console.deuseda.com
│   └── kustomization.yaml         # Kustomize base config
├── overlays/
│   └── production/
│       └── kustomization.yaml     # Production-specific overrides
└── argocd-application.yaml        # ArgoCD Application definition
```

## Prerequisites

1. **Kubernetes Cluster**: Running cluster with kubectl access
2. **Kong API Gateway**: Installed as ingress controller
3. **ArgoCD**: Installed for GitOps deployment
4. **TLS Certificate**: Secret named `deuseda-tls-cert` for HTTPS

## Deployment Steps

### 1. Update Configuration

Before deploying, update these placeholders:

**In `k8s/base/secret.yaml`**:
```yaml
POSTGRES_PASSWORD: "YOUR_SECURE_PASSWORD"
JWT_SECRET: "YOUR_JWT_SECRET_KEY"
DATABASE_URL: "postgres://deuseda:YOUR_SECURE_PASSWORD@postgres:5432/deuseda_console"
```

**In `k8s/base/backend.yaml` and `k8s/base/frontend.yaml`**:
```yaml
image: ghcr.io/YOUR_GITHUB_USERNAME/deuseda-backend:latest
image: ghcr.io/YOUR_GITHUB_USERNAME/deuseda-frontend:latest
```

**In `k8s/argocd-application.yaml`**:
```yaml
repoURL: https://github.com/YOUR_GITHUB_USERNAME/deuseda.git
```

### 2. Create TLS Certificate Secret

```bash
kubectl create secret tls deuseda-tls-cert \
  --cert=path/to/cert.crt \
  --key=path/to/cert.key \
  -n default
```

### 3. Deploy with ArgoCD

```bash
# Apply the ArgoCD Application
kubectl apply -f k8s/argocd-application.yaml

# Check sync status
argocd app get deuseda-console

# Sync manually if needed
argocd app sync deuseda-console
```

### 4. Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n default

# Check services
kubectl get svc -n default

# Check ingress
kubectl get ingress -n default

# View backend logs
kubectl logs -f deployment/deuseda-backend -n default

# View frontend logs
kubectl logs -f deployment/deuseda-frontend -n default
```

## CI/CD Pipeline

The project uses multiple GitHub Actions workflows:

### Production Deployment (`.github/workflows/cd-production.yaml`)

Triggered on push to `main` branch:

1. **Build and Push**: Builds Docker images and pushes to GHCR
2. **Security Scan**: Runs Trivy vulnerability scanning
3. **Update Manifests**: Updates image tags in `k8s/overlays/production/kustomization.yaml`
4. **Trigger ArgoCD Sync**: Syncs changes to the cluster via ArgoCD CLI
5. **Verify Deployment**: Performs health checks on deployed services
6. **Notify**: Sends deployment status notification

### CI Workflows

- **`.github/workflows/ci-develop.yaml`**: Runs tests and linting on `develop` branch
- **`.github/workflows/ci-main.yaml`**: Runs tests and linting on `main` branch PRs

### Workflow Trigger

Push to `main` branch triggers production deployment:

```bash
git checkout develop
# Make changes
git commit -am "Your changes"
git push origin develop

# Merge to main
git checkout main
git merge develop
git push origin main  # This triggers production deployment
```

Requires the following GitHub Secrets:
- `GH_PAT`: GitHub Personal Access Token
- `ARGOCD_SERVER`: ArgoCD server URL
- `ARGOCD_TOKEN`: ArgoCD authentication token

See [docs/ENVIRONMENT_VARIABLES.md](../docs/ENVIRONMENT_VARIABLES.md) for details.

## Environment Variables

### Backend Configuration

| Variable | Source | Description |
|----------|--------|-------------|
| `DATABASE_URL` | Secret | PostgreSQL connection string |
| `JWT_SECRET` | Secret | JWT signing key |
| `SERVER_HOST` | ConfigMap | Server bind address (0.0.0.0) |
| `SERVER_PORT` | ConfigMap | Server port (8080) |
| `SSH_HOST` | ConfigMap | Remote SSH server hostname |
| `SSH_PORT` | ConfigMap | Remote SSH server port |
| `RUST_LOG` | ConfigMap | Logging configuration |

### Frontend Configuration

The frontend is built at Docker image build time with environment variables from `.env`:

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | API base URL (handled by nginx proxy) |

## Troubleshooting

### Pods not starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n default

# Check events
kubectl get events -n default --sort-by='.lastTimestamp'
```

### Database connection issues

```bash
# Check postgres pod
kubectl logs -f statefulset/postgres -n default

# Test connection from backend pod
kubectl exec -it deployment/deuseda-backend -n default -- sh
# Inside pod:
# psql $DATABASE_URL
```

### Ingress not working

```bash
# Check Kong ingress controller
kubectl logs -f -n kong deployment/kong-controller

# Check ingress configuration
kubectl describe ingress deuseda-ingress -n default
```

### ArgoCD sync issues

```bash
# Check application status
argocd app get deuseda-console

# View sync logs
argocd app logs deuseda-console

# Force refresh
argocd app sync deuseda-console --force
```

## Monitoring

### Health Checks

- Backend health endpoint: `https://console.deuseda.com/health`
- Frontend: `https://console.deuseda.com/`

### Logs

```bash
# Stream backend logs
kubectl logs -f deployment/deuseda-backend -n default

# Stream frontend logs
kubectl logs -f deployment/deuseda-frontend -n default

# Stream all logs
kubectl logs -f -l app=deuseda-backend -n default
kubectl logs -f -l app=deuseda-frontend -n default
```

## Scaling

### Horizontal Scaling

```bash
# Scale backend
kubectl scale deployment deuseda-backend --replicas=3 -n default

# Scale frontend
kubectl scale deployment deuseda-frontend --replicas=3 -n default
```

### Update Replicas in Manifests

Edit `k8s/base/backend.yaml` or `k8s/base/frontend.yaml`:

```yaml
spec:
  replicas: 3  # Change this value
```

## Database Migrations

Migrations run automatically on backend startup via SQLx. To run manually:

```bash
# Get backend pod name
kubectl get pods -n default | grep backend

# Run migrations
kubectl exec -it <backend-pod-name> -n default -- ./deuseda-console migrate
```

## Backup and Restore

### Database Backup

```bash
# Backup database
kubectl exec -it statefulset/postgres -n default -- \
  pg_dump -U deuseda deuseda_console > backup.sql
```

### Database Restore

```bash
# Restore database
kubectl exec -i statefulset/postgres -n default -- \
  psql -U deuseda deuseda_console < backup.sql
```

## Security Notes

1. **Secrets Management**: Update all default passwords and secrets
2. **TLS**: Ensure valid TLS certificates are configured
3. **Network Policies**: Consider adding NetworkPolicies for pod isolation
4. **RBAC**: Configure appropriate RBAC rules for service accounts
5. **Image Scanning**: Enable vulnerability scanning in GitHub Actions

## Support

For issues or questions:
- Check application logs
- Review ArgoCD sync status
- Verify Kong ingress configuration
- Check database connectivity
