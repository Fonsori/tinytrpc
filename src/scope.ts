import LZ from "lz-string";
import { FailedUnlockScopeError, InvalidPayloadScopeError, RouteNotFoundScopeError } from "./errors.js";
import { cyrb53 } from "./hash.js";

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
function decode(data: string): any[] {
   if (!data) return [];
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

type ExecuteReturn = ReturnType<typeof execute>;
type Handler<CTX> = ((id: string) => ExecuteReturn) | ((id: string, ctx: CTX) => ExecuteReturn);
type LockFn<CTX> = CTX extends void ? (...args: any[]) => boolean : (ctx: CTX, ...args: any[]) => boolean;
type BaseFlareLock<CTX = any> = {
   _internal: { endpoints: Record<string, any>; ctx: CTX; lockFn?: LockFn<CTX> };
   router: Record<string, any>;
   handler: Handler<CTX>;
};

export function scope<T extends Router<CTX, T>, CTX = void, F extends LockFn<CTX> | undefined = undefined>(endpoints: T, lockFn?: F) {
   const methods: Methods = new Map();
   // * Explicity setting CTX type is criticial, otherwise it's always unknown
   const { router } = replaceAnyFnWithGenId<typeof endpoints, CTX>(endpoints, methods);
   return {
      _internal: { endpoints, ctx: {} as CTX, lockFn },
      router,
      handler: ((id: string, ctx?: CTX) => execute(id, methods, ctx)) as Handler<CTX>,
   } satisfies BaseFlareLock;
}

// Execute the method, no type checking here needed
type Methods = Map<string, { call: AnyFn; locks: Map<string, AnyFn>; route: string }>;
const VoidSymbol = {}; // literally impossible to match this as ctx... unless undefined, but still works then
async function execute(id: string, methods: Methods, ctx: any = VoidSymbol) {
   const [path, data] = splitAt(id, idLength);
   const method = methods.get(path);
   if (!method) throw new RouteNotFoundScopeError({ id, path });
   const hasCtx = ctx !== VoidSymbol;

   // Unlock
   for (const [route, lock] of method.locks) {
      try {
         if (!(await lock(ctx))) throw "denied";
      } catch (e) {
         throw new FailedUnlockScopeError({ route, method, id, error: e });
      }
   }

   // Decode
   let decoded;
   try {
      decoded = decode(data);
   } catch (e) {
      throw new InvalidPayloadScopeError({ id, method, data, msg: e });
   }

   // Validate decoded payload
   // nullish check works because supposed to be arg ARRAY
   if (!decoded) throw new InvalidPayloadScopeError({ id, method, data, msg: decoded });
   if (!Array.isArray(decoded)) throw new InvalidPayloadScopeError({ id, method, data, msg: `decoded payload is not an array` });

   // * Can't count params as verification because of default / optional params— or can we?
   // WRONG there can be less decoded args than params, but not more...
   // apparently default params don't count for function length
   // So we check for too FEW args, since yeah...
   // Nope this doesn't work either, because we can't check for optional ? params

   // Execute
   const result = await (hasCtx ? method.call(ctx, ...decoded) : method.call(...decoded));
   return { result };
}
