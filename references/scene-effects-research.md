# 발표 효과 조사와 구현 선택

확인일: 2026-10-24. 브라우저 제작사/MDN의 문서를 바탕으로 구성했다. 예시의 교육적 활용은 이 스킬의 설계 제안이며, 효과가 학습 성과를 높인다는 실험 근거를 뜻하지 않는다.

| 기술과 출처 | 체험에서 쓰는 방식 | 경계 |
|---|---|---|
| [CSS animations / keyframes — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Animations/Using) | 클릭 공개, 도장, 글자별 등장, 순서 변경 반응 | CSS는 시각적 보간을 담당. 클릭/재생 상태는 JS로 조절 |
| [고성능 애니메이션 — web.dev](https://web.dev/articles/animations-guide) | 주 이동/확대 효과는 transform·opacity 우선 | clip/mask/filter 등은 복잡도·기기별 비용을 별도 확인. 모든 효과의 GPU 실행을 보장하지 않음 |
| [clip-path — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/clip-path) | 이미지의 같은 영역을 전후 비교, 일부 드러내기 | 슬라이더 값은 JS로 CSS 변수에 반영 |
| [CSS scroll snap — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll_snap) | 화면 안 이미지 넘기기, 세로 설명 장면 | 바깥 발표 페이지 이동과 안쪽 스크롤을 구분 |
| [Scroll-driven animations — Chrome](https://developer.chrome.com/docs/css-ui/scroll-driven-animations) | 내부 스크롤 진행선 | CSS timeline은 지원할 때 추가. JS 진행값으로 기본 표시 유지 |
| [View Transition API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) | 개요→상세 배치 변경의 연속성 | 기능 탐지 후 실행. 미지원/동작 줄이기는 배치를 바로 전환 |
| [prefers-reduced-motion — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) | 빠른 회전·확대·흐림을 줄이고 결과/선택 유지 | 조작이나 핵심 내용을 사라지게 만들지 않음 |

## 더 확장할 수 있는 후보

아래는 이번 열여섯 체험과 별개의 후속 후보이며 구현 완료라고 소개하지 않는다.

- SVG 경로를 따라 선 그리기/오브젝트 이동: 과정·관계도 설명. 의미 있는 순서를 실제 원본에서 확인한 뒤 사용.
- CSS mask / blend / filter로 이미지 점진 공개: 관찰·추측 활동. 작은 글자와 정보의 가독성 유지.
- 수평 이동·시차·고정 장면을 결합한 설명: 단계가 많은 자료. 발표자가 진행을 멈추거나 되돌릴 수 있도록 설계.
- 내용 높이에 맞춘 펼침/접힘과 공통 요소 전환: 보조 설명. 중요한 본문을 토글 속에 모두 숨기는 용도로 남용하지 않음.

한 장면에 효과를 여러 개 쌓기보다 **지금 무엇을 봐야 하는지**가 분명한 하나를 고른다. 강한 효과를 원하면 속도·강조·크기를 조절하되 의미 있는 최종 상태와 기본 조작을 보존한다.
