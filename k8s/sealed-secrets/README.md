# Sealed Secrets

이 디렉터리는 `kubeseal`로 암호화한 `SealedSecret` 매니페스트를 보관합니다. PostgreSQL, 백엔드 JWT/DB 자격 증명 등 민감한 값을 커밋하려면 다음 절차를 따르세요.

1. Sealed Secrets Controller 설치 및 `kubeseal` CLI 준비
2. `k8s/base/secret-template.yaml` 또는 `secret.example.yaml`을 참고해 로컬 임시 Secret YAML 혹은 `.env` 파일 작성
3. 스크립트 실행
   ```bash
   ./scripts/seal-secrets.sh \
     --env-file .env.postgres \
     --namespace deuseda \
     --name postgres-secret \
     --controller-namespace kube-system \
     --controller-name sealed-secrets \
     --out k8s/sealed-secrets/postgres-secret.sealedsecret.yaml

   ./scripts/seal-secrets.sh \
     --manifest k8s/base/secret-template.yaml \
     --namespace deuseda \
     --controller-namespace kube-system \
     --controller-name sealed-secrets \
     --out k8s/sealed-secrets/backend-secret.sealedsecret.yaml
   ```
   > `--manifest` 모드는 Secret YAML(하나의 문서)에 값을 직접 채운 뒤 암호화할 때 사용합니다.
   > 다중 문서 템플릿(`---`)을 사용할 경우에는 리소스별로 분리한 파일을 만들어 실행하세요.

4. 생성된 `*.sealedsecret.yaml` 파일을 커밋 → GitOps 파이프라인에서 자동 적용

참고용 예시는 `*.sealedsecret.yaml.example`로 제공되며, 실제 배포 전에는 반드시 `encryptedData` 필드를 `kubeseal`이 생성한 값으로 교체해야 합니다.
