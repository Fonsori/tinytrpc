fnva1Hash.BASE = 0x811c9dc5;
/**
 * Generates 32 bit FNV-1a hash from the given string.
 * As explained here: http://isthe.com/chongo/tech/comp/fnv/
 */
export function fnva1Hash(s: string, h = fnva1Hash.BASE) {
   const l = s.length;
   for (let i = 0; i < l; i++) {
      h ^= s.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
   }
   return h >>> 0;
}

//Credits (modified code): Bob Jenkins (http://www.burtleburtle.net/bob/hash/doobs.html)
//See also: https://en.wikipedia.org/wiki/Jenkins_hash_function
//Takes a string of any size and returns an avalanching hash string of 8 hex characters.
export function jenkinsOneAtATimeHash(keyString: string) {
   let hash = 0;
   for (let charIndex = 0; charIndex < keyString.length; ++charIndex) {
      hash += keyString.charCodeAt(charIndex);
      hash += hash << 10;
      hash ^= hash >> 6;
   }
   hash += hash << 3;
   hash ^= hash >> 11;
   //4,294,967,295 is FFFFFFFF, the maximum 32 bit unsigned integer value, used here as a mask.
   return (((hash + (hash << 15)) & 4294967295) >>> 0).toString(16);
}

/**
 * Calculate a 32 bit FNV-1a hash
 * Found here: https://gist.github.com/vaiorabbit/5657561
 * Ref.: http://isthe.com/chongo/tech/comp/fnv/
 *
 * @param {string} str the input value
 * @param {boolean} [asString=false] set to true to return the hash value as
 *     8-digit hex string instead of an integer
 * @param {integer} [seed] optionally pass the hash of the previous chunk
 * @returns {integer | string}
 */
export function hashFnv32a(str: string, asString: boolean, seed: number) {
   /*jshint bitwise:false */
   var i,
      l,
      hval = seed === undefined ? 0x811c9dc5 : seed;

   for (i = 0, l = str.length; i < l; i++) {
      hval ^= str.charCodeAt(i);
      hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
   }
   if (asString) {
      // Convert to 8 digit hex string
      return ("0000000" + (hval >>> 0).toString(16)).substr(-8);
   }
   return hval >>> 0;
}

export const cyrb53 = (str: string, seed = 0) => {
   let h1 = 0xdeadbeef ^ seed,
      h2 = 0x41c6ce57 ^ seed;
   for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
   }
   h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
   h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
   h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
   h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

   return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

/**
 * JS Implementation of MurmurHash3 (r136) (as of May 20, 2011)
 *
 * @author <a href="mailto:gary.court@gmail.com">Gary Court</a>
 * @see http://github.com/garycourt/murmurhash-js
 * @author <a href="mailto:aappleby@gmail.com">Austin Appleby</a>
 * @see http://sites.google.com/site/murmurhash/
 *
 * @param {string} key ASCII only
 * @param {number} seed Positive integer only
 * @return {number} 32-bit positive integer hash
 */
