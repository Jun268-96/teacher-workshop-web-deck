# 처음 쓰는 사용자의 준비와 배포

## 도구 발견 → 필요한 순간 동의

우선 현재 환경에 제공된 브라우저/게시 도구와 기존 프로젝트 의존성을 확인한다. 처음부터 Node·Playwright·Wrangler를 전부 설치하지 않는다. 프로젝트의 `node harness/harness.mjs doctor`는 읽기 전용이며 도구 상태와 질문 예시를 JSON으로 출력한다. 이 명령은 계정 상태를 확인하거나 패키지를 다운로드하지 않는다.

사용자에게 실제로 묻는다. 스크립트의 `--consent`는 이미 받은 답을 실행 단계에 전달하는 인자이며 사용자 응답을 대신하지 않는다. 상위 실행 환경의 승인/설치 정책을 우선한다.

- **브라우저 검사 필요**: “화면 잘림과 버튼 동작을 자동으로 검사하려면 Playwright와 Chromium이 필요해요. 이 프로젝트에 패키지와 검사 브라우저를 설치할까요? [설치하고 검사 / 설치 없이 진행]”
- **배포 필요**: “인터넷 주소로 공유하려면 Wrangler 배포 도구가 필요해요. 이 프로젝트에 설치할까요? 계정 가입·로그인은 별도예요. [설치하고 배포 준비 / 파일로 받기]”
- **Node 없음**: “제작·검사 도구를 실행할 Node.js가 필요해요. 설치를 도와드릴까요? [설치 진행 / 파일로만 받기]” OS와 설치 범위를 확인한 후 공식 설치 경로를 안내/지원한다. 관리자 권한이나 시스템 설정을 임의로 바꾸지 않는다. 기본 하네스는 Node 22 이상을 사용한다.

기존 승인과 설치를 재사용한다. 거절 시 로컬에서 열 수 있는 `public/index.html`과 에셋을 제공하고 미실행 검사를 적는다. 정적 분석만으로 실제 브라우저 검증 완료를 주장하지 않는다. 브라우저 도구가 이미 제공되면 그것을 이용할 수 있고 Playwright를 중복 설치할 필요는 없다. 이때는 해당 도구의 관찰 증거를 남기고, 동봉 자동 게이트를 쓸 경우 실행 가능한 Playwright 연결을 확보한다. JSON의 `passed` 값을 손으로 바꿔 우회하지 않는다.

동의 후 프로젝트에서 실행:

```sh
node harness/harness.mjs setup --tool browser --consent install-browser
node harness/harness.mjs setup --tool deploy --consent install-deploy
```

브라우저 설치는 프로젝트의 Playwright와 사용자 캐시의 Chromium, 배포 설치는 프로젝트의 Wrangler만 대상으로 한다. 전역 npm 설치나 sudo를 기본으로 사용하지 않는다. 필요한 도구만 설치한다. OS 필수 라이브러리 부족 등 실패가 있으면 정확한 원인을 알리고 설치 범위를 넓히기 전에 확인한다.

이미 제공된 의존성을 재사용하려면 `WORKSHOP_PLAYWRIGHT_MODULE`에 Playwright 모듈 진입 파일, `WORKSHOP_WRANGLER_CLI`에 Wrangler CLI JS 파일의 경로를 환경변수로 전달할 수 있다. 경로는 현재 환경에서 확인하고 배포 파일/공유 스킬에 개인 절대 경로를 하드코딩하지 않는다.

## 로컬 편집 요청함

Node 22 이상이 있으면 `npm run dev`만으로 로컬 요청함을 쓸 수 있다. 추가 패키지·Playwright·Wrangler·계정·AI API 키는 이 전달 경로의 요건이 아니다. 브라우저 수정 요청을 같은 프로젝트 폴더에 저장하고 파일 접근 에이전트가 읽는다. 별도 Python 정적 서버에는 이 API가 없으므로 표준 개발 서버로 실행한다. [로컬 요청함](local-editor-inbox.md)에서 사용법과 실제 검증 경계를 확인한다. 127.0.0.1 전용 서버를 외부에 노출하지 않으며, 공개 정적 배포에는 요청함이 포함되지 않는다.

## 계정 연결

도구 설치와 계정 가입은 다르다. 대상 계정이 없으면 사용자가 브라우저에서 Cloudflare에 가입·로그인하도록 안내한다. 비밀번호/OTP/API 키를 채팅으로 받지 않는다. 로그인은 사용자 동작이며 설치 허용으로 대신하지 않는다.

기존 인증을 확인할 때는 기존 Wrangler의 `whoami`를 사용한다. 새 로그인은 준비된 CLI로 `wrangler login`을 실행하고 사용자가 브라우저에서 인증한다. 로그인/정책 동의가 끝날 때까지 가능한 제작과 검사는 계속한다. 가입을 원하지 않으면 파일로 전달한다.

참고: Cloudflare의 임시 계정 배포는 로그인 전에 미리보기가 가능하지만 사용자 약관 동의와 60분 내 인수가 필요하다. 이를 영구 발표 링크로 사용하거나 무단 계정 생성으로 우회하지 않는다. 기본 하네스는 이 임시 흐름을 자동 실행하지 않는다.

## 기본 배포 경로

새 정적 발표자료는 이름을 지정한 별도 Worker로 배포한다. `wrangler.json`의 `assets.directory`는 **./public**이어야 한다. 대본·검사 결과·개발 도구·키는 이 폴더 밖에 둔다. 기존 연수의 Worker 이름이나 계정 설정을 템플릿에 넣지 않는다.

배포 요청·대상 확인이 있으면 재확인 없이 검사 → dry-run → deploy → 공개 검증으로 이어간다. 공개 범위가 미정이면 아직 공개하지 않는다. 설치 동의만으로 공개 배포까지 허용된 것은 아니다.

```sh
npm run check
npm run verify
# 실제 캡처 검토 후
node harness/harness.mjs review --reviewed --note "확인한 화면과 수정 사항"
npm run deploy:check
npm run deploy
# 공개 캡처도 확인 후
node harness/harness.mjs review --public --reviewed --note "공개 화면 검토 결과"
```

하네스가 자동으로 검사 결과·소스 해시·시각 검토 일치를 확인하고, 공개 사이트의 빌드 표식과 실제 브라우저 동작을 재검사한다. 계정 연결이 안 되거나 서비스가 거부하면 실패 상태를 보고한다. 업로드 성공/공개 검사 통과/시각 검토 완료를 구분한다. 인증 오류를 반복 재시도하거나 사용자 계정 대신 제작자 계정으로 배포하지 않는다.

실시간 백엔드는 이 정적 배포기에 넣지 않는다. 사용자 지정 provider나 기존 Worker라면 해당 프로젝트의 실행 방식·데이터 보존·바인딩·마이그레이션을 확인하고 별도 릴리스 절차로 진행한다. 검사 게이트를 무력화하지 말고 동등한 실제 증거를 남긴다.

공식 문서(설치/배포 오류 시 현재 내용을 다시 확인):
- https://playwright.dev/docs/intro
- https://developers.cloudflare.com/workers/get-started/guide/
- https://developers.cloudflare.com/workers/platform/claim-deployments/
