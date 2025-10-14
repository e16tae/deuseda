# Deuseda | Deployment Guide

이 문서는 원격 SSH 콘솔 서비스를 Docker Compose 또는 Kubernetes + ArgoCD 환경에 배포하는 절차를 설명합니다. 기본 설정은 GHCR, Kong Gateway, cert-manager를 사용하는 프로덕션 구성을 가정합니다.

## 시스템 아키텍처

```
develop → GitHub Actions CI (lint, cargo test, frontend build)
   ↓
main → GitHub Actions CD (Docker build & push, kustomize patch)
   ↓
ArgoCD → Kubernetes (backend, frontend, postgres, tmux worker)
   ↓
Kong Gateway → https://www.example.com (Web UI) / wss://api.example.com/ws (terminal)
```

## 배포 옵션

| 옵션 | 용도 | 특징 |
| ---- | ---- | ---- |
| Docker Compose (`docker-compose.yml`) | 로컬 개발, 데모 | 단일 노드, 빠른 부팅 |
| Kubernetes (`k8s/overlays/production`) | 프로덕션 | 확장성, GitOps, TLS, 백업 |

## 사전 준비

1. **레지스트리 권한**: GHCR PAT 발급 (`repo`, `write:packages`)
2. **Kubernetes**: 1.25+, Kong Ingress Controller, cert-manager(선택), StorageClass
3. **ArgoCD**: 프로젝트 생성 및 `argocd` CLI 접속 권한
4. **도메인**: `www`, `api`, `*.example.com` 을 Ingress Controller로 포인팅
5. **Secrets**: [환경 구성 문서](./environment.md)를 따라 `.env` 작성 후 `./scripts/seal-secrets.sh`로 SealedSecret을 생성·커밋하고, GHCR Pull Secret/TLS도 준비

## 로컬 개발 (Docker Compose)

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

docker-compose up -d
docker-compose logs -f
```

- 웹 UI: http://localhost  
- API: http://localhost:8080  
- PostgreSQL: localhost:5432 (`deuseda/deuseda_console`)
- tmux 세션은 컨테이너 내부에서 자동으로 관리됩니다.

## GitHub Actions 파이프라인

워크플로 파일: `.github/workflows/cd-production.yaml`

| 단계 | 설명 |
| ---- | ---- |
| `lint-and-test` | `cargo fmt`, `cargo clippy`, `cargo test`, `npm run lint`, `npm run build` |
| `build-and-push` | Backend/Frontend Docker 이미지를 빌드 후 GHCR에 푸시 |
| `update-manifests` | `k8s/overlays/production/kustomization.yaml` 이미지 태그 갱신 |
| `trigger-argocd` | ArgoCD 애플리케이션 동기화 (토큰이 존재할 때) |

필수 GitHub Secrets: `GH_PAT`, `ARGOCD_SERVER`, `ARGOCD_TOKEN`

## ArgoCD 구성

`argocd/deuseda-production.yaml` 예시:
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: deuseda-production
  namespace: argocd
spec:
  source:
    repoURL: https://github.com/YOUR_ORG/deuseda.git
    targetRevision: main
    path: k8s/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: deuseda
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

```bash
kubectl apply -f argocd/deuseda-production.yaml
argocd app sync deuseda-production
```

## Kubernetes 배포

1. Sealed Secrets 적용  
   ```bash
   # 스크립트로 생성한 SealedSecret을 커밋한 뒤
   kubectl apply -k k8s/sealed-secrets
   kubectl create secret docker-registry ghcr-secret ...  # GHCR 인증
   ```
2. TLS 인증서 (택1)
   - cert-manager:
     ```bash
     kubectl apply -f k8s/cert-manager/cluster-issuer.yaml
     kubectl get certificate -n deuseda -w
     ```
   - 수동 Secret:
     ```bash
     kubectl create secret tls deuseda-wildcard-tls \
       --cert=/path/to/fullchain.pem \
       --key=/path/to/privkey.pem \
       --namespace=deuseda
     ```
3. 오버레이 배포  
   ```bash
   kubectl apply -k k8s/overlays/production
   ```
4. 상태 확인  
   ```bash
   kubectl get pods,svc,ingress -n deuseda
   ```

## 검증 절차

1. `kubectl get pods -n deuseda` → 모든 파드가 `Ready` 상태인지 확인
2. 브라우저에서 `https://www.example.com` 접근, 로그인/터미널 기능 테스트
3. SSH/tmux 세션이 유지되는지 확인 (`scripts/test_ssh_auth.sh`)
4. `curl -k https://api.example.com/health` 로 API 헬스 엔드포인트 확인
5. ArgoCD UI에서 애플리케이션이 `Healthy/Synced`인지 점검

## 비상 대응

- **배포 롤백**:  
  ```bash
  kubectl rollout undo deployment/prod-backend -n deuseda
  kubectl rollout undo deployment/prod-frontend -n deuseda
  ```
- **세션 초기화**:  
  ```bash
  kubectl exec -it statefulset/prod-tmux -n deuseda -- tmux kill-server
  ```
- **이미지 강제 교체**:  
  ```bash
  kubectl set image deployment/prod-backend backend=ghcr.io/YOUR_ORG/deuseda-backend:manual -n deuseda
  ```

## 트러블슈팅

| 증상 | 원인 | 해결 방법 |
| ---- | ---- | -------- |
| `ImagePullBackOff` | GHCR 인증 실패 | `kubectl create secret docker-registry ghcr-secret ...` 다시 생성 |
| WebSocket 101 실패 | Ingress 라우팅 or WS_URL 불일치 | `WS_URL`, Kong 설정, TLS 업스트림 확인 |
| SSH 로그인 거부 | authorized_keys 미등록 | 배포 대상 서버의 SSH 키 설정 확인 |
| tmux 세션이 바로 종료 | `SESSION_TIMEOUT` 값 또는 권한 문제 | 백엔드 로그(`kubectl logs deployment/prod-backend`) 확인 |

## 리소스 정리

```bash
kubectl delete application deuseda-production -n argocd
kubectl delete namespace deuseda
docker-compose down -v  # 로컬 환경 정리
```
