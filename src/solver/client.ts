import type {
  CheckRequest,
  CheckResult,
  SolverWorkerRequest,
  SolverWorkerResponse,
} from "../shared/contracts";

const solverWorker = new Worker(
  new URL("./solver.worker.ts", import.meta.url),
  { type: "module" },
);

type PendingCall = {
  resolve: (result: CheckResult) => void;
  reject: (error: Error) => void;
};

const pendingCalls = new Map<string, PendingCall>();

solverWorker.addEventListener(
  "message",
  (event: MessageEvent<SolverWorkerResponse>) => {
    const response = event.data;
    const pendingCall = pendingCalls.get(response.id);

    if (!pendingCall) {
      return;
    }

    pendingCalls.delete(response.id);
    pendingCall.resolve(response.result);
  },
);

solverWorker.addEventListener("error", (event) => {
  const error = new Error(event.message || "Solver worker failed");

  pendingCalls.forEach((call) => call.reject(error));
  pendingCalls.clear();
});

export function check(request: CheckRequest): Promise<CheckResult> {
  const id = crypto.randomUUID();

  const workerRequest: SolverWorkerRequest = {
    id,
    type: "check",
    payload: request,
  };

  return new Promise((resolve, reject) => {
    pendingCalls.set(id, { resolve, reject });
    solverWorker.postMessage(workerRequest);
  });
}