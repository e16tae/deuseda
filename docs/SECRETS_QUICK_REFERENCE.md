# Secrets Quick Reference

빠른 참조를 위한 환경변수 및 Secret 요약 문서입니다.

## 📋 빠른 체크리스트

### Kubernetes Secrets (프로덕션 환경)

```bash
# 1. PostgreSQL Secret 생성
POSTGRES_PASSWORD=$(openssl rand -base64 32)
kubectl create secret generic postgres-secret \
  --from-literal=database='deuseda_console' \
  --from-literal=username='deuseda' \
  --from-literal=password="$POSTGRES_PASSWORD" \
  -n deuseda

# 2. Backend Secret 생성
JWT_SECRET=$(openssl rand -base64 64)
kubectl create secret generic backend-secret \
  --from-literal=database-url="postgresql://deuseda:$POSTGRES_PASSWORD@prod-deuseda-postgres:5432/deuseda_console" \
  --from-literal=jwt-secret="$JWT_SECRET" \
  -n deuseda

# 3. Secret 확인
kubectl get secrets -n deuseda
```

### GitHub Actions Secrets 설정

Repository Settings → Secrets and variables → Actions에서 추가:

| Secret Name | 설명 | 생성 방법 |
|-------------|------|----------|
| `GH_PAT` | GitHub Personal Access Token | GitHub Settings → Developer settings → Tokens (classic) |
| `ARGOCD_SERVER` | ArgoCD 서버 주소 | 예: `argocd.deuseda.com` (https:// 제외) |
| `ARGOCD_TOKEN` | ArgoCD 인증 토큰 | `argocd account generate-token --account github-actions` |

---

## 🔐 Secret 구조

### K8s Secret: `postgres-secret`
```yaml
database: "deuseda_console"
username: "deuseda"
password: "<openssl rand -base64 32>"
```

### K8s Secret: `backend-secret`
```yaml
database-url: "postgresql://user:password@host:port/database"
jwt-secret: "<openssl rand -base64 64>"
```

### K8s ConfigMap: `app-config`
```yaml
# 주요 설정만 표시
SERVER_HOST: "0.0.0.0"
SERVER_PORT: "8080"
DB_HOST: "deuseda-postgres"
API_URL: "https://api.deuseda.com"
RUST_LOG: "info,deuseda_console=debug"
```

---

## 🚀 환경별 설정 차이

### Development (`k8s/overlays/dev`)
- Replicas: 1
- HTTP 허용
- Rate limiting 비활성화
- 이미지 태그: `develop`
- 도메인: `dev.www.deuseda.com`, `dev.api.deuseda.com`

### Production (`k8s/overlays/production`)
- Replicas: 3
- HTTPS 강제
- Rate limiting 활성화 (200/분, 10000/시간)
- 이미지 태그: `main-<sha>`
- 도메인: `www.deuseda.com`, `api.deuseda.com`
- Resource limits 높음

---

## ⚠️ 보안 주의사항

### 절대 금지 ❌
- ❌ 프로덕션 Secret을 Git에 커밋
- ❌ 평문 패스워드 사용
- ❌ 짧거나 예측 가능한 Secret
- ❌ Secret을 로그에 출력
- ❌ Secret을 환경변수로 노출

### 반드시 실행 ✅
- ✅ 암호화된 랜덤 값 사용
- ✅ 90일마다 Secret 로테이션
- ✅ Sealed Secrets 또는 External Secrets 사용
- ✅ RBAC로 Secret 접근 제한
- ✅ Secret 감사 로그 활성화

---

## 🔄 Secret 로테이션 절차

### 1. Database Password
```bash
# 새 패스워드 생성
NEW_PW=$(openssl rand -base64 32)

# PostgreSQL 업데이트
kubectl exec -it prod-deuseda-postgres-0 -n deuseda -- \
  psql -U postgres -c "ALTER USER deuseda WITH PASSWORD '$NEW_PW';"

# K8s Secret 업데이트
kubectl patch secret postgres-secret -n deuseda \
  -p "{\"data\":{\"password\":\"$(echo -n $NEW_PW | base64)\"}}"

kubectl patch secret backend-secret -n deuseda \
  -p "{\"data\":{\"database-url\":\"$(echo -n "postgresql://deuseda:$NEW_PW@prod-deuseda-postgres:5432/deuseda_console" | base64)\"}}"

# Pod 재시작
kubectl rollout restart deployment/prod-deuseda-backend -n deuseda
```

### 2. JWT Secret
```bash
# 새 JWT Secret 생성
NEW_JWT=$(openssl rand -base64 64)

# K8s Secret 업데이트
kubectl patch secret backend-secret -n deuseda \
  -p "{\"data\":{\"jwt-secret\":\"$(echo -n $NEW_JWT | base64)\"}}"

# Pod 재시작 (모든 사용자 재로그인 필요)
kubectl rollout restart deployment/prod-deuseda-backend -n deuseda
```

---

## 🧪 테스트 및 검증

```bash
# 1. Secret 존재 확인
kubectl get secrets -n deuseda

# 2. ConfigMap 확인
kubectl describe configmap app-config -n deuseda

# 3. Pod 환경변수 확인
kubectl exec -it pod/prod-deuseda-backend-xxx -n deuseda -- env | grep -E '(DATABASE|JWT|SERVER)'

# 4. Database 연결 테스트
kubectl exec -it prod-deuseda-postgres-0 -n deuseda -- \
  psql -U deuseda -d deuseda_console -c "SELECT version();"

# 5. Backend 헬스체크
kubectl exec -it pod/prod-deuseda-backend-xxx -n deuseda -- \
  curl -f http://localhost:8080/health

# 6. ArgoCD sync 테스트
argocd app sync deuseda-production --dry-run
```

---

## 📊 Secret 크기 가이드

| Secret Type | Minimum Bits | Recommended Command |
|-------------|--------------|---------------------|
| Database Password | 256 bits | `openssl rand -base64 32` |
| JWT Secret | 512 bits | `openssl rand -base64 64` |
| API Keys | 256 bits | `openssl rand -base64 32` |
| Encryption Keys | 256 bits | `openssl rand -base64 32` |

---

## 🔗 관련 문서

- [전체 환경변수 가이드](./ENVIRONMENT_VARIABLES.md)
- [Kubernetes 배포 가이드](../k8s/README.md)
- [CI/CD 설정 가이드](../.github/workflows/README.md)

---

## 🆘 문제 해결

### Secret not found
```bash
kubectl get secrets -n deuseda
# 없으면 생성: 위의 체크리스트 참조
```

### Database connection failed
```bash
# DATABASE_URL 확인
kubectl get secret backend-secret -n deuseda -o jsonpath='{.data.database-url}' | base64 -d

# PostgreSQL 상태 확인
kubectl logs statefulset/prod-deuseda-postgres -n deuseda
```

### JWT authentication failed
```bash
# JWT_SECRET 길이 확인 (>= 32 bytes)
kubectl get secret backend-secret -n deuseda -o jsonpath='{.data.jwt-secret}' | base64 -d | wc -c
```

### ArgoCD sync failed
```bash
# GitHub Secrets 확인
gh secret list

# ArgoCD 연결 테스트
argocd app list
```
