window.WORKSHOP_SCENES = {
  "version": 1,
  "scenes": [
    {
      "id": "reveal",
      "number": 1,
      "label": "클릭 애니메이션",
      "action": "버튼을 누를 때마다 다음 내용이 나타납니다.",
      "value": "설명 순서를 직접 조절하고 시선을 모읍니다.",
      "signals": [
        "단계",
        "절차",
        "순서",
        "정답 공개"
      ],
      "tech": [
        "opacity",
        "transform",
        "clip-path"
      ],
      "layer": "css-state",
      "sharedBackend": false,
      "source": "scenes.js#reveal",
      "avoid": "학습 목표와 연결되지 않는 장식으로 반복하지 않는다.",
      "fallback": "동작 줄이기에서는 최종 상태와 버튼 조작을 유지한다."
    },
    {
      "id": "kinetic",
      "number": 2,
      "label": "움직이는 제목",
      "action": "핵심 단어가 박자에 맞춰 들어옵니다.",
      "value": "짧은 메시지나 장 전환을 강조합니다.",
      "signals": [
        "핵심 문장",
        "대조",
        "장 제목"
      ],
      "tech": [
        "keyframes",
        "stagger",
        "clip-path"
      ],
      "layer": "css-state",
      "sharedBackend": false,
      "source": "scenes.js#kinetic",
      "avoid": "학습 목표와 연결되지 않는 장식으로 반복하지 않는다.",
      "fallback": "동작 줄이기에서는 최종 상태와 버튼 조작을 유지한다."
    },
    {
      "id": "motion",
      "number": 3,
      "label": "모션 그래픽",
      "action": "숫자와 막대, 과정이 함께 차오릅니다.",
      "value": "숫자의 규모와 과정의 진행을 보여줍니다.",
      "signals": [
        "수치",
        "통계",
        "소요 시간",
        "비율"
      ],
      "tech": [
        "transform",
        "keyframes",
        "requestAnimationFrame"
      ],
      "layer": "css-js",
      "sharedBackend": false,
      "source": "scenes.js#motion",
      "avoid": "학습 목표와 연결되지 않는 장식으로 반복하지 않는다.",
      "fallback": "동작 줄이기에서는 최종 상태와 버튼 조작을 유지한다."
    },
    {
      "id": "carousel",
      "number": 4,
      "label": "화면 안 이미지 슬라이드",
      "action": "같은 화면에서 이미지를 넘겨 봅니다.",
      "value": "같은 주제의 자료를 연속해서 살펴봅니다.",
      "signals": [
        "여러 사진",
        "활동 과정",
        "스크린샷"
      ],
      "tech": [
        "scroll-snap",
        "scrollTo"
      ],
      "layer": "css-js",
      "sharedBackend": false,
      "source": "scenes.js#carousel",
      "avoid": "학습 목표와 연결되지 않는 장식으로 반복하지 않는다.",
      "fallback": "동작 줄이기에서는 최종 상태와 버튼 조작을 유지한다."
    },
    {
      "id": "compare",
      "number": 5,
      "label": "전후 비교 슬라이더",
      "action": "경계선을 움직여 같은 영역을 비교합니다.",
      "value": "달라진 부분을 같은 위치에서 보여줍니다.",
      "signals": [
        "수정 전후",
        "같은 화면",
        "변화"
      ],
      "tech": [
        "clip-path",
        "CSS custom property",
        "range"
      ],
      "layer": "css-js",
      "sharedBackend": false,
      "source": "scenes.js#compare",
      "avoid": "학습 목표와 연결되지 않는 장식으로 반복하지 않는다.",
      "fallback": "동작 줄이기에서는 최종 상태와 버튼 조작을 유지한다."
    },
    {
      "id": "spotlight",
      "number": 6,
      "label": "부분 확대·집중",
      "action": "자료의 한 부분을 크게 확대합니다.",
      "value": "전체 자료 안에서 중요한 위치를 짚습니다.",
      "signals": [
        "복잡한 화면",
        "도표",
        "작은 글자"
      ],
      "tech": [
        "transform-origin",
        "scale",
        "opacity"
      ],
      "layer": "css-state",
      "sharedBackend": false,
      "source": "scenes.js#spotlight",
      "avoid": "학습 목표와 연결되지 않는 장식으로 반복하지 않는다.",
      "fallback": "동작 줄이기에서는 최종 상태와 버튼 조작을 유지한다."
    },
    {
      "id": "flip",
      "number": 7,
      "label": "뒤집는 카드",
      "action": "카드를 누르면 뒷면 설명이 나옵니다.",
      "value": "예상과 답, 질문과 해설을 연결합니다.",
      "signals": [
        "오개념",
        "질문과 답",
        "예상"
      ],
      "tech": [
        "perspective",
        "rotateY",
        "backface-visibility"
      ],
      "layer": "css-state",
      "sharedBackend": false,
      "source": "scenes.js#flip",
      "avoid": "학습 목표와 연결되지 않는 장식으로 반복하지 않는다.",
      "fallback": "동작 줄이기에서는 최종 상태와 버튼 조작을 유지한다."
    },
    {
      "id": "hotspot",
      "number": 8,
      "label": "사진 위 클릭 지점",
      "action": "그림의 번호를 눌러 설명을 확인합니다.",
      "value": "사진과 도식의 각 부분을 탐색합니다.",
      "signals": [
        "위치별 설명",
        "화면 안내",
        "구조"
      ],
      "tech": [
        "position",
        "scale",
        "opacity"
      ],
      "layer": "css-state",
      "sharedBackend": false,
      "source": "scenes.js#hotspot",
      "avoid": "학습 목표와 연결되지 않는 장식으로 반복하지 않는다.",
      "fallback": "동작 줄이기에서는 최종 상태와 버튼 조작을 유지한다."
    },
    {
      "id": "scrub",
      "number": 9,
      "label": "진행 막대 직접 조작",
      "action": "슬라이더로 변화 과정을 앞뒤로 움직입니다.",
      "value": "연속적인 변화와 원인·결과를 살펴봅니다.",
      "signals": [
        "시간의 흐름",
        "연속 변화",
        "과정"
      ],
      "tech": [
        "CSS custom property",
        "transform",
        "range"
      ],
      "layer": "css-js",
      "sharedBackend": false,
      "source": "scenes.js#scrub",
      "avoid": "학습 목표와 연결되지 않는 장식으로 반복하지 않는다.",
      "fallback": "동작 줄이기에서는 최종 상태와 버튼 조작을 유지한다."
    },
    {
      "id": "scroll",
      "number": 10,
      "label": "스크롤로 이어지는 장면",
      "action": "안쪽 화면을 스크롤하면 이야기가 이어집니다.",
      "value": "긴 과정과 설명을 한 흐름으로 묶습니다.",
      "signals": [
        "시간순 설명",
        "여정",
        "긴 과정"
      ],
      "tech": [
        "scroll-snap",
        "scroll-timeline",
        "scroll progress fallback"
      ],
      "layer": "progressive",
      "sharedBackend": false,
      "source": "scenes.js#scroll",
      "avoid": "학습 목표와 연결되지 않는 장식으로 반복하지 않는다.",
      "fallback": "동작 줄이기에서는 최종 상태와 버튼 조작을 유지한다."
    },
    {
      "id": "tilt",
      "number": 11,
      "label": "마우스·터치 입체 효과",
      "action": "표면을 움직이면 기울기와 빛이 따라옵니다.",
      "value": "표지나 핵심 오브젝트에 입체감을 줍니다.",
      "signals": [
        "표지",
        "핵심 오브젝트"
      ],
      "tech": [
        "perspective",
        "rotateX",
        "rotateY",
        "pointer events"
      ],
      "layer": "css-js",
      "sharedBackend": false,
      "source": "scenes.js#tilt",
      "avoid": "학습 목표와 연결되지 않는 장식으로 반복하지 않는다.",
      "fallback": "동작 줄이기에서는 최종 상태와 버튼 조작을 유지한다."
    },
    {
      "id": "transition",
      "number": 12,
      "label": "배치가 바뀌는 전환",
      "action": "전체 목록에서 한 장면으로 부드럽게 이동합니다.",
      "value": "개요와 세부 설명의 관계를 유지합니다.",
      "signals": [
        "전체와 부분",
        "목록과 상세",
        "확대"
      ],
      "tech": [
        "View Transition API",
        "layout state fallback"
      ],
      "layer": "progressive",
      "sharedBackend": false,
      "source": "scenes.js#transition",
      "avoid": "학습 목표와 연결되지 않는 장식으로 반복하지 않는다.",
      "fallback": "동작 줄이기에서는 최종 상태와 버튼 조작을 유지한다."
    },
    {
      "id": "branch",
      "number": 13,
      "label": "선택에 따라 달라지는 화면",
      "action": "선택한 대응에 따라 다음 장면이 달라집니다.",
      "value": "교실 사례와 판단의 결과를 비교합니다.",
      "signals": [
        "교실 사례",
        "딜레마",
        "대응 방법"
      ],
      "tech": [
        "state",
        "CSS transition"
      ],
      "layer": "css-js",
      "sharedBackend": false,
      "source": "scenes.js#branch",
      "avoid": "학습 목표와 연결되지 않는 장식으로 반복하지 않는다.",
      "fallback": "동작 줄이기에서는 최종 상태와 버튼 조작을 유지한다."
    },
    {
      "id": "poll",
      "number": 14,
      "label": "설문·결과 막대",
      "action": "한 항목을 골라 제출하고 결과를 봅니다.",
      "value": "참가자의 선택을 모아 비교할 수 있습니다.",
      "signals": [
        "사전 인식",
        "선택 조사",
        "의견 비교"
      ],
      "tech": [
        "form",
        "CSS transform bars",
        "server for shared results"
      ],
      "layer": "shared",
      "sharedBackend": true,
      "source": "scenes.js#poll",
      "avoid": "학습 목표와 연결되지 않는 장식으로 반복하지 않는다.",
      "fallback": "같은 화면에서 한 명의 입력으로 체험한다. 여러 기기의 기록 집계는 서버 연결이 필요하다."
    },
    {
      "id": "cloud",
      "number": 15,
      "label": "단어 모으기",
      "action": "입력한 단어가 화면에 쌓입니다.",
      "value": "생각과 키워드를 한눈에 살펴봅니다.",
      "signals": [
        "핵심 단어",
        "연상",
        "마무리 한 줄"
      ],
      "tech": [
        "form",
        "flex-wrap",
        "server for shared results"
      ],
      "layer": "shared",
      "sharedBackend": true,
      "source": "scenes.js#cloud",
      "avoid": "학습 목표와 연결되지 않는 장식으로 반복하지 않는다.",
      "fallback": "같은 화면에서 한 명의 입력으로 체험한다. 여러 기기의 기록 집계는 서버 연결이 필요하다."
    },
    {
      "id": "sort",
      "number": 16,
      "label": "끌어서 순서 바꾸기",
      "action": "항목을 끌거나 화살표로 순서를 바꿉니다.",
      "value": "과정·우선순위·분류를 직접 구성합니다.",
      "signals": [
        "우선순위",
        "순서 구성",
        "분류"
      ],
      "tech": [
        "drag and drop",
        "button fallback",
        "CSS animation"
      ],
      "layer": "css-js",
      "sharedBackend": false,
      "source": "scenes.js#sort",
      "avoid": "학습 목표와 연결되지 않는 장식으로 반복하지 않는다.",
      "fallback": "동작 줄이기에서는 최종 상태와 버튼 조작을 유지한다."
    }
  ]
};
