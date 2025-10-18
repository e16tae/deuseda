# Deuseda — Remote SSH Console Platform

브라우저에서 SSH 터미널을 제공하는 풀스택 템플릿입니다. 직접 운영 중인 Linux 서버의 계정을 기반으로 로그인하고, tmux를 통해 세션을 유지하며, Kubernetes + ArgoCD로 배포할 수 있도록 구성되어 있습니다.

## 주요 기능
- SSH 자격 증명을 이용한 1차 인증 (비밀번호 저장 없음)
- 옵션형 2단계 인증(예: TOTP) 확장 가능 구조
- 다중 터미널 세션 및 탭 기반 UI
- **tmux 기반 세션 지속성** - 사용자의 실제 tmux 세션과 완전 동기화
- WebSocket 스트리밍을 통한 실시간 입출력
- 웹 UI와 SSH 터미널 간 세션 공유 (동일한 tmux 세션 접근)

## 기술 스택
- **Backend**: Rust, Axum, Tokio (Stateless JWT 기반)
- **Session Management**: tmux (사용자 SSH 서버의 실제 tmux 세션 활용)
- **Frontend**: React 19, TypeScript, Vite, xterm.js, Tailwind CSS
- **Infrastructure**: Docker Compose, Kubernetes, ArgoCD, Kong Gateway, GHCR

## 저장소 구조
```
backend/      Rust API 서버 (SSH 인증, 세션 관리)
frontend/     React 터미널 UI
docs/         환경, 배포, 운영, 보안 가이드
k8s/          Kubernetes 매니페스트 (base/overlays)
argocd/       ArgoCD 애플리케이션 정의
scripts/      시크릿 생성, 백업, 헬스체크 스크립트
```

## 빠른 시작

### 1. 요구 사항
- Docker & Docker Compose
- Rust 1.83+, Node.js 20+, npm 10+ (로컬 개발 시)

### 2. 환경 변수 준비
```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
필수 변수 및 보안 설정은 `docs/environment.md`를 참고하세요.

### 3. Docker Compose 실행
```bash
docker-compose up -d
docker-compose logs -f
```
- Frontend: http://localhost  
- API: http://localhost:8080  
- SSH 테스트: `./test_ssh_auth.sh`

### 4. 로컬 개발 모드
```bash
# Backend
cd backend
cargo fmt && cargo clippy --all-targets && cargo test
cargo run

# Frontend
cd frontend
npm install
npm run dev
```

## 배포 개요
- GitHub Actions가 main 브랜치에 push될 때 백엔드/프런트엔드 Docker 이미지를 빌드하고 GHCR에 업로드합니다.
- 워크플로가 `k8s/overlays/production` 이미지 태그를 업데이트하면 ArgoCD가 Kubernetes에 배포합니다.
- TLS는 cert-manager(권장) 또는 수동 Secret로 관리할 수 있습니다.
- 상세 절차는 `docs/deployment.md`를 참고하세요.

## 문서
- `docs/environment.md` – 환경 변수 및 시크릿 구성
- `docs/deployment.md` – CI/CD, Kubernetes, ArgoCD 배포 가이드
- `docs/workflow.md` – 브랜치 전략, 테스트, 코드 리뷰 정책
- `docs/operations.md` – SSH 계정 운영, tmux 세션 관리, 백업 절차
- `docs/security.md` – 비밀 관리, 공개 전 점검표, 사고 대응

## 유지보수 팁
- SSH 서버 보안 정책(패스워드 정책, Fail2ban 등)을 정기적으로 점검하세요.
- `cargo audit`, `npm audit`을 주기적으로 실행하여 취약점을 확인합니다.
- 저장소를 새롭게 공개할 때는 `reset-git-history.sh` 스크립트로 깔끔한 초기 커밋을 준비하세요.
- 자동화 에이전트가 수행한 작업은 `agent/<issue-id>-slug` 브랜치에서 검토 후 develop/main에 병합합니다.
- 환경 변수는 `./scripts/seal-secrets.sh`로 암호화한 뒤 `k8s/sealed-secrets/`에 커밋해 GitOps 파이프라인에서 관리합니다.
