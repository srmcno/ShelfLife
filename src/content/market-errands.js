export const ERRAND_PAY = 4;
export const ERRAND_POINTS = 10;
export const MARKET_ERRANDS = [
  { id:'tea', name:'Tea for an awkward visitor', tags:['cozy','odd'], brief:'One comfort and one curiosity. Something to offer the guest, and something to discuss instead of the smell.', delivered:'The visitor asks about the curiosity. For seven glorious minutes, nobody discusses the smell.' },
  { id:'feast', name:'A midnight feast', tags:['snack','snack'], brief:'Two separate snacks. The napkin has already failed its audition as a third course.', delivered:'Both courses arrive. The host announces that the small portions are a deliberate insult to hunger.' },
  { id:'museum', name:'Open a tiny museum', tags:['bright','odd'], brief:'One shiny exhibit and one strange exhibit. The curator already owns the rope you must stand behind.', delivered:'The exhibits are installed. The curator ropes off the entire shelf and charges itself admission.' },
  { id:'nest', name:'Make a proper nest', tags:['cozy','cozy'], brief:'Two separate comforts. It should feel like a bed someone chose, rather than a drawer someone fell into.', delivered:'The nest is finished. Its owner tries it for eight seconds, then falls asleep beside it.' },
  { id:'gala', name:'Feed the gala guests', tags:['bright','snack'], brief:'One shiny centrepiece and one snack. Put them on different plates; last year was expensive.', delivered:'The snack goes on one plate, the centrepiece on another. A guest asks whether the plates are edible.' },
  { id:'crown', name:'Dress a reluctant monarch', tags:['bright','bright'], brief:'Two shiny objects. The monarch has agreed to reign until the bath is ready.', delivered:'The coronation is dazzling. The monarch immediately abdicates, citing the weight of office.' },
  { id:'sleepover', name:'Host a sleepover', tags:['cozy','snack'], brief:'One comfort and one snack. The invitation says “bring yourself”. The host is regretting its generosity.', delivered:'The guests settle in. One asks what time breakfast is. Nobody has gone to sleep yet.' },
  { id:'ghost', name:'Welcome the new ghost', tags:['odd','snack'], brief:'One curiosity and one snack. It has been haunting the wrong address and would appreciate a quiet evening.', delivered:'The ghost enjoys the curiosity. The snack falls through it. It asks for a saucer and tries again.' },
  { id:'cabinet', name:'Stock the oddities cabinet', tags:['odd','odd'], brief:'Two separate curiosities. The empty cabinet has started describing itself as the main attraction.', delivered:'The objects are installed. By morning they have moved the labels and put a price on the curator.' },
  { id:'reading', name:'Arrange a reading corner', tags:['cozy','bright'], brief:'One comfort and one light-catching object. The reader has been blaming the lighting for its opinions.', delivered:'The reading corner is ready. The reader finishes half a page and announces that the room is too comfortable.' }
];

export const ERRAND_VENDOR_LINES = [
  { opening:'“Nothing here is a pair. I have a reputation to maintain.”', passed:'The vendor folds the price tag in half. “There. Now it looks cheaper.”', bought:'“Keep the receipt. It is the only thing in this stall with a matching copy.”' },
  { opening:'“An antique is something I have failed to sell for a very long time.”', passed:'Mother Needle writes “patient buyer” beside your name. The list already says “patient stock”.', bought:'Mother Needle adds a year to its age while wrapping it. “It matured during the transaction.”' },
  { opening:'“Everything is edible at least once. Read the labels for our stricter definition.”', passed:'The vendor takes a sample off the tray and quietly changes which tray it came from.', bought:'“Would you like a bag?” The purchase rustles inside your bag. “Never mind. It has chosen.”' },
  { opening:'“The moon is second-hand. The night around it is complimentary.”', passed:'The astronomer turns the display towards someone with a more promising pocket.', bought:'“Do not store it beside Tuesday. We have had complaints about the tides.”' },
  { opening:'“I polish the stock until it can see the price. Most of it looks away.”', passed:'The vendor checks its reflection for signs of a lost sale. It finds two.', bought:'The vendor breathes on the wrapping and buffs out a fingerprint that was not yours.' },
  { opening:'“Last stall. Regret is available at every exit.”', passed:'The vendor calls this a missed opportunity. You call it still having buttons.', bought:'“A wise choice.” The vendor has said that to every customer, including the one who bought the bell.' }
];

// Descriptions follow the object's behaviour rather than an unrelated obituary.
export const ERRAND_ITEM_LINES = {
  'tea-sock':'Keeps one toe warm. The other toes have formed a tenants’ association.',
  'jam-button':'Both shiny and edible. Wear it to dinner and become the subject of dinner.',
  'haunted-pea':'The ghost inside insists it is a vegetable. Botanically correct. Socially exhausting.',
  'warm-moon':'Gently warm and pleasantly shiny. Comes with somebody else’s tide marks.',
  'tooth-pillow':'A soft bed for a retired tooth. It keeps asking what you left under the pillow.',
  'sugar-star':'A glittering snack. The packet advises against navigating by it after dessert.',
  'bedtime-biscuit':'Reads you a story. Becomes progressively harder to hear as you eat it.',
  'echo-jar':'Repeats your last sentence in a disappointed voice. No batteries. No off switch.',
  'brass-sun':'Brightens a small room. Takes credit for the morning even when kept in a cupboard.',
  'rain-scarf':'Soft, warm, and always slightly weeping. The care label says “do not ask”.',
  'mirror-spoon':'“You look wonderful.” It says the same thing to soup. Still, you needed that.',
  'crumb-crown':'Shiny sugar over shortbread. The reign lasts until somebody makes tea.',
  'pocket-rug':'A tiny comfort. The fringe gets under every door before the rest of it arrives.',
  'tiny-prophecy':'Predicts your next purchase. The vendor has pencilled in the expensive one.',
  'glow-thread':'Makes a cosy glow. Unspool too much and the afternoon falls out.',
  'opera-raisin':'A snack with formal training. Refuses to be eaten before the interval.',
  'comfort-crumbs':'Crumbs from an exceptionally comfortable biscuit. The evidence is mostly anecdotal.',
  'button-comet':'A bright little oddity. Keep clear of the model village.',
  'last-breath':'The snow settles upwards. Holding it is soothing until you try to explain it.',
  'extracted-halo':'Shiny, strange, and still faintly indignant about the whole arrangement.',
  'funeral-cake':'A comforting cake ordered much too early. The guest of honour has requested seconds.',
  'tooth-chandelier':'Shines beautifully. Every bulb has a different opinion about the dentist.',
  'saints-biscuit':'Edible gold leaf over a biscuit. Venerated briefly, then served with tea.',
  'future-heirloom':'Warm, polished, and already disappointed in your descendants.'
};
