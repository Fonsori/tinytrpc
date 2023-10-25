# TinyTrpc

Typed discord UIs.
Command-click to a component's handler.

### It's this but cooler
```ts
// creation
new ButtonBuilder({
   customId: buttonName + "-" + pageNumber,
});

// handling
const [buttonName, pageNumber] = interaction.customId.split("-")
```

## Full demo

init.
```ts
import { flare } from "tinytrpc";

// Simple "middleware"
const adminOnly = (interaction: Interaction) => interaction.memberPermissions?.has("Administrator") ?? false;

// Optional context for handler
type Context = ButtonInteraction<"raw" | "cached">;
// optional but convenient shortcut for combining routers
const lens = flare<Context>();
```
Basic router with context + middleware checkpoint
```ts
const adminPageScope = lens
   // Never miss a permissions check. Useful in nested routers.
   .lock(adminOnly)
   // Your methods
   .scope({
      // TS requires first param to be context
      async delete(interaction: Context, page: number) {
         // "page" comes from component's customId payload
         await deletePage(interaction.guildId, page);
      },
   });
```
Nesting routers
```ts
const { router, handler } = lens.scope({
   page: {
      admin: adminPageScope, // (uses "_internal" prop for nesting)

      // More methods, any shape
      async open(interaction: Context, page: number) {
         const pageData = await getPageData(interaction.guildId, page);

         // Example use
         const buttonRow = new ActionRowBuilder<ButtonBuilder>();
         buttonRow.addComponents(
            new ButtonBuilder({
               label: "next",
               // generate customId with next page as payload
               // context is provided later by handler
               customId: router.page.open(page + 1),
            }),
            new ButtonBuilder({
               label: "delete",
               // You can go to handler's definition via command-click!
               customId: router.page.admin.delete(page),
            }),
         );

         await interaction.update({ components: [buttonRow] });
      },
   },
});
```
Generic interaction handler
```ts
async function resolveAnyInteraction(interaction: Interaction) {
   if (!interaction.isButton()) return;
   if (!interaction.inGuild()) return;
   // handler second param is conditionally required if you use context
   await handler(interaction.customId, interaction);
}
```

## Disclaimer
Keep component payloads tiny, don't stuff it.
- Discord caps customId length at 100 characters
	- 10 characters are used for matching the method ID
- You payload is JSON.stringified
	- If your payload doesn't fit, string compression is attempted
- No runtime type validation. Not zod.
	- fn.length (num of JSON.parsed params) must match method



## Why does this exist?

- Why not store interaction data in a database?
- Why not just do
```ts
// creating component
db.set(customId, payload)
// handling component interaction
db.get(customId)
```
### Because you might
1. Want structure + intelisense for handling complex interactions
1. Want to persist data within discord
1. Have a value too tiny for a db. Why waste a roundtrip?