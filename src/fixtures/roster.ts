import type { RosterInput } from "../shared/contracts";

const cells = (a1: string) => [{ sheet: "Roster", a1 }];

const baseRoster: RosterInput = {
  workers: [
    { id: "ava", name: "Ava", role: "RN" },
    { id: "ben", name: "Ben", role: "RN" },
    { id: "chen", name: "Chen", role: "LPN" },
    { id: "dina", name: "Dina", role: "RN" },
    { id: "eli", name: "Eli", role: "LPN" },
  ],
  rules: [
    {
      id: "coverage:demand",
      kind: "coverage-demand",
      label: "Meet staffing demand",
      minUnits: 40,
      sourceCells: cells("B2"),
    },
    {
      id: "capacity:ava",
      kind: "worker-capacity",
      label: "Ava can cover at most 12 units",
      workerId: "ava",
      maxUnits: 12,
      sourceCells: cells("C5"),
    },
    {
      id: "capacity:ben",
      kind: "worker-capacity",
      label: "Ben can cover at most 12 units",
      workerId: "ben",
      maxUnits: 12,
      sourceCells: cells("C6"),
    },
    {
      id: "capacity:chen",
      kind: "worker-capacity",
      label: "Chen can cover at most 12 units",
      workerId: "chen",
      maxUnits: 12,
      sourceCells: cells("C7"),
    },
    {
      id: "capacity:dina",
      kind: "worker-capacity",
      label: "Dina can cover at most 13 units",
      workerId: "dina",
      maxUnits: 13,
      sourceCells: cells("C8"),
    },
    {
      id: "capacity:eli",
      kind: "worker-capacity",
      label: "Eli can cover at most 13 units",
      workerId: "eli",
      maxUnits: 13,
      sourceCells: cells("C9"),
    },
  ],
};

function withDemand(minUnits: number): RosterInput {
  return {
    ...baseRoster,
    rules: baseRoster.rules.map((rule) =>
      rule.kind === "coverage-demand" ? { ...rule, minUnits } : rule,
    ),
  };
}

export const rosterDemand40 = withDemand(40);
export const rosterDemand63 = withDemand(63);