import { afterAll, describe, expect, it } from "vitest";
import {
  rosterDemand40,
  rosterDemand63,
} from "../fixtures/roster";
import {
  runCheck,
  stopSolverForTests,
} from "./engine";

afterAll(async () => {
  await stopSolverForTests();
});

describe("WhyNot Sheets roster solver", () => {
  it("finds a valid allocation when demand is 40", async () => {
    const result = await runCheck({
      model: rosterDemand40,
    });

    expect(result.status).toBe("sat");

    if (result.status === "sat") {
      const totalAssigned = Object.values(result.allocation)
        .reduce((total, units) => total + units, 0);

      expect(totalAssigned).toBeGreaterThanOrEqual(40);
    }
  });

  it("finds an unsatisfiable core when demand is 63", async () => {
    const result = await runCheck({
      model: rosterDemand63,
    });

    expect(result.status).toBe("unsat");

    if (result.status === "unsat") {
      expect(result.coreRuleIds).toContain("coverage:demand");
      expect(result.coreRuleIds.length).toBeGreaterThan(0);
    }
  });

  it("handles a roster with no rules", async () => {
    const result = await runCheck({
      model: {
        workers: rosterDemand40.workers,
        rules: [],
      },
    });

    expect(result.status).toBe("sat");
  });
});