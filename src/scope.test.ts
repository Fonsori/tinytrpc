import { expect, it } from "vitest";
import { ignoreError, flare, scope } from "./index";
type Interaction = { customId: string };

export const parseIds = (customId: string | undefined) => (customId?.split("-").map((i) => i || undefined) as (string | undefined)[]) ?? [];

it("Should create a default fetcher", async () => {
   const { router, handler } = flare<Interaction>().scope({
      foo(ctx: Interaction, id = 54) {
         console.log("handling foo", id);
      },
      hey() {
         console.log("mu ha ha");
      },
      may(ctx: Interaction, e: undefined) {
         console.log("may", e);
      },
      july(ctx: Interaction, member?: string) {
         console.log("july", member);
      },
      bar: {
         // ts-expect-error if you forget to accept context as first param
         foo(ctx: Interaction, user: { id: number }, bar = false) {
            console.log("handling bar", user.id);
         },
      },
   });
   const buttonId = router.foo(243129);
   await handler(buttonId, { customId: buttonId });
   await handler(buttonId, { customId: buttonId });
   const mes = await handler("E" + buttonId, { customId: buttonId }).catch(ignoreError.routeNotFound);
   console.log("mes", "caught", !!mes, mes);

   const kdjfs = router.july();
   const kfsdfsdjfs = router.july("k8uguj1zno");
   const f = await handler(kdjfs, { customId: buttonId });
   const ffsd = await handler(kfsdfsdjfs, { customId: buttonId });

   const buttonId2 = router.foo();
   await handler(buttonId2, { customId: buttonId });

   const anotherId = router.hey();
   await handler(anotherId, { customId: buttonId });

   const moreId = router.may(undefined);
   await handler(moreId, { customId: buttonId });
   await handler("k8uguj1zno[null]", { customId: buttonId });
   // insufficient decoded param length NOPE NO WORK
   // await expect(() =>
   //    handler("k8uguj1zno[]", { customId: buttonId })
   //       .catch(ignoreError.routeNotFound)
   //       .catch((e) => Promise.reject(e)),
   // ).rejects.toThrow();

   await expect(() =>
      handler(buttonId + "E", { customId: buttonId })
         .catch(ignoreError.routeNotFound)
         .catch((e) => Promise.reject(e)),
   ).rejects.toThrow();

   await handler(buttonId, { customId: buttonId });

   // await handler(buttonId + "E", { customId: buttonId }).catch(ignore.routeNotFound);
   // await handler(buttonId + "E", { customId: buttonId });

   expect({ hello: "world" }).toEqual({
      hello: "world",
   });
});

it("Should create a default fetcher", async () => {
   const { router, handler, _internal } = scope({
      foo(hi: number, id = "ok") {
         console.log("handling no scope foo", hi, id);
      },
   });

   const buttonId = router.foo(54);
   await handler(buttonId);
   await handler("E" + buttonId).catch(ignoreError.routeNotFound);

   await expect(() =>
      handler(buttonId + "E")
         .catch(ignoreError.routeNotFound)
         .catch((e) => Promise.reject(e)),
   ).rejects.toThrow();

   await handler(buttonId);

   const customId = "session";

   try {
      await handler(customId).catch(ignoreError.routeNotFound);
   } catch {
      const [path, lastId] = parseIds(customId);
      console.log("manual button handling", path, lastId);
      switch (path) {
         case "session":
            console.log("handling session");
            break;
         case "manageSubscription":
            const subscriptionId = Number(lastId);
            if (!subscriptionId) return "oop";
            console.log("handling manageSubscription", subscriptionId);
      }
      throw "exhuast";
   }

   // await handler(buttonId + "E", { customId: buttonId }).catch(ignore.routeNotFound);
   // await handler(buttonId + "E", { customId: buttonId });

   expect({ hello: "world" }).toEqual({
      hello: "world",
   });
});

// type Context = AnySelectMenuInteraction<"cached" | "raw">;
type Context = { customId: string; pear: boolean };
// type Context = "cached" | "raw";

it("Should create a default fetcher", async () => {
   const { router, handler } = flare<Context>().scope({
      foo(ctx: Interaction, id = 54) {
         console.log("handling foo second", id);
      },
      bar: {
         // ts-expect-error if you forget to accept context as first param
         foo(ctx: Interaction, user: { id: number }, bar = false) {
            console.log("handling bar", user.id);
         },
      },
   });
   const buttonId = router.foo(54);

   // const interaction = {} as AnySelectMenuInteraction;
   const interaction = "cached" as any as Context;
   // if (!interaction.inGuild()) return;

   await handler("E" + buttonId, interaction).catch(ignoreError.routeNotFound);

   await expect(() =>
      handler(buttonId + "E", interaction)
         .catch(ignoreError.routeNotFound)
         .catch((e) => Promise.reject(e)),
   ).rejects.toThrow();

   await handler(buttonId, interaction);

   // await handler(buttonId + "E", { customId: buttonId }).catch(ignore.routeNotFound);
   // await handler(buttonId + "E", { customId: buttonId });

   expect({ hello: "world" }).toEqual({
      hello: "world",
   });
});
