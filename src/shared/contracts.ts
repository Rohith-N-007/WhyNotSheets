export type CellRef = {
  sheet: string;
  a1: string;
};

export type RosterWorker = {
  id: string;
  name: string;
  role: "RN" | "LPN";
};

export type Rule =
  | {
      id: string;
      kind: "coverage-demand";
      label: string;
      minUnits: number;
      sourceCells: CellRef[];
    }
  | {
      id: string;
      kind: "worker-capacity";
      label: string;
      workerId: string;
      maxUnits: number;
      sourceCells: CellRef[];
    };

export type RosterInput = {
  workers: RosterWorker[];
  rules: Rule[];
};

export type CheckRequest = {
  model: RosterInput;
  timeoutMs?: number;
  shrinkCore?: boolean;
};

export type CheckResult =
  | {
      status: "sat";
      elapsedMs: number;
      allocation: Record<string, number>;
      coreRuleIds: [];
    }
  | {
      status: "unsat";
      elapsedMs: number;
      coreRuleIds: string[];
    }
  | {
      status: "unknown";
      elapsedMs: number;
      reason: string;
    }
  | {
      status: "error";
      elapsedMs: number;
      message: string;
    };
export type SolverWorkerRequest = {
  id: string;
  type: "check";
  payload: CheckRequest;
};

export type SolverWorkerResponse = {
  id: string;
  result: CheckResult;
};