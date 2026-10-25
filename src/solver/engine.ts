import { init, killThreads } from "z3-solver";
import type {
  CheckRequest,
  CheckResult,
  Rule,
} from "../shared/contracts";

const TRACK_PREFIX = "rule:";

// In the browser Worker, Z3 loads its files from public/z3.
// In Vitest/Node later, it uses the normal Node setup.
const z3 = typeof self === "undefined"
  ? init()
  : init({
      locateFile: (file) => `/z3/${file}`,
    });

async function buildSolver(
  request: CheckRequest,
  onlyRuleIds?: Set<string>,
) {
  const { Context } = await z3;
  const ctx = new Context("whynot");
  const solver = new ctx.Solver();

  solver.set("timeout", request.timeoutMs ?? 1000);

  const variables = Object.fromEntries(
    request.model.workers.map((worker) => [
      worker.id,
      ctx.Int.const(`units:${worker.id}`),
    ]),
  );

  const selectedRules = request.model.rules.filter(
    (rule) => !onlyRuleIds || onlyRuleIds.has(rule.id),
  );

  for (const rule of selectedRules) {
    const constraint = compileRule(ctx, variables, rule);

    // Attach a permanent rule ID so Z3 can return it in an unsat core.
    solver.addAndTrack(constraint, `${TRACK_PREFIX}${rule.id}`);
  }

  return { solver, variables };
}

function compileRule(
  ctx: any,
  variables: Record<string, any>,
  rule: Rule,
) {
  if (rule.kind === "coverage-demand") {
    return ctx.Sum(...Object.values(variables)).ge(rule.minUnits);
  }

  const units = variables[rule.workerId];

  if (!units) {
    throw new Error(
      `Rule ${rule.id} refers to unknown worker ${rule.workerId}`,
    );
  }

  return ctx.And(
    units.ge(0),
    units.le(rule.maxUnits),
  );
}

function getRuleIdsFromCore(core: any): string[] {
  const ruleIds: string[] = [];

  for (let index = 0; index < core.length(); index += 1) {
    const trackerName = core
  .get(index)
  .toString()
  .replace(/^\|(.+)\|$/, "$1");

if (trackerName.startsWith(TRACK_PREFIX)) {
  ruleIds.push(trackerName.slice(TRACK_PREFIX.length));
}
  }

  return ruleIds;
}

async function checkOnlyRules(
  request: CheckRequest,
  ruleIds: string[],
) {
  const { solver } = await buildSolver(request, new Set(ruleIds));
  return solver.check();
}

// Produces a subset-minimal core by removing one rule at a time.
// It does not claim to find the globally smallest possible core.
async function shrinkCore(
  request: CheckRequest,
  originalCore: string[],
): Promise<string[]> {
  let keptRules = [...originalCore];

  for (const ruleId of originalCore) {
    const trialRules = keptRules.filter((id) => id !== ruleId);
    const trialStatus = await checkOnlyRules(request, trialRules);

    if (trialStatus === "unsat") {
      keptRules = trialRules;
    }
  }

  return keptRules;
}

export async function runCheck(
  request: CheckRequest,
): Promise<CheckResult> {
  const startedAt = performance.now();
  const elapsedMs = () => Math.round(performance.now() - startedAt);

  try {
    const { solver, variables } = await buildSolver(request);
    const status = await solver.check();

    if (status === "sat") {
      const model = solver.model();

      const allocation = Object.fromEntries(
        Object.entries(variables).map(([workerId, units]) => [
          workerId,
          Number(model.eval(units, true).toString()),
        ]),
      );

      return {
        status: "sat",
        elapsedMs: elapsedMs(),
        allocation,
        coreRuleIds: [],
      };
    }

    if (status === "unsat") {
      const rawCore = getRuleIdsFromCore(solver.unsatCore());

      const coreRuleIds = request.shrinkCore === false
        ? rawCore
        : await shrinkCore(request, rawCore);

      return {
        status: "unsat",
        elapsedMs: elapsedMs(),
        coreRuleIds,
      };
    }

    return {
      status: "unknown",
      elapsedMs: elapsedMs(),
      reason: solver.reasonUnknown() || "Z3 returned unknown",
    };
  } catch (error) {
    return {
      status: "error",
      elapsedMs: elapsedMs(),
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
export async function stopSolverForTests() {
  if (typeof self !== "undefined") {
    return;
  }

  const api = await z3;
  await killThreads(api.em);
}