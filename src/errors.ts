const mass = (o: { id: string; route?: string; data?: string; decoded?: any }) => {
   let msg = `for id ${o.id}`;
   if (o.route) msg += ` at ${o.route}`;
   if (o.data) msg += `: ${o.data}`;
   if (o.decoded) msg += ` -> ${o.decoded}`;
   return msg;
};

// Error supression
class ScopeError extends Error {
   constructor(message: string) {
      super(message);
      this.name = "ScopeError";
   }
}
export class RouteNotFoundScopeError extends ScopeError {
   constructor(o: { id: string; path: string }) {
      const message = `Route ${o.path} not found ${mass({ id: o.id })}`;
      super(message);
      this.name = "RouteNotFound";
   }
}
export class FailedUnlockScopeError extends ScopeError {
   constructor(o: { error: any; id: string; route: string; method: { route: string } }) {
      const message = `Failed unlock ${o.route} > ${o.method.route.slice(o.route.length)}: ${o.error} \n${mass({
         id: o.id,
      })}`;
      super(message);
      this.name = "RouteNotFound";
   }
}
export class InvalidPayloadScopeError extends ScopeError {
   constructor(o: { id: string; method: { route: string }; msg: any; data: string }) {
      const message = `Invalid payload ${mass({ id: o.id, route: o.method.route, data: o.data, decoded: o.msg })}`;
      super(message);
      this.name = "InvalidPayload";
   }
}

const silence = (condition: (e: ScopeError) => boolean) => (e: Error) => {
   if (e instanceof ScopeError && condition(e)) return;
   throw e;
};
export const allowError = {
   routeNotFound: silence((e) => e instanceof RouteNotFoundScopeError),
   failedUnlock: silence((e) => e instanceof FailedUnlockScopeError),
   invalidPayload: silence((e) => e instanceof InvalidPayloadScopeError),
};
