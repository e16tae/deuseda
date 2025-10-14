# Deuseda | Documentation Index

원격 SSH 콘솔 서비스의 환경 구성, 배포, 운영, 보안 관련 문서가 이 디렉터리에 정리되어 있습니다. 모든 문서는 실제 운영 환경에 맞춰 값을 교체한 뒤 적용해야 합니다.

## 핵심 문서
- [환경 구성](./environment.md): 백엔드/프런트엔드 환경 변수, 데이터베이스, SSH 설정
- [배포 가이드](./deployment.md): Docker Compose, Kubernetes, ArgoCD 파이프라인
- [워크플로](./workflow.md): 브랜치 전략, 테스트, GitHub Actions
- [운영 가이드](./operations.md): 사용자/세션 관리, 백업, 비상 대응
- [보안 가이드](./security.md): 비밀 정보, SSH 정책, 공개 준비 점검표

## 참고 자료
- `scripts/` 디렉터리: 시크릿 생성, 헬스체크, 데이터 마이그레이션 등 자동화 스크립트
- `reset-git-history.sh`: 저장소 커밋 히스토리를 정리할 때 사용

## 문서 유지 원칙
1. 변경 사항을 PR 설명에 기록하고, 필요 시 문서 상단에 `Last updated` 표기를 추가합니다.
2. 환경 변수, 토큰 값 등 민감 정보는 절대 문서에 직접 기재하지 않습니다.
3. 운영 중 발견한 문제와 해결책을 즉시 문서화해 다음 배포에 반영합니다.

