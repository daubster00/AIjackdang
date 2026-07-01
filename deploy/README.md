# 운영 배포 (단일 서버 · Docker)

AI작당을 단일 서버에 Docker 로 전부 띄우는 구성이다.

## 구성

| 호스트 | 서비스 | 컨테이너 |
|---|---|---|
| `aijackdang.com`, `www` | 사용자 사이트 (Next) | `web:3003` |
| `admin.aijackdang.com` | 관리자 (Next) | `admin:3004` |
| `api.aijackdang.com` | API (Fastify) — OAuth 콜백·SSE·쿠키 호스트 | `api:4003` |
| `cdn.aijackdang.com` | 공개 파일(MinIO 공개 버킷) | `minio:9000` |

- 상태 저장: `postgres`(17+pg_bigm) · `redis` · `minio` · `clamav`
- 앱 4개(api/worker/web/admin)는 **같은 이미지**(`aijakdang-app:latest`)를 command 만 달리해 실행
- `caddy` 가 80/443 종단 + Let's Encrypt 자동 HTTPS

## 최초 배포 절차 (서버에서)

```bash
# 0) 코드가 ~/aijakdang 에 있고 Docker/Compose 설치됨 전제
cd ~/aijakdang/deploy

# 1) 운영 .env 생성 (시크릿 난수 생성 + 외부 API 키 이관)
#    로컬 .env 를 서버로 옮겨온 파일을 소스로 준다.
./make-env.sh ../.env.local-source
rm -f ../.env.local-source        # 소스는 즉시 삭제

# 2) 빌드 → 마이그레이션 → 시드(최고관리자·등급) → 기동
./deploy.sh
```

`deploy.sh` 는 멱등이다(재실행해도 DB 데이터를 지우지 않음). 최초 배포는 볼륨이 비어 있어
**설정값(마이그레이션이 넣는 site_settings·금칙어·권한·역할) + 최고관리자 + 등급**만 있고
콘텐츠(게시글/회원/봇)는 비어 있는 상태가 된다.

## OAuth 콜백 URL 등록 (각 개발자 콘솔)

- Google: `https://api.aijackdang.com/api/v1/auth/callback/google`
- Naver:  `https://api.aijackdang.com/api/v1/auth/callback/naver`
- Kakao:  `https://api.aijackdang.com/api/v1/auth/callback/kakao`

## 방화벽 / 보안그룹

AWS 보안그룹에서 **80, 443 인바운드**를 열어야 Caddy 가 인증서를 발급받고 서비스된다.
(22 는 SSH, 그 외 내부 포트는 노출하지 않는다.)

## DB 를 다시 "설정값+최고관리자만" 으로 리셋하려면

콘텐츠만 비우려면 볼륨을 새로 만든다(설정값도 마이그레이션으로 재생성됨):

```bash
cd ~/aijakdang/deploy
docker compose -f docker-compose.prod.yml --env-file .env down
docker volume rm deploy_pgdata          # ⚠️ 전체 DB 삭제 — 되돌릴 수 없음
./deploy.sh                             # 마이그레이션 + 시드 재적용
```

## 운영 명령

```bash
C="docker compose -f docker-compose.prod.yml --env-file .env"
$C ps                 # 상태
$C logs -f api        # 로그
$C restart web        # 재시작
$C down               # 정지(데이터 보존)
```
