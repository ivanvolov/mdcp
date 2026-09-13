# Shared references

Uniswap's strategy skills reference `../../references/<file>.md`, a path that
resolves inside *their* repository layout (`plugins/<plugin>/skills/<name>/`
next to `plugins/<plugin>/references/`) but not inside this one.

These files are copies of `skills/uniswap-official/references/`, placed at the
depth both suites expect, so the links resolve for the official skills **and**
for the mdcp ports — identically, which is what keeps the two benchmark arms
comparable. No SKILL.md was edited to make this work: the skill files are the
experimental artifacts and their bytes are cited in the results.

Source: github.com/Uniswap/uniswap-ai @ 5338d6e, MIT (LICENSE in
`skills/uniswap-official/`).
