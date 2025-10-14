# Deuseda | Operations Guide

원격 SSH 콘솔 서비스를 안정적으로 운영하기 위한 콘텐츠/데이터 관리, 계정 정책, 백업 및 긴급 대응 절차를 정리했습니다.

## 1. 사용자 & 세션 관리

- **사용자 생성**: 최초 로그인 시 SSH 인증에 성공하면 사용자 레코드가 자동 생성됩니다.
- **인증 흐름**
  1. 사용자가 웹 폼에 Linux 계정/비밀번호 입력
  2. 백엔드가 설정된 `SSH_HOST`로 직접 접속
  3. 인증 성공 시 JWT 발급, tmux 세션 할당
  4. 비밀번호는 데이터베이스에 저장되지 않습니다.
- **운영자 체크포인트**
  - SSH 서버에서 `PasswordAuthentication yes` 상태인지 확인
  - 계정 비밀번호 정책 및 만료 정책을 운영팀과 공유
  - `backend/src/auth` 로그를 주기적으로 검토 (`kubectl logs deployment/prod-backend`)

## 2. 콘솔 세션 운영

- 세션은 tmux를 활용해 유지됩니다. Pod 재시작 시에도 session이 복구됩니다.
- 세션 만료 정책은 환경 변수로 제어 (`SESSION_TIMEOUT`, `MAX_SESSIONS_PER_USER` 등).
- 세션 정리가 필요할 때:
  ```bash
  kubectl exec -it statefulset/prod-tmux -n deuseda -- tmux list-sessions
  kubectl exec -it statefulset/prod-tmux -n deuseda -- tmux kill-session -t <session>
  ```

## 3. 백업 전략

- 기본 구성:
  - 대상: PostgreSQL
  - 방법: `pg_dump` + gzip
  - 스케줄: 매일 02:00 KST (`CronJob/prod-postgres-backup`)
  - 스토리지: Cloudflare R2 (S3 호환)
  - 보존 기간: 30일
- 수동 실행:
  ```bash
  kubectl create job --from=cronjob/prod-postgres-backup manual-backup-$(date +%Y%m%d-%H%M%S) -n deuseda
  kubectl logs job/manual-backup-<timestamp> -n deuseda
  ```
- 복원 테스트:
  1. 최신 백업 다운로드 (`aws s3 cp ...`)
  2. 임시 DB에 `pg_restore`
  3. 데이터 무결성 확인 후 운영 DB로 적용
- 백업 모니터링:
  ```bash
  kubectl get cronjob,job -n deuseda | grep backup
  ```

## 4. 정기 점검 항목

| 주기 | 항목 |
| ---- | ---- |
| 일일 | 로그인 지연/실패 로그 확인, tmux 세션 누락 여부 확인 |
| 주간 | SSH 서버 보안 업데이트, Docker 이미지 최신화 여부 확인 |
| 월간 | PostgreSQL 백업 복원 테스트, JWT 시크릿 로테이션, Search Console 지표 확인 |
| 분기 | 인프라 비용 점검, TLS 만료일 갱신, 운영 문서 업데이트 |

## 5. 운영 스크립트

- `test_ssh_auth.sh`: API를 통한 SSH 인증 테스트. 배포 후 smoke 테스트에 사용.
- `test_simple_auth.sh`: 단순 로그인 시나리오 검증.
- `scripts/` 디렉터리: Secret 생성, 헬스체크, 데이터 마이그레이션 템플릿.

실행 전 `chmod +x` 권한을 부여하세요.

## 6. 로그 & 모니터링

- **Backend**: `kubectl logs deployment/prod-backend -n deuseda`
- **Frontend**: 주로 브라우저 콘솔/네트워크 로그로 확인
- **Kong Ingress**: 요청/응답 로그로 WS 연결 상태 추적
- **경보 구성**: 5xx 비율, 로그인 실패율, SSH 연결 실패율에 대한 Alertmanager/Slack 알림을 권장합니다.

## 7. 장애 대응 시나리오

| 장애 | 조치 |
| ---- | ---- |
| SSH 인증 불가 | SSH 서버 상태 확인 → 방화벽 → `SSH_HOST`, `SSH_PORT` 재검토 |
| 터미널 세션 끊김 | WebSocket URL, Kong 설정, TLS 인증서 유효성 확인 |
| 데이터 손상 의심 | 최신 백업 점검 → 임시 환경 복원 → 데이터 검증 후 본 환경에 반영 |
| 배포 실패 | GitHub Actions 로그 확인 → ArgoCD `app logs` → 필요 시 `kubectl rollout undo` |

## 8. 변경 관리

1. 모든 운영 변경은 이슈/PR에 기록하고, 관련 문서(`docs/`)에 반영합니다.
2. 인프라 변경 시 Change Log를 작성하여 팀 공유 채널에 공지합니다.
3. 보안 관련 변경(SSH 키, 시크릿 교체 등)은 별도 감사 로그로 관리합니다.

