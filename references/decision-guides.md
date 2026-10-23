# Decision guides: slide units and evidence

Use these guides internally. Their job is to reach a clear recommendation, not to move every design choice to the user.

## Decision posture

Start with the learning outcome, inspect the material, select a default, and explain the decision in one sentence. Ask a focused question only at a decision gate:

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

## User-facing planning output

For each section, show only:

- the recommended slide/scene form;
- its learning reason;
- its evidence form;
- a case-slot request or decision gate only when unresolved.

Do not expose raw scoring unless requested. This preserves a decisive workflow while leaving meaningful choices with the presenter.
