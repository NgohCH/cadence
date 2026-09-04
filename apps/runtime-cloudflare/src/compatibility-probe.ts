import "../../api/src/server";
import { httpServerHandler } from "cloudflare:node";

const httpHandler = httpServerHandler(3000);

export default {
  ...httpHandler,

  async scheduled(controller: ScheduledController): Promise<void> {
    controller.noRetry();
    console.log(JSON.stringify({
      kind: "cadence.vs005.compatibility-probe",
      outcome: "ok"
    }));
  }
};
