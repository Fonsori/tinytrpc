# TinyTrpc

Build type-safe asynchronus discord interaction handlers for storing simple data in a component's customId

### TLDR: it's essentially this but type magic.
```ts
// creation
const customId = buttonEventName + "-" + userId

// handling
const userId = interaction.customId.split("-")[1]
```

## Usage

### Setting up a basic router / handler

Create a router using `scope`:
```ts
import { scope } from "tinytrpc";

const { router, handler } = scope({
   foo(id = 54) {
      console.log("handling foo", id);
   },
	// Nest and group however you like
   bar: {
      foo(user: { id: number }, bar = false) {
         console.log("handling bar", user.id);
      },
   },
});
```

Call a router method to generate a customId:
```ts
// Generate a customId with a payload
const buttonId = router.bar.foo({id: 5});

// ...for use in a button component
const button = new ButtonBuilder().setCustomId(buttonId);
```

Handle an interaction we recieved:
```ts
await handler(interaction.customId);
```


### Using data only know to the handler

Give your CTX type to the `flare` builder:
```ts
import { flare } from "tinytrpc";
import type {Interaction} from "discordjs";

const { router, handler, } = flare<Interaction>().scope({
   foo(ctx: Interaction, id = 54) {
      console.log("handling foo", id);
   },
   bar: {
      // @ts-expect-error if you forget to accept CTX as first param
      foo(user: { id: number }, bar = false) {
         console.log("handling bar", user.id);
      },
   },
});
```

CTX param is omitted from the router...
```ts
const buttonId = router.foo(54);
```

...Yet now required by the handler
```ts
await handler(interaction.customId, interaction);
```

### Checkpount-middleware

Pass a function to `flare()`.`lock`:
```ts
import { flare } from "tinytrpc";
import type {Interaction} from "discordjs";

const { router, handler } = flare<Interaction>()
   .lock((interaction: Interaction) => {
      if (!interaction.inGuild()) return false;
      return true;
   })
   .scope({});

```

## Why does this exist?

- Why not store interaction data in a database?
- Why not just do
```ts
const buttonData = new Map

// creation
buttonData.set(customId, customData)

// handling
const data = buttonData.get(customId)
```
### Because you might

1. Have a value too tiny for a db
2. Want to persist data within discord
3. Prefer simplicity
4. Want autocomplete for handling lots of interactions