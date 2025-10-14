# Deuseda | Security & Public Release

원격 SSH 콘솔 서비스는 외부 인프라와 민감한 시스템 계정을 다루므로, 강력한 보안 정책과 공개 저장소 운영 수칙이 필요합니다.

## 1. 보안 이슈 대응
- 잠재적 취약점을 발견하면 GitHub Security Advisory 또는 비공개 채널을 통해 보고합니다.
- 보고 시 영향 범위, 재현 절차, 임시 완화 방법을 포함합니다.

## 2. 비밀 정보 관리
- `.env`, `backend/.env`, `frontend/.env`, `k8s/**/secrets.yaml`은 git-ignored 상태를 유지합니다.
- 실 운영 값은 Secret Manager, Kubernetes Secret, GitHub Actions Secrets에 저장합니다.
- 비밀 값 로테이션 주기:
  - JWT Secret: 90일
  - PostgreSQL 비밀번호: 180일
  - GHCR PAT: 90일
- 노출 사고 발생 시 즉시 자격 증명을 회수하고, `reset-git-history.sh`로 히스토리를 정리합니다.

### GitHub Actions Secrets
| 이름 | 설명 |
| ---- | ---- |
| `GH_PAT` | GHCR push, manifest 업데이트용 PAT |
| `ARGOCD_SERVER` | ArgoCD API URL |
| `ARGOCD_TOKEN` | `argocd account generate-token` 으로 발급한 토큰 |
| (선택) `SLACK_WEBHOOK_URL` | 배포 및 장애 알림 |

### Kubernetes Secrets
| 이름 | 용도 |
| ---- | ---- |
| `postgres-secret` | PostgreSQL 비밀번호 |
| `backend-secret` | DB URL, JWT Secret |
| `ghcr-secret` | GitHub Container Registry pull |
| `deuseda-wildcard-tls` | `*.example.com` TLS |
| `r2-credentials` (선택) | Cloudflare R2 백업 자격 증명 |

## 3. SSH & 인증 보안
- 백엔드가 SSH 서버에 직접 접속하므로 대상 서버는 MFA, Fail2ban, 포트 제한 등 기본 보안 구성이 필요합니다.
- 패스워드 인증을 사용하되, 내부 사용자만 접근 가능하도록 방화벽/IP 제한을 적용합니다.
- SSH 서버 로그와 애플리케이션 로그인 로그를 비교해 이상 행동을 탐지합니다.
- JWT 만료, IP/브라우저 Fingerprint 검사 등 2차 검증 매커니즘을 도입할 수 있습니다.

## 4. TLS/네트워크 보안
- TLS는 cert-manager(권장) 또는 수동 Secret로 관리합니다.
- Kong Ingress에서 Rate Limit, Bot Detection 플러그인을 설정해 무차별 대입을 차단합니다.
- WebSocket 경로(`/ws`)에 대한 QoS 및 Idle Timeout을 모니터링합니다.

## 5. 공개 전 점검표

- [ ] 문서, 코드, 커밋 메시지에 실 운영 정보가 포함되어 있지 않다.
- [ ] `.env.example`, `backend/.env.example`, `frontend/.env.example` 의 모든 값은 플레이스홀더로 교체되어 있다.
- [ ] GitHub Actions 로그에 비밀 정보가 출력되지 않는다.
- [ ] Docker 이미지에 SSH 자격 증명/토큰이 baked-in 되어 있지 않다.
- [ ] `npm run lint`, `cargo fmt --check`, `cargo test`, `npm run build`가 성공한다.
- [ ] README와 `docs/` 문서가 최신 상태이며 필수 설정을 명확히 안내한다.

## 6. 의존성 & 취약점 관리

- Rust: `cargo audit`, `cargo deny` (선택)로 취약점을 점검합니다.
- Frontend: `npm audit`, Dependabot 알림을 주기적으로 확인합니다.
- 이미지: Trivy, Grype 등 컨테이너 스캐너를 CI 파이프라인에 통합합니다.

## 7. 사고 대응 절차

1. **탐지**: 알림/로그를 통해 이상 행동 파악
2. **분리**: 문제 서비스 스케일 다운 또는 네트워크 차단
3. **조사**: `kubectl logs`, SSH 서버 로그, tmux 세션 이력 수집
4. **복구**: 패치 적용 → CI/CD 배포 → 상태 확인
5. **리포트**: 사고 타임라인 문서화, 재발 방지 조치 반영

## 8. 감사 & 로깅

- SSH 서버, 백엔드, Kong Ingress 로그를 중앙 로그 시스템(ELK, Loki 등)에 집계합니다.
- 모든 관리 작업은 Change Log에 기록하고, 접근 권한 변경은 별도 승인 절차를 따릅니다.

