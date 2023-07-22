import { expect, it } from "vitest";
import { allowError, flare, scope } from "./index";
type Interaction = { customId: string };

export const parseIds = (customId: string | undefined) => (customId?.split("-").map((i) => i || undefined) as (string | undefined)[]) ?? [];

it("Should create a default fetcher", async () => {
   const { router, handler } = flare<Interaction>().scope({
      foo(ctx: Interaction, id = 54) {
         console.log("handling foo", id);
      },
      bar: {
         // ts-expect-error if you forget to accept context as first param
         foo(ctx: Interaction, user: { id: number }, bar = false) {
            console.log("handling bar", user.id);
         },
      },
   });
   const buttonId = router.foo(54);

   await handler("E" + buttonId, { customId: buttonId }).catch(allowError.routeNotFound);

   await expect(() =>
      handler(buttonId + "E", { customId: buttonId })
         .catch(allowError.routeNotFound)
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
         console.log("handling foo", id);
      },
   });

   const buttonId = router.foo(54);

   await handler("E" + buttonId).catch(allowError.routeNotFound);

   await expect(() =>
      handler(buttonId + "E")
         .catch(allowError.routeNotFound)
         .catch((e) => Promise.reject(e)),
   ).rejects.toThrow();

   await handler(buttonId);

   const customId = "session";

   try {
      await handler(customId).catch(allowError.routeNotFound);
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
         console.log("handling foo", id);
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

   await handler("E" + buttonId, interaction).catch(allowError.routeNotFound);

   await expect(() =>
      handler(buttonId + "E", interaction)
         .catch(allowError.routeNotFound)
         .catch((e) => Promise.reject(e)),
   ).rejects.toThrow();

   await handler(buttonId, interaction);

   // await handler(buttonId + "E", { customId: buttonId }).catch(ignore.routeNotFound);
   // await handler(buttonId + "E", { customId: buttonId });

   expect({ hello: "world" }).toEqual({
      hello: "world",
   });
});
