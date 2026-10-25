import type {
  SolverWorkerRequest,
  SolverWorkerResponse,
} from "../shared/contracts";
import { runCheck } from "./engine";

self.addEventListener(
  "message",
  async (event: MessageEvent<SolverWorkerRequest>) => {
    const request = event.data;

    if (request.type !== "check") {
      return;
    }

    const result = await runCheck(request.payload);

    const response: SolverWorkerResponse = {
      id: request.id,
      result,
    };

    self.postMessage(response);
  },
);