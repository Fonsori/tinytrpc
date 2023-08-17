import { type ButtonInteraction, type Interaction, ActionRowBuilder, ButtonBuilder } from "discord.js"; // Not required, just for demo
import { flare } from "../src/index";
// import { flare } from "tinytrpc";

// Arbitrary mock methods to demonstrate type safety with "number" param
const getPageData = async (guildId: string, page: number) => ({ content: "the mayonnaise approached." });
const deletePage = async (guildId: string, page: number) => {};

// Simple "middleware"
const adminOnly = (interaction: Interaction) => interaction.memberPermissions?.has("Administrator") ?? false;

// Optionally context for handler
type Context = ButtonInteraction<"raw" | "cached">;
const lens = flare<Context>(); // optional but convenient shortcut, since context must be same type if you use it

// A simple scope
const adminPageScope = lens
   // Optional checkpoint. Never miss a permissions check. Useful in nested routers.
   .lock(adminOnly)
   // Your methods
   .scope({
      // TS requires your context to be the first param
      async delete(interaction: Context, page: number) {
         await deletePage(interaction.guildId, page); // pageNum came from the button's customId, but its a number!
      },
   });

const { router, handler } = lens.scope({
   // More methods, any shape
   page: {
      // Nest routers (don't destructure children like right above)
      admin: adminPageScope,

      async open(interaction: Context, page: number) {
         // Page is a number. TS is happy. You can use any type JSON.stringify can handle
         const pageData = await getPageData(interaction.guildId, page);

         const buttonRow = new ActionRowBuilder<ButtonBuilder>();
         buttonRow.addComponents(
            new ButtonBuilder({
               label: "previous",
               // Notice, context doesn't go here. Context is provided by the handler when the interaction is recieved.
               customId: router.page.open(page - 1),
            }),
            new ButtonBuilder({
               label: "next",
               customId: router.page.open(page + 1),
            }),
            new ButtonBuilder({
               label: "delete",
               // You can go to handler's definition via command-click!
               customId: router.page.admin.delete(page),
            }),
         );

         await interaction.update({ content: pageData.content, components: [buttonRow] });
      },
   },
});

// Generic interaction handler
async function resolveAnyInteraction(interaction: Interaction) {
   if (!interaction.isButton()) return;
   if (!interaction.inGuild()) return;
   await handler(interaction.customId, interaction); // this second param is conditionally required if you use context
}
