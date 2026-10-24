# 브라우저와 에이전트가 함께 쓰는 요청함

Node 22 이상에서 `npm run dev`로 실행한다. 같은 프로젝트 폴더를 연 Claude Code·Codex 등의 파일/터미널 접근 에이전트용이다. 별도 계정·AI API·커넥터·npm 패키지는 추가하지 않는다. 일반 Python 정적 서버나 공개 정적 배포에는 저장 API가 없다. 로컬 폴더를 읽지 못하는 Claude 웹에 localhost 주소를 주는 것만으로 연결되지 않는다.

사용자는 `/?edit=1`의 수정 요청 목록에서 **프로젝트 요청함에 저장**을 누른 뒤 에이전트에게 “요청함 확인해서 반영해줘”라고 말한다. 복사/파일 첨부는 필요 없다. 자동으로 에이전트를 깨우거나 작업을 실행하는 기능은 아니다.

## 에이전트가 할 일

프로젝트 폴더에서 실행한다. 다른 경로에서는 `--project <프로젝트 폴더>`를 붙일 수 있다.

```sh
node server/editor-inbox.mjs list
node server/editor-inbox.mjs read <batch-id>
node server/editor-inbox.mjs status <batch-id> --state working --expect pending --note "요청 검토 시작"
```

`.workshop-editor/inbox/<batch-id>/request.json`의 `document`가 브라우저에서 저장한 편집본이다. `requests`는 요청 수집 당시 대상의 내용/노트/탭/입력/버전이다. `document`의 최신 버전과 대조하고 삭제/변경된 대상은 추측하지 않는다. 사진 바이너리를 채팅에 반복 출력하지 말고 디스크 파일을 프로그램으로 읽는다. `read`는 기본적으로 이미지 바이너리를 참조로 표시하며 `--full`로 원본을 출력할 수 있다.

데이터 변경은 스냅샷의 deckId/baseRevision과 정확한 pageId/objectId를 사용한 JSON 패치를 만든다. 스냅샷 전체를 기본 템플릿으로 되돌리지 않는다. 지원 필드는 content/style/behavior와 페이지 notes/seconds다. 이미 있던 텍스트·사진·배치·기능과 요청 외 대상을 보존하고 검사한다.

```json
{"deckId":"my-deck","baseRevision":3,"changes":[{"pageId":"start","objectId":"start-title","set":{"content":"수정한 제목"}}]}
```

검사한 변경안을 공개 폴더 밖 JSON 파일로 작성한 다음 등록한다.

```sh
node server/editor-inbox.mjs result <batch-id> --patch <변경안.json>
```

편집기의 **변경안 확인**이 파일 선택 없이 불러온다. 사용자가 미리보고 취소/확정하며, 확정 후 실행 취소할 수 있다. 브라우저에서 기준 버전 이후 수정했다면 자동 덮어쓰지 않고 거절한다. 새 현재 편집본으로 다시 저장한 요청을 기준으로 작업한다. result 등록은 ready이며 완료/배포가 아니다. 브라우저 확정이 성공하면 done이 된다.

복잡한 맞춤 동작/서버 변경은 이 JSON 패치로 실행할 수 없다. 실제 소스를 수정하고 해당 하네스를 실행한다. 기존 브라우저 편집본과 충돌하지 않게 데이터 변경을 함께 반영하고 새로고침을 안내한다. 적용을 확인하지 못했으면 완료라고 하지 않는다. 막힌 요청은 기록을 남긴다.

```sh
node server/editor-inbox.mjs status <batch-id> --state blocked --note "확인할 내용"
node server/editor-inbox.mjs status <batch-id> --state done --note "검증하고 반영한 범위"
node server/editor-inbox.mjs list --all
```

## 저장 계약

- 요청과 현재 편집본을 하나의 변경 불가능한 스냅샷으로 저장한다. 이미지·발표 노트도 포함될 수 있다. 같은 내용의 재시도는 같은 묶음으로 처리하며 기존 상태를 되돌리지 않는다.
- `status.json`은 pending/working/ready/done/blocked다. 상태와 변경안 쓰기는 파일 잠금과 원자 교체를 사용한다. 중단된 작업의 `.lock`은 실행 중인 에이전트/서버 작업이 없는지 확인한 뒤에만 복구한다. 원본 요청을 삭제하지 않는다.
- 요청함은 public 밖에 두고 gitignore·소스 ZIP 제외를 유지한다. 로컬 서버는 127.0.0.1에만 바인딩하고 요청 API는 Host/Origin/일회성 서버 토큰을 검사한다. 외부에 노출하거나 공개 배포용 저장 서버로 바꾸지 않는다.
- 사용자 브라우저의 요청 목록은 저장/취소/실패에도 남는다. 요청함을 처리했다고 목록을 자동으로 비우지 않는다.