export function murmurhash3_32_gc(key: string, seed: string) {
   let remainder, bytes, h1, h1b, c1, c1b, c2, c2b, k1, i;

   remainder = key.length & 3; // key.length % 4
   bytes = key.length - remainder;
   h1 = seed;
   c1 = 0xcc9e2d51;
   c2 = 0x1b873593;
   i = 0;

   while (i < bytes) {
      k1 =
         (key.charCodeAt(i) & 0xff) |
         ((key.charCodeAt(++i) & 0xff) << 8) |
         ((key.charCodeAt(++i) & 0xff) << 16) |
         ((key.charCodeAt(++i) & 0xff) << 24);
      ++i;

      k1 = ((k1 & 0xffff) * c1 + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = ((k1 & 0xffff) * c2 + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;

      // @ts-ignore
      h1 ^= k1;
      // @ts-ignore
      h1 = (h1 << 13) | (h1 >>> 19);
      h1b = ((h1 & 0xffff) * 5 + ((((h1 >>> 16) * 5) & 0xffff) << 16)) & 0xffffffff;
      h1 = (h1b & 0xffff) + 0x6b64 + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16);
   }

   k1 = 0;

   switch (remainder) {
      // @ts-ignore
      case 3:
         k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
      // @ts-ignore
      case 2:
         k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
      case 1:
         k1 ^= key.charCodeAt(i) & 0xff;

         k1 = ((k1 & 0xffff) * c1 + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
         k1 = (k1 << 15) | (k1 >>> 17);
         k1 = ((k1 & 0xffff) * c2 + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
         // @ts-ignore
         h1 ^= k1;
   }

   // @ts-ignore
   h1 ^= key.length;

   // @ts-ignore
   h1 ^= h1 >>> 16;
   // @ts-ignore
   h1 = ((h1 & 0xffff) * 0x85ebca6b + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
   h1 ^= h1 >>> 13;
   h1 = ((h1 & 0xffff) * 0xc2b2ae35 + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16)) & 0xffffffff;
   h1 ^= h1 >>> 16;

   return (h1 >>> 0).toString(16);
}

/**
 * Fun


console.log("murm:", fnva1Hash("hel"));
console.log("murm:", fnva1Hash("hell"));
console.log("murm:", fnva1Hash("hello"));
console.log("murm:", fnva1Hash(""));
console.log("murm:", fnva1Hash("a"));
console.log("murm:", fnva1Hash("h"));
console.log(
   "murm:",
   fnva1Hash(
      "hello hellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohello",
   ),
);

console.log(`cyrb53('') -> ${cyrb53("")}`);
console.log(`cyrb53('') -> ${cyrb53("")}`);
console.log(`cyrb53('a') -> ${cyrb53("a")}`);
console.log(`cyrb53('b') -> ${cyrb53("b")}`);
console.log(`cyrb53('revenge') -> ${cyrb53("revenge")}`);
console.log(`cyrb53('revenue') -> ${cyrb53("revenue")}`);
console.log(`cyrb53('revenue', 1) -> ${cyrb53("revenue", 1)}`);
console.log(`cyrb53('revenue', 2) -> ${cyrb53("revenue", 2)}`);
console.log(`cyrb53('revenue', 3) -> ${cyrb53("revenue", 3)}`);
console.log(
   `cyrb53('revenue yeet', 3) -> ${cyrb53(
      "revenue oh my god this is such a long string god save the queen oh no it's too late for that now god bless the lord and savior jesus christ's dad",
      3,
   )}`,
);
console.log(
   `cyrb53('revenue yeet', 3) -> ${cyrb53(
      "revenue oh my god this is such a long string god save the queen oh no it's too late for that now god bless the lord and savior jesus christ's dad",
      3,
   )}`,
);

console.log("fnv32a", hashFnv32a("hello", true, 12));
console.log("fnv32a", hashFnv32a("hello there how are hou", true, 12));
console.log(
   "fnv32a",
   hashFnv32a("hello why is the sky blueb sbdfkjbsdkfbkjsdbfkjsbdkj bkj bkjdbsfkjbdsk bjkdn lksjbflkdbfkjbnds", true, 12),
);

console.log("jenkinsOneAtATimeHash", jenkinsOneAtATimeHash("hello"));
console.log("jenkinsOneAtATimeHash", jenkinsOneAtATimeHash("hello there how are hou"));
console.log(
   "jenkinsOneAtATimeHash",
   jenkinsOneAtATimeHash("hello why is the sky blueb sbdfkjbsdkfbkjsdbfkjsbdkj bkj bkjdbsfkjbdsk bjkdn lksjbflkdbfkjbnds"),
);

console.log("murmur", murmurhash3_32_gc("hi", "a"));
console.log("murmur", murmurhash3_32_gc("hello", "a"));
console.log("murmur", murmurhash3_32_gc("hello", "hi"));
console.log("murmur", murmurhash3_32_gc("hello there how are hou", "hi"));
console.log(
   "murmur",
   murmurhash3_32_gc("hello why is the sky blueb sbdfkjbsdkfbkjsdbfkjsbdkj bkj bkjdbsfkjbdsk bjkdn lksjbflkdbfkjbnds", "hi"),
);

 */
