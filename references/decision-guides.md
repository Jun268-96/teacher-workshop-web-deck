# Decision guides: slide units and evidence

Use these guides internally. Their job is to reach a clear recommendation, not to move every design choice to the user.

## Decision posture

Start with the learning outcome, inspect the material, select a default, and explain the decision in one sentence. For a new workshop or substantial restructuring, always use the page-plan approval gate below unless the user explicitly waives it or has already approved that plan. Outside that gate, ask focused questions only when:

- a necessary personal case still lacks approved material after checking available sources;
- privacy, permission, or attribution is unclear;
- two genuinely different workshop directions remain equally defensible;
- the choice changes a major commitment such as a realtime backend, paid/private research, public deployment, or a required participant account. Ordinary reading/searching of public sources is part of content preparation.

Do not ask whether to split every slide, which animation style to use, or which of several minor visual variants the user prefers. Make those choices from the teaching goal and revise from feedback.

## Slide unit decision

First write content as **teaching beats**, not slides. For each pair of adjacent beats, assess these signals.

### Signals to separate

- The participant must answer a new question or make a new decision.
- The presenter needs a deliberate pause for discussion, practice, or a choice.
- A new environment, artefact, or outcome must be read independently.
- A term must stand on its own to support later reasoning.

### Signals to keep within one slide

- The same artefact evolves through visible states.
- The contrast requires the earlier state to remain visible.
- A separate slide would repeat the same evidence, copy, or conclusion.
- The transition would interrupt one continuous action.

Use the signals as internal weights. The outcome has three forms:

| Decision | When it is right | Typical implementation |
| --- | --- | --- |
| Separate | The learning question or participant action changes | New slide with its own title and pause |
| State | One artefact or action changes continuously | Toggle, staged reveal, before/after, replay, or accumulated scene inside one slide |
| Merge/remove | The beat has no independent outcome or repeats the prior beat | Combine into existing copy/scene or omit |

Default to **state** rather than several near-identical slides when one artefact is changing. Default to **separate** when the audience needs to reset attention, discuss, act, or enter a new context. Do not make a topic large just because it is technically complex: one well-directed work scene can teach a complex process.

### Record format

```text
Unit decision: state within one slide
Reason: HTML, CSS, and JavaScript change one shared preview; separate slides would repeat the same artefact.
```

## Evidence decision

Apply hard gates before weighting:

- Do not show private student, teacher, school, or service data without clear permission or safe anonymisation.
- Do not present an invented result as a real school or teacher case.
- A current factual claim about a product, policy, price, or workflow needs a current authoritative source; a teaching demo is not that source.
- A claim about the presenter's own result needs an actual artefact, an approved account, or an explicit statement that the case is still pending.

Then choose one evidence form.

| Evidence form | Default use | Do not use it for |
| --- | --- | --- |
| Real case | Credibility, result, current interface, or an actual before/after | Unapproved/private material or a claim with no source |
| Live demo | Participants need to see an irreversible or hands-on action happen now | Routine evidence that a screenshot or recording can cover; any flow without a fallback |
| Teaching demo | Causality, comparison, error recovery, or a controlled process | Pretending to prove a real outcome or current product fact |
| Concept visual | Relationships, vocabulary, overview, or an abstract model | Evidence of real-world success or a current interface |
| Case slot | A real case is educationally necessary but not yet supplied | A disguised finished example |

Weight credibility and currentness toward a real case; weight causal clarity, privacy, and controllability toward a teaching demo or concept visual. Select live demo only when its immediate action teaches more than a verified capture, and always define its fallback.

### Record format

```text
Evidence decision: teaching demo
Reason: the goal is to make the retry loop legible; the live project logs are noisy and may contain private context.
Case slot: optional real example of a repaired workflow, pending presenter approval.
Fallback: use the built-in replay.
```

<a id="page-plan-approval"></a>
## Page-plan approval

Before substantial production of a new deck or a full restructuring, present the complete page plan. A section list alone is not enough. For a long deck, group the compact rows by section while still showing every page. Avoid a full script or a menu of minor design choices.

Use a compact table, adapting column widths to the actual workshop:

| Page / title | One message and evidence | Visible layout / internal states | Presenter and participant action | Approx. time |
|---|---|---|---|---|
| stable ID and short Korean title | what the audience needs to understand; real source when relevant | single statement, large screenshot, before/after, demo, practice; name internal states | what the presenter does and what participants see/do | include work, waiting and check-in time |

Also state the overall arc, page count, session-time total including the agreed Q&A/break boundaries, required interactive modules, and unresolved source or setup needs. In a hands-on workshop, make practice blocks and success criteria visible in this plan. Recommend one coherent arrangement and explain important choices briefly.

Apply [time-and-scope.md](time-and-scope.md) before filling timing fields. Source titles, timers and historical notes do not confirm this task's duration. With time unspecified, omit the timing column or mark it unspecified; do not invent a total or compress the content to fit an old limit. The user may confirm the content plan while leaving duration open.

Ask one direct confirmation, for example: “이 페이지 구성과 진행 방식으로 제작할까요? 바꿀 부분이 있으면 먼저 조정하겠습니다.” Wait for the response before substantial HTML/CSS/JS, new visual-asset production, production-tool installation, or deployment. Source reading, ordinary public research, source inventory and text/structural planning may continue before this point. Opening or copying the skill's already-built generic scene lab is also allowed during planning; it is not production of the user's deck. Scene preferences or a selection JSON do not approve the full page plan. Do not turn silence or a generic earlier “알아서 해줘” into approval of an unseen plan.

Record status, the actual user approval/explicit waiver, and the approved map version in `workshop/slide-map.md`. An agent must not invent the confirmation. An earlier approval of this same plan followed by a build instruction is sufficient; do not ask again. User instructions to skip this gate take precedence.

After approval, make routine typography, crops, spacing and implementation choices within the agreed scope without further gates. Reconfirm only a substantial change to learning flow, practice allocation, overall scope, participant features, or a new external commitment; show the changed portion rather than repeating the entire intake. A narrow fix to an existing deck does not require a new whole-deck map approval.

This is a human planning gate. The deployment harness checks actual browser/visual evidence; it does not prove that a human approved a plan merely because a file says “approved”.
