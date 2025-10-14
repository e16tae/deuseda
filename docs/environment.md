# Deuseda | Secrets & Environment

## 1. GitHub Secrets
Actions 워크플로(`.github/workflows/cd-production.yaml`)는 기본 `GITHUB_TOKEN`으로 이미지를 푸시합니다. 추가 기능이 필요할 때만 저장소 **Settings → Secrets and variables → Actions** 에 값을 추가하세요.

| 키 | 용도 |
| --- | --- |
| `ARGOCD_SERVER` (선택) | 자동 배포를 위해 ArgoCD 서버 주소 전달 |
| `ARGOCD_TOKEN` (선택) | `argocd account generate-token` 으로 발급한 토큰 |
| `GH_PAT` (선택) | 보호된 브랜치에 워크플로가 푸시해야 할 때 사용 |

## 2. Kubernetes Sealed Secrets
Backend/DB 자격 증명은 SealedSecret으로 관리합니다.

### backend-secret
```bash
./scripts/seal-secrets.sh \
  --env-file .env.backend-secret \
  --name backend-secret \
  --namespace deuseda \
  --out k8s/sealed-secrets/backend-secret.sealedsecret.yaml
```
`.env.backend-secret` 예시:
```bash
DATABASE_URL=postgres://deuseda:CHANGE_ME@postgres:5432/deuseda_console
JWT_SECRET=CHANGE_ME_RANDOM_64_CHARS
```

### postgres-secret
```bash
./scripts/seal-secrets.sh \
  --env-file .env.postgres-secret \
  --name postgres-secret \
  --namespace deuseda \
  --out k8s/sealed-secrets/postgres-secret.sealedsecret.yaml
```
`.env.postgres-secret` 예시:
```bash
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD
```

생성된 `k8s/sealed-secrets/*.sealedsecret.yaml` 파일을 커밋하면 ArgoCD가 자동으로 Secret을 생성합니다.

## 3. 기타 시크릿
- GHCR Pull Secret: `kubectl create secret docker-registry ghcr-secret ...`
- TLS Secret: `kubectl create secret tls deuseda-wildcard-tls ...` 또는 cert-manager Certificate

## 4. 검증 체크리스트
1. 컨트롤러 확인: `kubectl get pods -n kube-system | grep sealed`
2. SealedSecret 적용: `kubectl apply -k k8s/sealed-secrets`
3. Secret 생성 확인: `kubectl get secret -n deuseda backend-secret`
4. GitHub Secrets 등록 여부 확인
