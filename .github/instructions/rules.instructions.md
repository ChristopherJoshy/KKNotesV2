---
applyTo: "**"
---

##  Copilot Instructions – Reduce Hallucination & No Extra Comments

1. **Stick to verifiable libraries and APIs only.**
   - Do not invent functions, imports, or dependencies not in the current context or project configuration.
  
2. **If uncertain, clearly respond: "I don't know" or ask for clarification.**
   - Avoid guessing or filling gaps without explicit information.

3. **Ground outputs in known data.**
   - If prompted with custom inputs (requirements, docs, examples), reference them explicitly.
   - Do not rely on Copilot’s internal knowledge for specifics beyond its training scope. :contentReference[oaicite:0]{index=0}

4. **Repeat key instructions for clarity.**
   - Example: Begin with “Provide only factual, verified information.”  
     And end with “If unsure, clearly state ‘I don’t know.’” :contentReference[oaicite:1]{index=1}

5. **Use deterministic, concise responses.**
   - Favor low "creativity" or equivalent clarity-focused settings where configurable. :contentReference[oaicite:2]{index=2}

6. **No comments in code unless explicitly requested.**
   - Generate clean, runnable code only. Avoid inline or block comments by default.

7. **Prefer structured, step-by-step responses.**
   - Use chain-of-thought or bullet formatting for complex tasks: break down logic before coding. :contentReference[oaicite:3]{index=3}

8. **Respect model limitations.**
   - Avoid asking for highly specialized, very recent, or obscure information—Copilot may hallucinate. If needed, double-check with trusted sources. :contentReference[oaicite:4]{index=4}

9. **Keep guidance minimal but effective.**
   - According to experienced users, 2–3 high-impact rules are more effective than long lists. :contentReference[oaicite:5]{index=5}
