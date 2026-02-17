# LLM-Agnostic Skill Patterns

Guidelines for writing skills that work identically across OpenAI (GPT-4, GPT-4o, GPT-5) and Anthropic (Claude Sonnet, Claude Opus) models.

---

## 1. Instruction Style

Use imperative mood with concrete actions. Avoid provider-specific conventions.

### Do

```
1. Read `projects/<project-id>/bible/characters.json`.
2. Extract all character IDs from the `characters` array.
3. For each character ID, verify a directory exists at `reference/characters/<CHAR_ID>/`.
4. Write the result as JSON to `projects/<project-id>/lint/reference_check.json`.
```

### Do Not

```
You are a helpful assistant that checks reference directories...    ← OpenAI system prompt style
Human: Check the reference directories. Assistant: I will...       ← Anthropic turn markers
Use your code interpreter to run the validation script.            ← Assumes specific tool access
```

---

## 2. Output Format Declarations

When a skill requires structured output, declare the format explicitly.

### For JSON output

```
Output format: Valid JSON only. No markdown code fences. No prose before or after the JSON.
```

### For text file output

```
Output format: Plain text. One paragraph per field. No headings or bullet points.
```

### For prompt file output

```
Output format: Follow the exact section structure shown below. Include all section headers.
Do not wrap in markdown. Write raw prompt text only.
```

---

## 3. Validation Commands

Use `node -e` for all validation. Avoid Unix-specific utilities that behave differently on Windows.

### Cross-platform file existence check

```bash
node -e "const fs=require('fs'); const p='projects/default/music/concept.txt'; if(!fs.existsSync(p)){console.error('Missing: '+p);process.exit(1)} const s=fs.statSync(p); if(s.size===0){console.error('Empty: '+p);process.exit(1)} console.log('OK: '+p+' ('+s.size+' bytes)')"
```

### Cross-platform JSON parse check

```bash
node -e "const fs=require('fs'); const p='projects/default/bible/characters.json'; try{JSON.parse(fs.readFileSync(p,'utf8'));console.log('Valid JSON: '+p)}catch(e){console.error('Invalid JSON: '+p+' — '+e.message);process.exit(1)}"
```

### Cross-platform directory listing

```bash
node -e "const fs=require('fs'); const d='projects/default/reference/characters'; if(!fs.existsSync(d)){console.error('Missing: '+d);process.exit(1)} console.log(fs.readdirSync(d).join('\n'))"
```

### Avoid these Unix-specific commands in skills

| Unix Command | Use Instead |
|-------------|-------------|
| `wc -c` | `node -e "console.log(require('fs').statSync(p).size)"` |
| `ls -1` | `node -e "console.log(require('fs').readdirSync(d).join('\\n'))"` |
| `find ... -type f` | `node -e` with `fs.readdirSync` + filter |
| `grep` | `node -e` with `fs.readFileSync` + `.includes()` |

---

## 4. Reasoning Approach

Skills should guide the agent's reasoning without assuming specific chain-of-thought mechanisms.

### Provide explicit decision trees

```
If `analysis.json` exists and contains all required keys → skip to step 5.
If `analysis.json` exists but is missing keys → report missing keys, then regenerate.
If `analysis.json` does not exist → generate from scratch using the schema below.
```

### Provide concrete examples alongside rules

```
Rule: Suno prompts must not contain visual language.
Bad: "Neon-lit alley with rain-soaked pavement, camera slowly pushes in"
Good: "Dark atmospheric synths with reverb-heavy pads, slow tempo building tension"
```

### Provide fallback instructions

```
If the project has no music file uploaded, note this gap in the completion report
and proceed with remaining artifacts. Do not halt the entire skill execution.
```

---

## 5. Error Handling

Skills should define what to do when things go wrong, without assuming the agent has access to specific error-handling mechanisms.

```
If a JSON file fails to parse:
  1. Report the file path and parse error message.
  2. Attempt to fix obvious issues (trailing commas, unescaped quotes).
  3. If the file cannot be repaired, create a fresh version using the schema template.
  4. Note the recovery action in the completion report.
```

---

## 6. Context Window Management

Large projects may have many shots, characters, and locations. Skills should account for this.

```
When processing shot_list.json with more than 20 shots:
  - Process shots in batches of 10.
  - Validate each batch before proceeding to the next.
  - Report progress after each batch ("Processed shots 1-10 of 45").
```

---

## 7. Multi-Provider Testing Checklist

Before marking a skill as production-ready, verify:

- [ ] All instructions use imperative mood (no "You are..." preambles)
- [ ] No Human/Assistant turn markers anywhere in the skill
- [ ] No references to specific model names or provider features
- [ ] All validation commands use `node -e` (not `wc`, `find`, `ls`, `grep`)
- [ ] Output format is explicitly declared for every generated artifact
- [ ] Decision trees cover happy path and at least one error path
- [ ] Examples show both correct and incorrect output for each rule
