# WhyNot Sheets

**A spreadsheet that explains why your plan is impossible, and fixes it in one click.**

**Team:** SHEET HAPPENS | **Track:** Crossbreed | **Event:** Confluence Buildathon 2026

**Stack:** Univer (spreadsheet grid and formula semantics) + Z3 theorem prover compiled to WebAssembly. Everything runs in the browser.

---

## The problem

Spreadsheets are where most people plan: hospital rosters, exam timetables, project budgets. They are very good at calculating a result and very bad at telling you why a plan is impossible.

Say a ward roster needs **63 nurse-shifts** a week, but only **40** are available at a limit of **5 shifts per nurse**. The sheet shows wrong numbers or a blank. Finding the clashing rules means checking them by hand, and fixing it means guessing.

Tools that do explain infeasibility, such as solver add-ins and the infeasibility analysis in industrial optimizers, need the planner to translate the sheet into a formal model first and then decode the output. Most planners can't or won't, so they learn a plan is impossible only after it has failed.

## What WhyNot Sheets does

You mark cells as **decisions**, **formulas** or **rules**. The sheet's own formulas become the model, with no separate modelling step.

When a rule makes the plan infeasible:

1. Z3 finds a **minimal set of conflicting rules**.
2. The affected cells **turn red**.
3. A **plain-English explanation** says exactly why, using the real numbers in your sheet.
4. The app computes **ranked, minimal fixes**.
5. You preview one and **apply it in a single click**. The app then re-verifies the plan.

> *Remove Z3 and it's an ordinary sheet that can't explain anything. Remove the grid and there is no model: the sheet's own formulas are the constraints, its cells are where conflicts appear, and they are where fixes are applied.*

**Privacy:** the solver runs in a Web Worker in your browser, and there is no backend. Planning data is never sent anywhere.

---

## Demo: the ward roster

| Cell | Role | Content |
|---|---|---|
| `B2` | Input (relaxable) | Shift cap per nurse = **5** |
| `B3` | Input | Weekly demand = **63** nurse-shifts |
| `B4` | Input (relaxable) | Overtime budget (shifts) = **0** |
| `B7:B14` | **Decision** | Regular shifts per nurse (8 nurses, integers ≥ 0) |
| `C7:C14` | **Decision** | Overtime shifts per nurse (integers ≥ 0) |
| `D15` | Formula | `=SUM(B7:B14)+SUM(C7:C14)`, total coverage |
| `F2` | **Rule** | `B7:B14 <= B2`, nobody exceeds the shift cap |
| `F3` | **Rule** | `D15 >= B3`, demand is covered |
| `F4` | **Rule** | `SUM(C7:C14) <= B4`, overtime stays within budget |

**What happens:**

1. The roster is feasible with a lower demand.
2. The user types `63` into `B3`. Rules `F2`, `F3` and `F4` can no longer all hold, so `B2`, `B3`, `B4` and `D15` turn red.
3. The explanation panel reads:
   > *Demand (B3) needs 63 shifts. The cap in B2 allows at most 5 shifts × 8 nurses = 40, and the overtime budget in B4 adds 0. These three rules cannot all hold.*
4. Ranked fixes appear:

| # | Fix | Check | Cost* |
|---|---|---|---|
| 1 | Raise shift cap to **8** | 8 × 8 = 64 ≥ 63 | 30 |
| 2 | Cap → **7** and overtime → **7** shifts | 56 + 7 = 63 | 34 |
| 3 | Cap → **6** and overtime → **15** shifts | 48 + 15 = 63 | 40 |
| 4 | Overtime → **23** shifts | 40 + 23 = 63 | 46 |

\*Cost = 10 per +1 on the cap + 2 per overtime shift, the default weights in `config/costs.json`. Change the weights and the ranking changes. The table shows the sample's arithmetic, not a benchmark.

5. One click applies fix #1, and the app re-runs the solver and shows the roster is feasible again.

---

## How it works

