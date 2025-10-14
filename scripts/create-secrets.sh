#!/bin/bash
#
# Kubernetes Secrets Creation Script for Deuseda
#
# This script generates all required Kubernetes secrets with strong,
# cryptographically secure random values.
#
# Usage:
#   ./scripts/create-secrets.sh [OPTIONS]
#
# Options:
#   --namespace NAME    Kubernetes namespace (default: deuseda)
#   --context NAME      Kubernetes context (default: current context)
#   --dry-run          Show commands without executing
#   --help             Show this help message
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
NAMESPACE="deuseda"
CONTEXT=""
DRY_RUN=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --namespace)
      NAMESPACE="$2"
      shift 2
      ;;
    --context)
      CONTEXT="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help)
      grep '^#' "$0" | sed 's/^# //'
      exit 0
      ;;
    *)
      echo -e "${RED}Error: Unknown option $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Set context flag if provided
CONTEXT_FLAG=""
if [[ -n "$CONTEXT" ]]; then
  CONTEXT_FLAG="--context=$CONTEXT"
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   Deuseda Kubernetes Secrets Generator${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}⚙️  Configuration:${NC}"
echo "   Namespace: $NAMESPACE"
if [[ -n "$CONTEXT" ]]; then
  echo "   Context: $CONTEXT"
else
  echo "   Context: (current)"
fi
echo "   Dry Run: $DRY_RUN"
echo ""

# Confirmation
if [[ "$DRY_RUN" == "false" ]]; then
  echo -e "${YELLOW}⚠️  This will create/update secrets in your Kubernetes cluster.${NC}"
  echo -e "${YELLOW}   Existing secrets will be replaced!${NC}"
  echo ""
  read -p "Continue? (yes/no): " -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${RED}Cancelled by user.${NC}"
    exit 0
  fi
fi

echo -e "${BLUE}🔐 Generating secure credentials...${NC}"
echo ""

# 1. PostgreSQL Credentials
DB_NAME="deuseda_console"
DB_USER="deuseda"
DB_PASSWORD=$(openssl rand -base64 32)
echo -e "${GREEN}✓${NC} PostgreSQL credentials generated"

# 2. Backend Secrets
JWT_SECRET=$(openssl rand -base64 64)
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@prod-deuseda-postgres:5432/${DB_NAME}"
echo -e "${GREEN}✓${NC} Backend secrets generated"

echo ""
echo -e "${BLUE}📦 Creating Kubernetes secrets...${NC}"
echo ""

# Create namespace if it doesn't exist
if [[ "$DRY_RUN" == "false" ]]; then
  kubectl create namespace "$NAMESPACE" $CONTEXT_FLAG --dry-run=client -o yaml | kubectl apply -f - $CONTEXT_FLAG
  echo -e "${GREEN}✓${NC} Namespace '$NAMESPACE' ready"
else
  echo -e "${YELLOW}[DRY RUN]${NC} kubectl create namespace $NAMESPACE"
fi

# 1. postgres-secret
echo ""
echo -e "${BLUE}Creating postgres-secret...${NC}"
if [[ "$DRY_RUN" == "false" ]]; then
  kubectl create secret generic postgres-secret \
    --from-literal=database="$DB_NAME" \
    --from-literal=username="$DB_USER" \
    --from-literal=password="$DB_PASSWORD" \
    --namespace="$NAMESPACE" \
    $CONTEXT_FLAG \
    --dry-run=client -o yaml | kubectl apply -f - $CONTEXT_FLAG
  echo -e "${GREEN}✓${NC} postgres-secret created"
else
  echo -e "${YELLOW}[DRY RUN]${NC} kubectl create secret generic postgres-secret"
  echo "   database: $DB_NAME"
  echo "   username: $DB_USER"
  echo "   password: (generated)"
fi

# 2. backend-secret
echo ""
echo -e "${BLUE}Creating backend-secret...${NC}"
if [[ "$DRY_RUN" == "false" ]]; then
  kubectl create secret generic backend-secret \
    --from-literal=database-url="$DATABASE_URL" \
    --from-literal=jwt-secret="$JWT_SECRET" \
    --namespace="$NAMESPACE" \
    $CONTEXT_FLAG \
    --dry-run=client -o yaml | kubectl apply -f - $CONTEXT_FLAG
  echo -e "${GREEN}✓${NC} backend-secret created"
else
  echo -e "${YELLOW}[DRY RUN]${NC} kubectl create secret generic backend-secret"
  echo "   database-url: (generated)"
  echo "   jwt-secret: (generated)"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}   ✅ All secrets created successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [[ "$DRY_RUN" == "false" ]]; then
  echo -e "${YELLOW}⚠️  IMPORTANT: Save these credentials securely!${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Database Credentials:"
  echo "  Name:     $DB_NAME"
  echo "  User:     $DB_USER"
  echo "  Password: $DB_PASSWORD"
  echo ""
  echo "Backend Secrets:"
  echo "  JWT Secret:   $JWT_SECRET"
  echo "  Database URL: $DATABASE_URL"
  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "${RED}💾 Store these in your password manager and clear your terminal history!${NC}"
  echo ""
  echo "To clear bash history:"
  echo "  history -c && history -w"
  echo ""
fi

echo -e "${BLUE}📋 Next Steps:${NC}"
echo ""
echo "1. Create ghcr-secret for image pulling:"
echo "   kubectl create secret docker-registry ghcr-secret \\"
echo "     --docker-server=ghcr.io \\"
echo "     --docker-username=YOUR_GITHUB_USERNAME \\"
echo "     --docker-password=YOUR_GITHUB_PAT \\"
echo "     --namespace=$NAMESPACE"
echo ""
echo "2. Deploy the application:"
echo "   kubectl apply -k k8s/overlays/production"
echo ""
echo "3. Verify deployment:"
echo "   kubectl get pods -n $NAMESPACE"
echo "   kubectl logs -n $NAMESPACE deployment/prod-backend"
echo ""
echo -e "${GREEN}Done! 🎉${NC}"
