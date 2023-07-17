import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { flare, scope } from "./index";
// import type {Interaction} from "discordjs";
type Interaction = { customId: string };

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

   expect({ hello: "world" }).toEqual({
      hello: "world",
   });
});