```text
Univer grid  (cells tagged: Input / Decision / Formula / Rule)
      |
      v
Formula parser  (cell formulas -> AST, supported subset only)
      |
      v
Z3 term builder  (AST -> Z3 Int/Bool terms; decisions become variables)
      |
      v
Z3 WASM in a Web Worker
      |-- check()  ......................... feasible? -> show a valid plan
      |-- unsat core + deletion shrink ..... minimal conflicting rules
      '-- Optimize (weighted relaxation) ... ranked minimal fixes
      |
      v
Explainer  (rule IDs -> cells, templates filled with live values)
      |
      v
Grid highlights -> fix preview -> one-click apply -> re-verify
```

### 1. Cells become a model

Each cell has a role:

- **Input:** a constant, optionally marked *relaxable* with a cost.
- **Decision:** a Z3 integer variable with a domain, such as `0 ≤ x`.
- **Formula:** a Z3 term built from the cell's own formula.
- **Rule:** a Boolean formula that must hold (a hard constraint).

Supported formula subset: `+ − × ÷ (by constant)`, comparisons `< <= = >= >`, `IF`, `SUM`, `AND`, `OR`, and range-wide comparisons such as `B7:B14 <= B2`, which expand element-wise but stay **one tracked rule**. Anything outside the subset is flagged "unsupported" on the cell, never silently ignored.

### 2. Finding the conflict

Every rule is asserted with a stable ID (`assert_and_track`). If Z3 returns *unsat*, the unsat core gives a conflicting set of rules. A raw core is **not guaranteed minimal**, so we shrink it by deletion: drop one rule, re-check, and keep the drop if it is still unsat. The result is a core where removing any one rule makes the rest satisfiable.

### 3. Finding the fixes

Relaxable inputs get a cost per unit of change. Z3 `Optimize` minimises the total weighted change subject to all rules holding. To rank fixes, we find the best fix, add a constraint excluding it, and solve again. This is weighted MaxSAT-style relaxation, expressed as MaxSMT because the changes are numeric. Each fix is re-checked with a plain `check()` before it is shown as valid.

We describe fixes as **lowest-cost under the configured weights**. "Optimal" is claimed only for what the optimiser has proven.

### 4. Explaining it

Explanations are generated from rule type, cell references and **live evaluated values** (for example `5 × 8 = 40`), never hard-coded demo text.

---

## Project structure

```text
src/
  grid/          Univer setup, cell-role tagging, red highlighting
  parser/        formula subset -> AST
  model/         AST -> Z3 terms, rule IDs
  solver/        Web Worker: check, core shrinking, optimize
  explain/       rule IDs + values -> plain English
  repair/        ranked fixes, preview, apply, re-verify
config/
  costs.json     relaxation weights
samples/
  roster.json    the demo above (feasible and infeasible states)
```

## Running it

```bash
npm install
npm run dev
```

Z3 WASM needs `SharedArrayBuffer`, so the dev server and any host must send:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The Vite config sets these for local development. Check them first if you deploy elsewhere.

---

## Design principles

- **Explain before changing.** The plan is never altered without the user's click.
- **Validate before recommending.** No fix is shown as valid until it passes every rule.
- **Keep the subset small and solid.** A narrow formula language that works beats a broad one that doesn't.
- **Be honest about guarantees.** Minimal-core and lowest-cost claims are only made where the method establishes them.
- **Stay local.** No planning data leaves the browser.

## Limitations

- Only the formula subset above is compiled. Other Excel functions are flagged, not guessed.
- Rules are hard constraints. Soft preferences are only supported as relaxable inputs with costs.
- The model is integer-linear in spirit. Nonlinear formulas such as cell × cell are rejected.
- Fix ranking depends on the cost weights you configure.
- Sized for planning sheets of tens to low hundreds of decision cells. We report solve times only from measured runs on the sample sheets.

## Other scenarios

The same pipeline applies to exam timetables (non-overlap and slot rules) and project budgets (sum-of-costs against caps). The roster is the primary demo.
