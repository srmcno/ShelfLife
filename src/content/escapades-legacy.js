import { escapadeById } from './escapades.js';

// Archived authored edition from 4a3e50a. Unversioned album receipts and scenes
// keep the story that was actually completed before the dark-comedy revision.
export const LEGACY_ESCAPADES = {
  "crumb-observatory": {
    "title": "The Crumb Observatory",
    "endings": [
      {
        "id": "discovery",
        "label": "Name a new constellation",
        "keepsake": "crumb-telescope",
        "title": "The Biscuit-Scope",
        "text": "{name} builds a telescope from a paper tube and names the crumb The Great Maybe. Its orbit ends when someone opens a window. The star chart is adjusted: the constellation now includes the floor. Nobody has proved that the floor is not part of space.",
        "callback": "{name} insists that a clear view of the carpet is excellent seeing conditions."
      },
      {
        "id": "supper",
        "label": "Invite the comet to supper",
        "keepsake": "orbit-saucer",
        "title": "A Saucer for a Comet",
        "text": "{name} sets a place for the crumb and gently untangles it. The comet lands on a saucer with no casualties and rather more butter than expected. A wire model preserves its famous orbit. The comet sheds a piece of crust. They bury it under the saucer. Breakfast is now a protected graveyard.",
        "callback": "{name} reserves the little saucer for distinguished visitors from above."
      }
    ]
  },
  "small-haunting": {
    "title": "A Very Small Haunting",
    "endings": [
      {
        "id": "home",
        "label": "Offer it a place to stay",
        "keepsake": "ghost-bed",
        "title": "The Spare Matchbox",
        "text": "{name} lines a matchbox with cotton and calls it a guest room. The ghost spends its first evening haunting the pillow, then falls asleep halfway through “boo”. In the morning the pillow is one degree colder. The rent is one small shiver, payable whenever.",
        "callback": "{name} leaves the matchbox open a crack. The guest dislikes draughts."
      },
      {
        "id": "holiday",
        "label": "Give it some time off",
        "keepsake": "holiday-bell",
        "title": "The Off-Duty Bell",
        "text": "{name} excuses the ghost from haunting and lends it a bell to ring when it feels like company. It takes the bell for a long, inaudible walk. When it returns, there is a tiny sunset caught in the clapper. The clapper is now a tooth. It was not a tooth when it left. The ghost refuses to say whose holiday this was.",
        "callback": "{name} sometimes holds the bell to the light to see where the ghost went."
      }
    ]
  },
  "button-republic": {
    "title": "The Republic of One Button",
    "endings": [
      {
        "id": "crown",
        "label": "Give the button a monarch",
        "keepsake": "button-crown",
        "title": "The Crown of Almost Nothing",
        "text": "{name} crowns the button with a bottle cap. The new monarch immediately abolishes buttonholes, calling them a threat to national unity. The thread is appointed foreign minister. It crosses the border six times before lunch, which everyone agrees is diplomacy.",
        "callback": "{name} still refers to the button tin as “the neighbouring powers”."
      },
      {
        "id": "passport",
        "label": "Make everyone a citizen",
        "keepsake": "button-passport",
        "title": "A Passport to One Button",
        "text": "{name} opens all four borders and issues passports small enough to lose inside a passport. The first visitor is the thread. It stays for tea and accidentally stitches the country to a cushion. The constitution is amended to allow a nation to be comfortable.",
        "callback": "{name} stamps the passport before visiting the other end of the shelf."
      }
    ]
  },
  "drawer-rain": {
    "title": "The Rain Inside the Drawer",
    "endings": [
      {
        "id": "bottle",
        "label": "Rent it a little bottle",
        "keepsake": "rain-bottle",
        "title": "The Bottled Bedsit",
        "text": "{name} finds a glass bottle with a cork roof. The rain moves in and hangs a tiny curtain. On fine evenings it fogs the window so it can pretend the weather is terrible outside. The receipts dry out. One continues to bloom, out of loyalty.",
        "callback": "{name} taps the bottle before looking in. A home is a home."
      },
      {
        "id": "boat",
        "label": "Build it a boat instead",
        "keepsake": "rain-boat",
        "title": "The Drizzle Packet",
        "text": "{name} folds a boat from a receipt and points it towards the windowsill. The rain becomes its own sea, which saves enormously on travel. It sends back a damp paper flag from the far side of the saucer. The message is simply: “Room to stretch.”",
        "callback": "{name} keeps the paper boat ready in case the rain wants to visit."
      }
    ]
  },
  "unbirthday": {
    "title": "The Unbirthday Committee",
    "endings": [
      {
        "id": "years",
        "label": "Celebrate all the unknown years",
        "keepsake": "ever-candle",
        "title": "The Candle with No Number",
        "text": "{name} lights one candle for every year nobody can remember. Fortunately, one will do. It refuses to burn down until someone makes a wish, so the committee wishes for more time to think. The flame settles into a comfortable glow. Nobody is late for anything.",
        "callback": "{name} calls the candle “about the right number”."
      },
      {
        "id": "here",
        "label": "Celebrate being here together",
        "keepsake": "unbirthday-rosette",
        "title": "The Glad-You-Are-Here Ribbon",
        "text": "{name} crosses “birthday” off the invitation and writes “here”. A ribbon is awarded for attending, including to the table. They sing so loudly a tooth falls into the icing. The table wins Best Smile and is immediately accused of nepotism.",
        "callback": "{name} keeps the ribbon where it can be seen on completely ordinary days."
      }
    ]
  },
  "midnight-post": {
    "title": "The Midnight Post Office",
    "endings": [
      {
        "id": "deliver",
        "label": "Let the whole shelf answer",
        "keepsake": "nobody-stamp",
        "title": "The Stamp for Nobody",
        "text": "{name} carries the letter along the shelf and collects a small yes from every quiet corner. The reply is stamped with a button dipped in ink. By morning, a new envelope waits beside it: “Thank you. I thought so, but it helped to ask.” Nobody signs either letter.",
        "callback": "{name} checks the quiet corners for outgoing post."
      },
      {
        "id": "reply",
        "label": "Write a personal reply",
        "keepsake": "reply-envelope",
        "title": "The First Letter Back",
        "text": "{name} writes: “There is room beside me. You may be peculiar quietly or loudly; we have both.” The letter disappears into the crack behind the shelf. An answer emerges smelling faintly of distant rain. A correspondence begins. Neither writer asks the other to be less strange.",
        "callback": "{name} leaves a little space beside the inkpot for the next letter."
      }
    ]
  },
  "spoon-opera": {
    "title": "The Spoon Opera",
    "endings": [
      {
        "id": "solo",
        "label": "Give the spoon its great solo",
        "keepsake": "silver-baton",
        "title": "The Needle Baton",
        "text": "{name} raises a needle baton. The spoon sings its one note until a distant kettle answers in harmony. The fork withdraws its review. For a moment the whole cupboard rings like a cathedral, and even the cups stand a little straighter. The interval snacks receive a separate curtain call.",
        "callback": "{name} keeps the baton wrapped in felt. Even a conductor needs quiet."
      },
      {
        "id": "chorus",
        "label": "Invite everyone into the chorus",
        "keepsake": "choir-ticket",
        "title": "The Everyone Ticket",
        "text": "{name} hands a programme to every object willing to make a noise. The spoon leads, the fork hums, and the drawer contributes one exceptionally moving creak. The audience becomes the chorus. Afterwards, nobody can agree what the opera was about. Everyone remembers their part.",
        "callback": "{name} has kept one ticket. It says “Admit all”."
      }
    ]
  },
  "drawer-dragon": {
    "title": "The Last Drawer Dragon",
    "endings": [
      {
        "id": "keeper",
        "label": "Appoint it keeper of small treasures",
        "keepsake": "dragon-key",
        "title": "The Treasury Key",
        "text": "{name} names the dragon Keeper of Things Too Small to Find Again. It takes the job extremely seriously and sorts its hoard into pins, nearly pins, and emotionally significant fluff. A brass key is issued to {name}. It opens nothing, but the dragon recognises the authority.",
        "callback": "{name} shows the treasury key before borrowing even a little bit of thread."
      },
      {
        "id": "gifts",
        "label": "Show it how presents work",
        "keepsake": "dragon-parcel",
        "title": "The Dragon’s First Present",
        "text": "{name} explains that a treasure can become larger by belonging to someone else. The dragon thinks for a long time, then wraps its best pin in velvet. Inside is also a scale made of lint. It keeps the other two pins. Generosity, it decides, is something to practise.",
        "callback": "{name} has never opened the velvet wrapping without folding it neatly afterwards."
      }
    ]
  }
};

export const ESCAPADE_CONTENT_VERSION = 2;

export function escapadeAtVersion(id, version = 1) {
  const current = escapadeById(id);
  if (!current) return null;
  return version === ESCAPADE_CONTENT_VERSION ? current : { ...current, ...LEGACY_ESCAPADES[id] };
}
