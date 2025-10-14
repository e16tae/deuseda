# Deuseda | Environment & Configuration

원격 SSH 콘솔 서비스를 배포하려면 백엔드, 프런트엔드, 인프라에 필요한 환경 변수를 정확히 설정해야 합니다. 이 문서는 환경 변수 템플릿, 시크릿 분리, 값 검증 방법을 설명합니다.

## 구성 파일

| 위치 | 설명 |
| ---- | ---- |
| `.env.example` | 공통 인프라/도메인 변수 템플릿 (루트) |
| `.env` | Docker Compose 및 CI에서 사용하는 실환경 값 (git-ignored) |
| `backend/.env.example` | 백엔드 로컬 개발 템플릿 |
| `frontend/.env.example` | 프런트엔드 로컬 개발 템플릿 |
| `k8s/base/secret.example.yaml` | Kubernetes Secret 예시 (git-ignored) |

```bash
# 초기 설정
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## 루트 환경 변수 (`.env`)

### 1. 도메인 & URL
```bash
APEX_DOMAIN=example.com
FRONTEND_DOMAIN=www.example.com
BACKEND_DOMAIN=api.example.com
WILDCARD_DOMAIN=*.example.com

FRONTEND_URL=https://www.example.com
API_URL=https://api.example.com
WS_URL=wss://api.example.com/ws
```
- Ingress, CORS, 프런트엔드 API 클라이언트에서 사용됩니다.
- `WS_URL`은 WebSocket 터미널 연결용입니다.

### 2. 데이터베이스
```bash
DB_NAME=deuseda_console
DB_USER=deuseda
DB_PASSWORD=CHANGE_ME_STRONG_PASSWORD
DB_HOST=postgres
DB_PORT=5432
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}
```
- 프로덕션에서는 32바이트 이상 무작위 문자열을 사용합니다.  
  `openssl rand -base64 32` 로 생성하세요.

### 3. 인증 & 보안
```bash
JWT_SECRET=CHANGE_ME_RANDOM_BASE64_64
JWT_EXPIRATION=86400
```
- 64바이트 이상의 고정 길이 문자열을 사용하세요.  
  `openssl rand -base64 64` 권장.

### 4. GitHub Container Registry
```bash
CONTAINER_REGISTRY=ghcr.io
GITHUB_ORG=your-account
GITHUB_REPO=deuseda
BACKEND_IMAGE=${CONTAINER_REGISTRY}/${GITHUB_ORG}/deuseda-backend
FRONTEND_IMAGE=${CONTAINER_REGISTRY}/${GITHUB_ORG}/deuseda-frontend
```
- GitHub Actions에서 이미지 태그 생성에 사용됩니다.

### 5. Kubernetes & ArgoCD
```bash
K8S_NAMESPACE=deuseda
RESOURCE_NAME_PREFIX=prod-
TLS_SECRET_WILDCARD=deuseda-wildcard-tls
TLS_SECRET_NAKED=deuseda-naked-tls
INGRESS_NAME=deuseda-ingress
ARGOCD_APP_NAME=deuseda-production
ARGOCD_REPO_URL=https://github.com/${GITHUB_ORG}/${GITHUB_REPO}.git
ARGOCD_TARGET_REVISION=main
ARGOCD_SERVER=argocd.example.com
```
- GitOps 환경에서 애플리케이션 동기화에 사용됩니다.

## 백엔드 환경 (`backend/.env`)

```bash
DATABASE_URL=postgres://deuseda:password@localhost:5432/deuseda_console
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
RUST_LOG=info,deuseda_console=debug
JWT_SECRET=change-me-in-production
SSH_HOST=ssh.example.com
SSH_PORT=22
```
- 프로덕션에서는 `.env` 대신 Kubernetes Secret을 사용합니다.
- `SSH_HOST`는 브라우저 터미널이 접속할 원격 SSH 호스트입니다.

## 프런트엔드 환경 (`frontend/.env`)

```bash
# 로컬 개발
VITE_API_BASE_URL=http://localhost:8080

# 프로덕션에 배포할 때
# VITE_API_BASE_URL=https://api.example.com
```
- CI/CD 파이프라인에서 `VITE_API_BASE_URL`을 주입하여 정적 자산을 생성합니다.

## Kubernetes Secrets

### Sealed Secrets 권장 워크플로
1. `k8s/base/secret-template.yaml` 또는 `secret.example.yaml`을 복사해 실제 값으로 채웁니다.
2. `./scripts/seal-secrets.sh` 실행
   ```bash
   # PostgreSQL 비밀번호를 env 파일에서 읽어 암호화
   ./scripts/seal-secrets.sh \\
     --env-file .env.postgres \\
     --name postgres-secret \\
     --namespace deuseda \\
     --out k8s/sealed-secrets/postgres-secret.sealedsecret.yaml

   # Secret manifest를 직접 암호화 (단일 문서)
   ./scripts/seal-secrets.sh \\
     --manifest k8s/base/secret-template.yaml \\
     --out k8s/sealed-secrets/backend-secret.sealedsecret.yaml
   ```
3. 생성된 `k8s/sealed-secrets/*.sealedsecret.yaml` 파일을 커밋하여 ArgoCD가 적용하도록 합니다.

### 기타 Secrets
- GHCR Pull Secret: `kubectl create secret docker-registry ghcr-secret ...`
- TLS certificates: `kubectl create secret tls deuseda-wildcard-tls ...` 또는 cert-manager 사용
- 백업용 Cloudflare R2 자격 증명 등은 별도 SealedSecret으로 관리합니다.

## GitHub Secrets

| 이름 | 설명 |
| ---- | ---- |
| `GH_PAT` | GHCR 이미지 푸시 & 매니페스트 업데이트용 PAT |
| `ARGOCD_SERVER` | ArgoCD API 엔드포인트 |
| `ARGOCD_TOKEN` | `argocd account generate-token` 으로 발급한 토큰 |
| `SSH_KNOWN_HOSTS` (선택) | 배포 중 SSH 검증이 필요한 경우 |

## 검증 체크리스트

1. `.env`, `backend/.env`, `frontend/.env` 파일이 git에 커밋되지 않았는지 확인합니다.
2. Docker Compose로 로컬 환경을 부팅해 인증, SSH 연결, tmux 세션이 정상 작동하는지 점검합니다.
3. `npm run build` (프런트), `cargo test` (백엔드) 실행 후 환경 변수 누락 경고가 없는지 확인합니다.
4. Kubernetes Secret이 생성되었고 ArgoCD에서 `Healthy/Synced` 상태인지 확인합니다.

## 문제 해결

- **웹소켓 접속 실패**: `WS_URL`과 Ingress 설정이 일치하는지 확인합니다.
- **SSH 연결 실패**: `SSH_HOST`, 방화벽, authorized_keys 설정을 점검합니다.
- **JWT 문제**: 프런트/백엔드에서 동일한 `JWT_SECRET`을 사용하고 있는지 확인합니다.
- **데이터베이스 연결 오류**: `DATABASE_URL` 문자열, 포트, 네임스페이스를 다시 확인합니다.
