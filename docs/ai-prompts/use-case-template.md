# Use-case template

Copy this file to `docs/ai-prompts/<your-case>.md`, fill in every section, link it from
[index.md](./index.md), and open a pull request (the [CLA](../contributing) applies to
outside contributions). Keep the prompt self-contained: a reader must be able to paste it
into an AI and get a working host + page.

```markdown
# <Use-case name>

## Scenario

<One paragraph: who wants this and what they see in the browser.>

## Example prompt

```text
<paste the full prompt, including the hard-rules block from index.md>
```

## What it yields

<The files the AI should produce and how they fit together.>

## What to check

- <The determinism / validation / split checks specific to this case.>
```

Notes for authors:

- Stay inside the host split: animspec renders in Node; the browser displays.
- Reference primitives by name and link [VOCABULARY.md](../VOCABULARY.md) rather than
  pasting param tables — the vocabulary page is generated and always current.
- Model calls (chat, TTS, LLM APIs) are the caller's side; prompts should say so.
