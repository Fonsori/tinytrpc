import { cyrb53 } from "./hash.js";
import LZ from "lz-string";

// Logic
const idLength = 10;
const methodId = (str: string) => cyrb53(str).toString(36).slice(0, idLength).padEnd(idLength, "-");
const splitAt = (str: string, index: number) => [str.slice(0, index), str.slice(index)] as const;

function encode<T>(obj: T) {
   const stringified = JSON.stringify(obj);
   if (stringified.length <= 100) return stringified;
   const enc = LZ.compress(stringified);
   if (enc.length > 100) throw new Error(`compressed data too long: ${enc.length} < ${stringified}`);
   return enc;
}
function decode(data: string) {
   try {
      const parsed = JSON.parse(data);
      return parsed;
   } catch (error) {
      const dec = LZ.decompress(data);
      const parsed = JSON.parse(dec);
      return parsed;
   }
}

// Helpers
type MapValue<Record> = Record extends Map<any, infer I> ? I : never;
type Values<T> = T[keyof T];
type OmitFirstArg<F> = F extends (x: any, ...args: infer P) => infer R ? (...args: P) => R : never;
type OmitNever<T> = Pick<
   T,
   Values<{
      [K in keyof T]: [T[K]] extends [never] ? never : K;
   }>
>;

// Main
type AnyFn = (...args: any[]) => any;
type AnyCTXFn<CTX> = (ctx: CTX, ...args: any[]) => any;
type GenId<Fn extends AnyFn, CTX> = CTX extends void
   ? (...args: Parameters<Fn>) => string
   : OmitFirstArg<(...args: Parameters<Fn>) => string>;

type Router<CTX, T = AnyFn> = {
   [K in keyof T]: T[K] extends AnyFn
      ? CTX extends void
         ? T[K]
         : T[K] extends AnyCTXFn<CTX>
         ? T[K]
         : Exclude<CTX, T[K]> & "context in use so CTX must be first param"
      : T[K] extends BaseFlareLock
      ? CTX extends T[K]["_internal"]["ctx"]
         ? T[K]
         : Exclude<CTX, T[K]> & "parent CTX must extend nested CTX"
      : T[K] extends Record<string, any>
      ? Router<CTX, T[K]>
      : never;
};

type ReplaceAnyFnWithGenId<T, CTX> = {
   [K in keyof T]: T[K] extends AnyFn
      ? GenId<T[K], CTX>
      : T[K] extends BaseFlareLock
      ? ReplaceAnyFnWithGenId<T[K]["_internal"]["endpoints"], CTX>
      : T[K] extends Record<string, any>
      ? ReplaceAnyFnWithGenId<T[K], CTX>
      : boolean;
};

function replaceAnyFnWithGenId<B extends Router<CTX>, CTX>(
   branch: B,
   methods: Methods,
   prefix = "",
   parentLocks: MapValue<Methods>["locks"] = new Map(),
) {
   type Branch = ReplaceAnyFnWithGenId<B, CTX>;
   const router = {} as Branch;
   for (const key in branch) {
      type Leaf = Branch[typeof key];
      const leaf = branch[key];
      const route = `${prefix}/${key}`;
      const saveLocks = new Map(parentLocks); // prepare for nested routers
      if (leaf instanceof Function) {
         const id = methodId(route + leaf.length);
         if (methods.has(id)) throw new Error(`Duplicate method id: ${id} for ${key}`);
         methods.set(id, { call: leaf as AnyFn, locks: parentLocks, route });
         router[key] = ((...data: typeof leaf extends AnyFn ? Parameters<typeof leaf> : never) => id + encode(data)) as Leaf;
      } else if (typeof leaf === "object" && leaf) {
         const nestedRouter = leaf as unknown as BaseFlareLock | undefined;
         const nestPoints = nestedRouter?._internal;
         if (nestPoints?.lockFn) parentLocks.set(route, nestPoints.lockFn);
         const branch = replaceAnyFnWithGenId(nestPoints?.endpoints ?? leaf, methods, route, parentLocks);
         router[key] = branch.router as Leaf;
      } else {
         throw "other key: " + key;
      }
      parentLocks = saveLocks; // reset parent locks
   }
   return { router: router as OmitNever<Branch> };
}

// Scope builders
export function flare<CTX extends {}>() {
   return {
      scope: <T extends Router<CTX, T>>(endpoints: T) => scope<T, CTX>(endpoints),
      lock: <F extends LockFn<CTX>>(lockFn: F) => ({
         scope: <T extends Router<CTX, T>>(endpoints: T) => scope<T, CTX, F>(endpoints, lockFn),
      }),
   };
}

type LockFn<CTX> = CTX extends void ? (...args: any[]) => boolean : (ctx: CTX, ...args: any[]) => boolean;
type BaseFlareLock<CTX = any> = {
   _internal: { endpoints: Record<string, any>; ctx: CTX; lockFn?: LockFn<CTX> };
   router: Record<string, any>;
   handler: (id: string, ...ctx: any) => Promise<any>;
};
export function scope<T extends Router<CTX, T>, CTX = void, F extends LockFn<CTX> | undefined = undefined>(endpoints: T, lockFn?: F) {
   const methods: Methods = new Map();
   const { router } = replaceAnyFnWithGenId(endpoints, methods);
   return {
      _internal: { endpoints, ctx: {} as CTX, lockFn },
      router,
      handler: (id: string, ...ctx: CTX extends void ? [] : [CTX]) => execute(id, methods, ctx),
   } satisfies BaseFlareLock;
}

// Execute the method, no type checking here needed
type Methods = Map<string, { call: AnyFn; locks: Map<string, AnyFn>; route: string }>;
async function execute(id: string, methods: Methods, ctx: any) {
   const [path, data] = splitAt(id, idLength);
   const method = methods.get(path);
   if (!method) throw new RouteNotFoundScopeError({ id, path });
   // Unlock
   for (const [route, lock] of method.locks) {
      try {
         if (!(await lock(...ctx))) throw "denied";
      } catch (e) {
         throw new FailedUnlockScopeError({ route, method, id, error: e });
      }
   }
   // Execute
   // * Can't count params as verification because of default / optional params— or can we?
   // there can be less decoded args than params, but not more
   if (!data) return await method.call(...ctx);
   try {
      const decoded = decode(data);
      if (!decoded) throw new InvalidPayloadScopeError({ id, method, data, msg: decoded });
      if (Array.isArray(decoded) && decoded.length > method.call.length)
         throw new InvalidPayloadScopeError({ id, method, data, msg: "too many args" });
      return await method.call(...ctx, ...decoded);
   } catch (e) {
      throw new InvalidPayloadScopeError({ id, method, data, msg: e });
   }
}
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
