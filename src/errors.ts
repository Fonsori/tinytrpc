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
      this.name = "ScopeError" + this.name;
   }
}
export class RouteNotFoundScopeError extends ScopeError {
   constructor(o: { id: string; path: string }) {
      const message = `Route ${o.path} not found ${mass({ id: o.id })}`;
      super(message);
      this.name = "RouteNotFound" + this.name;
   }
}
export class FailedUnlockScopeError extends ScopeError {
   constructor(o: { error: any; id: string; route: string; method: { route: string } }) {
      const message = `Failed unlock ${o.route} > ${o.method.route.slice(o.route.length)}: ${o.error} \n${mass({
         id: o.id,
      })}`;
      super(message);
      this.name = "FailedUnlock" + this.name;
   }
}
export class InvalidPayloadScopeError extends ScopeError {
   constructor(o: { id: string; method: { route: string }; msg: any; data: string }) {
      const message = `Invalid payload ${mass({ id: o.id, route: o.method.route, data: o.data, decoded: o.msg })}`;
      super(message);
      this.name = "InvalidPayload" + this.name;
   }
}

// cool use of "new" keyword thanks https://www.xolv.io/blog/dev-notes/how-to-pass-a-class-to-a-function-in-typescript/
const silence =
   <E extends ScopeError>(condition: new (...args: any[]) => E) =>
   (e: Error) => {
      if (e instanceof condition) return e;
      throw e;
   };
export const allowError = {
   routeNotFound: silence(RouteNotFoundScopeError),
   failedUnlock: silence(FailedUnlockScopeError),
   invalidPayload: silence(InvalidPayloadScopeError),
};
