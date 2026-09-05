// Pet-sized catastrophes. Outcomes are deterministic; the player sees each tradeoff.
export const SCHEMES = [
  {
    "id": "raisin",
    "title": "A very small funeral",
    "intro": "{p} has found a raisin and declared it a beloved uncle. The eulogy is longer than the raisin.",
    "choices": [
      {
        "label": "Supply a shroud",
        "changes": {
          "food": -8,
          "fuss": 18
        },
        "bond": 2,
        "outcome": "{p} buried the raisin in a scrap of tissue. Ate it at the wake. Said it was what he would have wanted."
      },
      {
        "label": "Explain dried fruit",
        "changes": {
          "clean": 10,
          "fuss": -6
        },
        "bond": 1,
        "outcome": "{p} has cancelled the funeral. The raisin is in recovery. Visiting hours are being enforced."
      }
    ],
    "autonomous": "{p} held the service without you. The deceased was eaten during a moving account of his generosity."
  },
  {
    "id": "heist",
    "title": "The great crumb robbery",
    "intro": "{p} is planning a heist. The target is a crumb. The getaway vehicle is also {p}.",
    "choices": [
      {
        "label": "Be the lookout",
        "changes": {
          "food": -10,
          "fuss": 16
        },
        "bond": 2,
        "outcome": "{p} stole the crumb, dropped it, and stole it again. A repeat offender."
      },
      {
        "label": "Offer an honest snack",
        "changes": {
          "food": 18,
          "fuss": -4
        },
        "bond": 1,
        "outcome": "{p} accepted the snack. Wore the tiny mask anyway."
      }
    ],
    "autonomous": "{p} carried out the heist alone. Hid behind the crumb. Was visible on both sides."
  },
  {
    "id": "seance",
    "title": "Is anybody there?",
    "intro": "{p} has arranged the dust into a spirit circle. Something inside the wall has asked for a quieter medium.",
    "choices": [
      {
        "label": "Hold a tiny séance",
        "changes": {
          "clean": -12,
          "fuss": 20
        },
        "bond": 2,
        "outcome": "{p} contacted the other side. It was the other side of the shelf. The acoustics were excellent."
      },
      {
        "label": "Dust the portal",
        "changes": {
          "clean": 20,
          "fuss": -5
        },
        "bond": 1,
        "outcome": "You wiped away the spirit circle. {p} says the afterlife smells of lemon now."
      }
    ],
    "autonomous": "{p} summoned something. It was a sneeze. Everyone involved took a moment."
  },
  {
    "id": "escape",
    "title": "An ambitious departure",
    "intro": "{p} has tied a thread to the shelf. It is packing the thread for the journey.",
    "choices": [
      {
        "label": "Fund the expedition",
        "changes": {
          "food": -8,
          "fuss": 20
        },
        "bond": 2,
        "outcome": "{p} reached the next slot. Sent a postcard. You could see it writing the postcard."
      },
      {
        "label": "Improve the accommodation",
        "changes": {
          "clean": 14,
          "fuss": 8
        },
        "bond": 1,
        "outcome": "{p} has postponed the escape. Apparently the shelf has really come on."
      }
    ],
    "autonomous": "{p} went on the run. Got as far as the nameplate. Is under an assumed posture."
  },
  {
    "id": "tooth",
    "title": "The tooth economy",
    "intro": "{p} is trying to lure the tooth fairy. The tooth appears to be made of bread.",
    "choices": [
      {
        "label": "Invest one crumb",
        "changes": {
          "food": -8,
          "fuss": 18
        },
        "bond": 2,
        "outcome": "{p} put the bread tooth under a pillow. In the morning there was a smaller piece of bread."
      },
      {
        "label": "Offer dental advice",
        "changes": {
          "clean": 16,
          "fuss": -4
        },
        "bond": 1,
        "outcome": "{p} brushed the bread tooth. It has become toothpaste. The business is pivoting."
      }
    ],
    "autonomous": "{p} waited for the tooth fairy. Fell asleep on the tooth. A difficult night for bread."
  },
  {
    "id": "haunt",
    "title": "A haunting, on spec",
    "intro": "{p} is practising to be a ghost. Being unable to die has complicated the training.",
    "choices": [
      {
        "label": "Lend a tissue",
        "changes": {
          "clean": -8,
          "fuss": 18
        },
        "bond": 2,
        "outcome": "{p} put on the tissue and said boo. Scared itself. Asked to be held through the tissue."
      },
      {
        "label": "Run a rehearsal",
        "changes": {
          "food": -4,
          "fuss": 12
        },
        "bond": 1,
        "outcome": "{p} walked through an imaginary wall. The real wall was behind it. Rehearsal ended early."
      }
    ],
    "autonomous": "{p} haunted its own slot. Filed a complaint about the haunting. Now has to investigate itself."
  },
  {
    "id": "coup",
    "title": "A change of management",
    "intro": "{p} has declared the shelf a sovereign state. The border is a hair.",
    "choices": [
      {
        "label": "Recognise the regime",
        "changes": {
          "food": -10,
          "fuss": 20
        },
        "bond": 2,
        "outcome": "{p} gave a victory speech. The border stuck to its foot. The country is mobile now."
      },
      {
        "label": "Open negotiations",
        "changes": {
          "clean": 10,
          "fuss": 10
        },
        "bond": 1,
        "outcome": "{p} accepted a clean patch of shelf in exchange for democracy. Has elected itself."
      }
    ],
    "autonomous": "{p} attempted a coup. Nobody moved. Declared that continuity of government."
  },
  {
    "id": "pet",
    "title": "Something smaller",
    "intro": "{p} has adopted a piece of lint. It is teaching it to stay. The lint is a natural.",
    "choices": [
      {
        "label": "Help with pet care",
        "changes": {
          "clean": -10,
          "fuss": 20
        },
        "bond": 2,
        "outcome": "{p} tucked the lint in. Checked on it. Tucked it in again. You recognise the situation."
      },
      {
        "label": "Build it a little bed",
        "changes": {
          "food": -4,
          "clean": 12
        },
        "bond": 1,
        "outcome": "{p} has a pet bed now. The lint sleeps diagonally and takes up all of it."
      }
    ],
    "autonomous": "{p} lost the lint. Found it stuck to itself. A tearful reunion, at no distance."
  },
  {
    "id": "museum",
    "title": "The museum of you",
    "intro": "{p} has found a hair and opened a museum. The audio guide is {p} making wind noises.",
    "choices": [
      {
        "label": "Attend the opening",
        "changes": {
          "food": -6,
          "fuss": 18
        },
        "bond": 2,
        "outcome": "{p} led you round the hair. The gift shop sold you a smaller hair. Admission had been free."
      },
      {
        "label": "Conserve the collection",
        "changes": {
          "clean": 18,
          "fuss": -4
        },
        "bond": 1,
        "outcome": "{p} watched you clean the exhibit. It is now a museum of absence. Prices have risen."
      }
    ],
    "autonomous": "{p} opened the museum. Got tangled in the exhibit. Has become part of the collection."
  },
  {
    "id": "monster",
    "title": "Under-shelf inspection",
    "intro": "{p} thinks something lives underneath the shelf. It has sent itself down as bait.",
    "choices": [
      {
        "label": "Hold the safety thread",
        "changes": {
          "food": -8,
          "fuss": 20
        },
        "bond": 2,
        "outcome": "{p} investigated beneath the shelf. Found a bigger dust bunny. Recommended leaving it in charge."
      },
      {
        "label": "Shine a light",
        "changes": {
          "clean": 14,
          "fuss": 6
        },
        "bond": 1,
        "outcome": "{p} met its shadow under the shelf. Both claimed to be the original. You brought one back."
      }
    ],
    "autonomous": "{p} went looking for the thing under the shelf. Was briefly the thing under the shelf."
  },
  {
    "id": "will",
    "title": "A premature inheritance",
    "intro": "{p} has written a will. Everything goes to {p}. It expects a lengthy dispute.",
    "choices": [
      {
        "label": "Witness the document",
        "changes": {
          "clean": -6,
          "fuss": 18
        },
        "bond": 2,
        "outcome": "{p} signed the will, contested it, and settled out of court. Kept the crumb."
      },
      {
        "label": "Suggest living a little",
        "changes": {
          "food": -4,
          "fuss": 12
        },
        "bond": 1,
        "outcome": "{p} has torn up the will and gone for a walk. Both inches of it."
      }
    ],
    "autonomous": "{p} read its own will aloud. Objected to the tone. Is seeking a second opinion from itself."
  },
  {
    "id": "shadow",
    "title": "A disciplinary matter",
    "intro": "{p} says its shadow is copying it. It has been setting traps that involve standing still.",
    "choices": [
      {
        "label": "Stage an intervention",
        "changes": {
          "food": -8,
          "fuss": 18
        },
        "bond": 2,
        "outcome": "{p} confronted its shadow. They reached for each other at the same time. Called it a truce."
      },
      {
        "label": "Recommend a nap",
        "changes": {
          "clean": 10,
          "fuss": 8
        },
        "bond": 1,
        "outcome": "{p} closed its eyes. Reported the shadow gone. Excellent work, everyone."
      }
    ],
    "autonomous": "{p} spent the afternoon following its shadow. Ended exactly where it started. Gave it a warning."
  },
  {
    "id": "medium",
    "title": "A word with the previous owner",
    "intro": "{p} is using the spirit board to reach the previous owner. So far it has reached the raisin. The raisin has news.",
    "choices": [
      {
        "label": "Ask a follow-up",
        "changes": {
          "clean": -8,
          "fuss": 16
        },
        "bond": 2,
        "outcome": "{p} asked the raisin about the previous owner. The raisin says they were also very dry at the end. The planchette has gone back to GOODBYE."
      },
      {
        "label": "Say goodbye politely",
        "changes": {
          "clean": 12,
          "fuss": -5
        },
        "bond": 1,
        "outcome": "{p} moved the planchette to GOODBYE. The raisin has kept talking. Boundaries are being set in cursive."
      }
    ],
    "autonomous": "{p} held the séance alone. The raisin came through clearly. The previous owner is still waiting on the line, behind it."
  },
  {
    "id": "bowlcoup",
    "title": "Regime change at the bowl",
    "intro": "{p} has declared the Snack Bowl a dictatorship. The bowl has not commented. {p} says that is typical of the bowl.",
    "choices": [
      {
        "label": "Storm the bowl",
        "changes": {
          "food": 14,
          "clean": -8
        },
        "bond": 2,
        "outcome": "{p} took the bowl from the inside. Ate the entire treasury. Has installed itself as the bowl."
      },
      {
        "label": "Broker a transition",
        "changes": {
          "fuss": 12,
          "food": -6
        },
        "bond": 1,
        "outcome": "{p} negotiated the bowl's surrender. The bowl stays on with reduced powers. {p} eats from it in a supervisory capacity."
      }
    ],
    "autonomous": "{p} staged the coup alone. Toppled the bowl. Was under the bowl when it toppled. The government continues from under there."
  },
  {
    "id": "parachute",
    "title": "Over the edge, in tissue",
    "intro": "{p} has folded a tissue into a parachute and is standing at the edge. The drop is two feet. The tissue is one ply.",
    "choices": [
      {
        "label": "Check the rigging",
        "changes": {
          "fuss": 16,
          "clean": -8
        },
        "bond": 2,
        "outcome": "{p} jumped. The tissue opened, folded, and landed first. {p} arrived a moment later and lay in it like a hammock."
      },
      {
        "label": "Build a landing pad",
        "changes": {
          "clean": 14,
          "food": -4
        },
        "bond": 1,
        "outcome": "{p} inspected the landing pad and postponed the jump. It wants a bigger tissue and a smaller fall. Neither is available."
      }
    ],
    "autonomous": "{p} jumped without you. The parachute did nothing and neither did the fall. {p} is back in its slot, damp, with the tissue over one eye."
  },
  {
    "id": "trial",
    "title": "A trial, in the small court",
    "intro": "{p} is on trial for a crumb. The jury is dust. {p} is also the judge, and has ruled that the jury is fair.",
    "choices": [
      {
        "label": "Act for the defence",
        "changes": {
          "fuss": 18,
          "food": -8
        },
        "bond": 2,
        "outcome": "{p} was acquitted. The dust deliberated for four seconds and blew off the shelf. {p} ate the evidence in celebration."
      },
      {
        "label": "Act for the prosecution",
        "changes": {
          "clean": 12,
          "fuss": -6
        },
        "bond": 1,
        "outcome": "{p} was found guilty by itself. Sentenced itself to the corner. Has appealed to itself and lost."
      }
    ],
    "autonomous": "{p} tried itself alone. The jury hung. {p} is now serving a life sentence in its slot, where it already lived."
  },
  {
    "id": "hostage",
    "title": "A crumb is being held",
    "intro": "{p} has taken a crumb hostage. The demand is a bigger crumb. The crumb has been told not to try anything.",
    "choices": [
      {
        "label": "Send in a negotiator",
        "changes": {
          "food": -6,
          "fuss": 16
        },
        "bond": 2,
        "outcome": "{p} released the crumb for a bigger crumb. Then took the bigger crumb hostage. Talks are ongoing, in its mouth."
      },
      {
        "label": "Meet the demands",
        "changes": {
          "food": 16,
          "fuss": -4
        },
        "bond": 1,
        "outcome": "{p} got the bigger crumb. Ate the hostage anyway. Says the crumb knew too much."
      }
    ],
    "autonomous": "{p} held the crumb for three hours. Nobody called. {p} ate the crumb and issued a statement blaming the crumb."
  },
  {
    "id": "union",
    "title": "The shelf organises",
    "intro": "{p} has unionised against the light switch. It is the only member. The switch is six feet away and has not been told.",
    "choices": [
      {
        "label": "Recognise the union",
        "changes": {
          "fuss": 18,
          "clean": -6
        },
        "bond": 2,
        "outcome": "{p} voted to strike and stood still for an hour holding a sign. The light went off at bedtime as usual. {p} is claiming that."
      },
      {
        "label": "Offer a compromise",
        "changes": {
          "fuss": 10,
          "food": -6
        },
        "bond": 1,
        "outcome": "{p} accepted an extra hour of lamp. Has recorded this as a total victory. Has recorded you as management."
      }
    ],
    "autonomous": "{p} went on strike alone. Downed tools. It has no tools. The switch was not informed and the lights went off at the usual time."
  },
  {
    "id": "forgery",
    "title": "A will, in a familiar hand",
    "intro": "{p} has drafted your will. It is in crayon and leaves the shelf to {p}. The signature is done already, to save you the trouble.",
    "choices": [
      {
        "label": "Sign it anyway",
        "changes": {
          "fuss": 18,
          "clean": -8
        },
        "bond": 2,
        "outcome": "{p} filed the will under the mat. It has started checking on you each morning, closely, with real warmth."
      },
      {
        "label": "Point out the spelling",
        "changes": {
          "clean": 12,
          "fuss": -6
        },
        "bond": 1,
        "outcome": "{p} corrected the spelling of your name. The will now leaves everything to a slightly different you. That you has not been found."
      }
    ],
    "autonomous": "{p} forged the will without you. Named itself executor, beneficiary and witness. The witness has raised concerns about the executor."
  },
  {
    "id": "tunnel",
    "title": "The tunnel",
    "intro": "{p} is digging a tunnel to the next slot. The shelf is solid wood. Progress so far is one scratch and a great deal of conviction.",
    "choices": [
      {
        "label": "Supply a spoon",
        "changes": {
          "fuss": 16,
          "clean": -10
        },
        "bond": 2,
        "outcome": "{p} dug for six hours with the spoon. The scratch is longer. {p} climbed out of it covered in nothing and shook your finger."
      },
      {
        "label": "Point out the open shelf",
        "changes": {
          "clean": 12,
          "fuss": -4
        },
        "bond": 1,
        "outcome": "{p} looked at the open shelf between the slots. Walked across it. Says the tunnel would have been quicker."
      }
    ],
    "autonomous": "{p} kept digging without you. It has reached the varnish. The varnish is holding. Both sides have dug in."
  },
  {
    "id": "insurance",
    "title": "A death, for the paperwork",
    "intro": "{p} is faking its own death for the insurance. It cannot die. It has looked into this and considers it a loophole.",
    "choices": [
      {
        "label": "Identify the body",
        "changes": {
          "fuss": 18,
          "food": -8
        },
        "bond": 2,
        "outcome": "{p} lay very still while you identified it. Signed the certificate itself. The payout is one crumb and it has gone on the funeral."
      },
      {
        "label": "Query the policy",
        "changes": {
          "clean": 10,
          "fuss": -5
        },
        "bond": 1,
        "outcome": "{p} has read the small print. Deaths must be permanent. {p} has appealed on the grounds that it is very tired."
      }
    ],
    "autonomous": "{p} died on its own around four. Got up at five to check the post. No cheque. It is dead again now, more carefully."
  },
  {
    "id": "moth",
    "title": "A moth, on approval",
    "intro": "{p} has adopted a moth. The moth is larger than {p} and has not agreed to anything.",
    "choices": [
      {
        "label": "Help it settle in",
        "changes": {
          "fuss": 16,
          "clean": -8
        },
        "bond": 2,
        "outcome": "{p} put the moth to bed. The moth went to the lamp. {p} put the lamp to bed. Everyone is at the lamp now."
      },
      {
        "label": "Suggest a smaller pet",
        "changes": {
          "clean": 12,
          "fuss": -4
        },
        "bond": 1,
        "outcome": "{p} let the moth go. The moth stayed. {p} has been letting it go every hour since, in a firm voice."
      }
    ],
    "autonomous": "{p} raised the moth alone. The moth ate something woollen and left. {p} has kept one wing and calls it visiting rights."
  },
  {
    "id": "wedding",
    "title": "A quiet ceremony",
    "intro": "{p} is marrying the lamp on Saturday. The lamp was asked twice and flickered. That has been taken as a yes.",
    "choices": [
      {
        "label": "Give away the lamp",
        "changes": {
          "fuss": 18,
          "food": -8
        },
        "bond": 2,
        "outcome": "{p} said its vows. The lamp said nothing, warmly. They are honeymooning one inch to the left of where they were."
      },
      {
        "label": "Raise an objection",
        "changes": {
          "clean": 10,
          "fuss": -6
        },
        "bond": 1,
        "outcome": "{p} heard your objection and married the lamp anyway, faster. You have been seated at the back, with the dust."
      }
    ],
    "autonomous": "{p} married the lamp without witnesses. The reception was one crumb, cut in two. The lamp's half is still there."
  },
  {
    "id": "duel",
    "title": "Pistols at dawn, lying down",
    "intro": "{p} has challenged you to a duel at dawn. It will be conducted lying down, for its back. You are to bring your own pillow.",
    "choices": [
      {
        "label": "Accept, and lie down",
        "changes": {
          "fuss": 18,
          "clean": -6
        },
        "bond": 2,
        "outcome": "{p} took ten paces on its back and fired a crumb. The crumb landed on its chest. Honour is satisfied and {p} is asleep where it fell."
      },
      {
        "label": "Send apologies",
        "changes": {
          "food": 10,
          "fuss": -5
        },
        "bond": 1,
        "outcome": "{p} accepted your apology at dawn, lying down. Fired into the air anyway. Was hit by the crumb on the way down."
      }
    ],
    "autonomous": "{p} duelled alone at dawn. Lay down, counted to ten, and fell asleep. Honour was not mentioned again until lunch."
  },
  {
    "id": "tuesday",
    "title": "A haunting, by appointment",
    "intro": "{p} has scheduled a haunting of you for Tuesday, two till four. You are asked to be in. You are asked to act surprised.",
    "choices": [
      {
        "label": "Be in on Tuesday",
        "changes": {
          "fuss": 18,
          "food": -8
        },
        "bond": 2,
        "outcome": "{p} haunted you at two sharp. It stood behind you and breathed. At four it stopped, thanked you for your time, and asked how it went."
      },
      {
        "label": "Be out on Tuesday",
        "changes": {
          "clean": 12,
          "fuss": -6
        },
        "bond": 1,
        "outcome": "{p} haunted an empty room from two till four. You have been rescheduled for Thursday. The missed appointment has gone in a small book."
      }
    ],
    "autonomous": "{p} haunted you on Tuesday while you were out. It reports that you screamed. You did not. It has written that down as well."
  },
  {
    "id": "exhume",
    "title": "An exhumation",
    "intro": "{p} is digging up the raisin to check it is still dead. It has brought a spoon and a witness. The witness is the spoon.",
    "choices": [
      {
        "label": "Hold the spoon",
        "changes": {
          "fuss": 16,
          "clean": -10
        },
        "bond": 2,
        "outcome": "{p} dug up the raisin. The raisin was fine. It has been reburied with a note asking it to stay put this time."
      },
      {
        "label": "Suggest a memorial",
        "changes": {
          "clean": 14,
          "fuss": -4
        },
        "bond": 1,
        "outcome": "{p} left the raisin where it lies and built a cairn of crumbs on top. The crumbs went by morning. The raisin is still there."
      }
    ],
    "autonomous": "{p} exhumed the raisin alone at 3am. Found a smaller raisin underneath. Is treating this as a family."
  }
];
