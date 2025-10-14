# Deuseda | Engineering Workflow

이 문서는 저장소 관리, 브랜치 전략, 코드 리뷰 규칙, 자동화 파이프라인을 명확히 하기 위한 개발자 가이드입니다.

## 브랜치 전략

```
develop ──┬── feature/<topic>
          └── agent/<issue-id>
             (자동화 에이전트 작업)
   │
   └── CI (lint/test)
main ── CD (Docker build, kustomize, ArgoCD)
```

- **develop**: 기능 개발 및 통합 테스트. 모든 변경은 PR을 거쳐 머지합니다.
- **feature/**: 사람이 수행하는 기능·버그 작업용 브랜치입니다.
- **agent/**: 자동화 에이전트가 수행하는 작업용 브랜치입니다. 형식은 `agent/<issue-id>-<slug>`를 사용합니다.
- **main**: 프로덕션 배포 전용. `main`에 push되면 CD 파이프라인이 자동으로 실행됩니다.

## 자동화 에이전트 협업 흐름

1. **이슈 준비**
   - 작업 요구 사항을 Issue에 정리하고 `automation-ready` 라벨을 부여합니다.
   - 필요한 레퍼런스(예: API 사양, 디자인)를 첨부합니다.

2. **브랜치 생성**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b agent/321-add-session-metrics
   ```
   - 에이전트 또는 담당자는 해당 브랜치에서 작업합니다.
   - 사람이 보완할 내용이 있으면 같은 브랜치에 커밋을 이어서 작성합니다.

3. **작업 및 검증**
   - 백엔드: `cargo fmt --check`, `cargo clippy --all-targets`, `cargo test`
   - 프런트엔드: `npm run lint`, `npm run build`
   - 실행 결과와 로그를 Issue/PR에 첨부합니다.

4. **PR 생성**
   - 제목 예시: `feat: track session reconnect metrics`
   - 본문에 실행한 명령어, 테스트 결과, 알려진 한계점을 정리합니다.

5. **사람 검수**
   - 코드를 검토하고 필요한 경우 직접 커밋을 추가합니다.
   - 모든 검증이 끝나면 PR을 승인합니다.

6. **develop 병합 및 정리**
   ```bash
   git checkout develop
   git merge --no-ff agent/321-add-session-metrics
   git push origin develop
   ```
   - 완료 후 에이전트 브랜치는 제거합니다.

7. **main 릴리스**
   - main으로 PR을 열어 승인 후 merge하면 자동 배포가 진행됩니다.

> 자동화 에이전트 커밋이라도 사람 검토·테스트 없이 main에 병합하지 않습니다.

## 업무 흐름

1. 브랜치 생성  
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feat/<description>
   ```
2. 개발 및 로컬 검증  
   - 백엔드: `cargo fmt --check`, `cargo clippy --all-targets`, `cargo test`
   - 프런트엔드: `npm run lint`, `npm run build`
   - 통합: `docker-compose up --build`
3. 커밋  
   ```bash
   git commit -m "feat(terminal): reconnect on ws drop"
   ```
4. PR 생성 → 리뷰 → develop 머지
5. main에 릴리스  
   ```bash
   git checkout main
   git merge --ff-only develop
   git push origin main
   ```
6. 배포 확인 후 develop을 main과 동기화

## 커밋 메시지 컨벤션

| type | 설명 |
| ---- | ---- |
| `feat` | 기능 추가 |
| `fix` | 버그 수정 |
| `chore` | 빌드, 의존성, 설정 등 |
| `refactor` | 동작 동일, 구조 개선 |
| `docs` | 문서 |
| `test` | 테스트 코드 추가/수정 |

예: `fix(auth): prevent expired totp reuse`

## GitHub Actions

워크플로: `.github/workflows/cd-production.yaml`

- `lint-and-test`: cargo fmt, clippy, test / npm lint, build
- `build-and-push`: Backend/Frontend Docker 이미지를 태그(`main-<sha>`, `latest`)와 함께 GHCR에 업로드
- `update-manifests`: `k8s/overlays/production/kustomization.yaml`의 이미지 태그 갱신 후 `[skip ci]` 커밋
- `trigger-argocd`: ArgoCD 앱 동기화 (`ARGOCD_*` 시크릿 필요)

CI 실패 시, 수정 후 동일 브랜치로 다시 push하면 됩니다. CD 실패 시 ArgoCD 로그와 GitHub Actions 로그를 함께 확인합니다.

## 코드 리뷰 체크리스트

- 민감 정보가 하드코딩되어 있지 않은가?
- SSH 인증, JWT 만료 등 보안에 영향이 있는 코드는 테스트가 포함되어 있는가?
- 프런트엔드에서 API URL이 `.env` 값과 일치하는가?
- Rust async 핸들러에서 에러가 삼켜지지 않는가?
- 타입/ESLint 경고가 없는가?
- 에이전트가 제공한 테스트 로그와 실행 방법이 충분한가?

## 배포 후 확인

1. GitHub Actions가 성공했는지 확인
2. ArgoCD 애플리케이션 상태가 `Healthy/Synced`인지 확인
3. `https://www.example.com` 접속 후 로그인 → 터미널 세션 생성 → 재접속 테스트
4. `kubectl logs -n deuseda deployment/prod-backend` 로 에러 로그 확인
5. 백업/감시 도구가 알림을 정상 전송하는지 점검

## 주기적 유지보수

- **주간**: SSH 서버 로그 검토, tmux 세션 누수 확인, Docker 이미지 취약점 스캔
- **월간**: JWT Secret 로테이션, PostgreSQL 백업 복원 테스트
- **분기**: 도메인/TLS 갱신, CI/CD 시크릿 검토, 사용자 감사 로그 확인
