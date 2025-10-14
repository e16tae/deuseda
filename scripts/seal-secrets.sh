#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ./scripts/seal-secrets.sh [options]

공용 옵션:
  --namespace <ns>           Secret을 생성할 네임스페이스 (기본: deuseda)
  --out <path>               출력 파일 경로 (기본: k8s/sealed-secrets/<name>.sealedsecret.yaml)
  --controller-namespace     Sealed Secrets 컨트롤러 네임스페이스 (필요 시)
  --controller-name          Sealed Secrets 컨트롤러 이름 (필요 시)

Env 파일 기반 생성 모드:
  --env-file <path>          환경 변수 파일(.env 등)
  --name <name>              Secret 이름 (필수)

Manifest 기반 생성 모드:
  --manifest <path>          Secret YAML 파일 (단일 문서)

예시:
  ./scripts/seal-secrets.sh \
    --env-file .env.postgres \
    --namespace deuseda \
    --name postgres-secret \
    --out k8s/sealed-secrets/postgres-secret.sealedsecret.yaml

  ./scripts/seal-secrets.sh \
    --manifest k8s/base/secret-template.yaml \
    --out k8s/sealed-secrets/backend-secret.sealedsecret.yaml

사전 준비: kubectl, kubeseal 설치 및 올바른 kube-context 선택
USAGE
}

MODE=""
ENV_FILE=""
MANIFEST=""
NAMESPACE="deuseda"
SECRET_NAME=""
OUTPUT=""
CONTROLLER_NAMESPACE=""
CONTROLLER_NAME=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      MODE="env"; ENV_FILE="$2"; shift 2;;
    --manifest)
      MODE="manifest"; MANIFEST="$2"; shift 2;;
    --namespace)
      NAMESPACE="$2"; shift 2;;
    --name)
      SECRET_NAME="$2"; shift 2;;
    --out)
      OUTPUT="$2"; shift 2;;
    --controller-namespace)
      CONTROLLER_NAMESPACE="$2"; shift 2;;
    --controller-name)
      CONTROLLER_NAME="$2"; shift 2;;
    -h|--help)
      usage; exit 0;;
    *)
      echo "Unknown option: $1" >&2
      usage; exit 1;;
  esac
done

if [[ -z "$MODE" ]]; then
  echo "--env-file 또는 --manifest 옵션을 지정하세요." >&2
  usage
  exit 1
fi

if [[ -z "$OUTPUT" ]]; then
  if [[ -n "$SECRET_NAME" ]]; then
    OUTPUT="k8s/sealed-secrets/${SECRET_NAME}.sealedsecret.yaml"
  else
    echo "--out 옵션을 지정하거나 --name으로 Secret 이름을 제공하세요." >&2
    exit 1
  fi
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl 명령을 찾을 수 없습니다." >&2
  exit 1
fi

if ! command -v kubeseal >/dev/null 2>&1; then
  echo "kubeseal 명령을 찾을 수 없습니다. CLI를 설치하세요." >&2
  exit 1
fi

TMP_SECRET=$(mktemp)
trap 'rm -f "$TMP_SECRET"' EXIT

case "$MODE" in
  env)
    if [[ -z "$SECRET_NAME" ]]; then
      echo "--env-file 모드에서는 --name 옵션이 필요합니다." >&2
      exit 1
    fi
    if [[ ! -f "$ENV_FILE" ]]; then
      echo "환경 변수 파일을 찾을 수 없습니다: $ENV_FILE" >&2
      exit 1
    fi
    kubectl create secret generic "$SECRET_NAME" \
      --namespace "$NAMESPACE" \
      --from-env-file="$ENV_FILE" \
      --dry-run=client -o yaml > "$TMP_SECRET"
    ;;
  manifest)
    if [[ ! -f "$MANIFEST" ]]; then
      echo "Secret manifest를 찾을 수 없습니다: $MANIFEST" >&2
      exit 1
    fi
    # 멀티 문서인 경우에는 개별 파일로 분리하여 실행해야 합니다.
    cat "$MANIFEST" > "$TMP_SECRET"
    ;;
  *)
    echo "알 수 없는 모드입니다: $MODE" >&2
    exit 1
    ;;
esac

SEALED_ARGS=(--format yaml)
if [[ -n "$CONTROLLER_NAMESPACE" ]]; then
  SEALED_ARGS+=(--controller-namespace "$CONTROLLER_NAMESPACE")
fi
if [[ -n "$CONTROLLER_NAME" ]]; then
  SEALED_ARGS+=(--controller-name "$CONTROLLER_NAME")
fi

mkdir -p "$(dirname "$OUTPUT")"

kubeseal "${SEALED_ARGS[@]}" < "$TMP_SECRET" > "$OUTPUT"

cat <<EOF
SealedSecret 생성 완료 ✅
  모드        : $MODE
  입력 파일   : ${ENV_FILE:-$MANIFEST}
  출력 파일   : $OUTPUT
EOF
