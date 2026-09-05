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
  }
];
