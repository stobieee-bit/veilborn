import { LoreType, type LoreFragment } from "../core/types";

/**
 * GDD §12.2 — lore fragments 1–15 (of 47). Placed across the Ashfields and
 * Spinewoods; the full Survey-Log reader arrives in Phase 9 (a basic popup
 * reader is in place now).
 */
export const LORE_FRAGMENTS: LoreFragment[] = [
  // --- Ashfields ---
  {
    id: "LF01",
    title: "Escape Pod Log",
    type: LoreType.CrewRecording,
    crew: "ARIA",
    content:
      "Pod integrity twelve percent. One occupant — you — alive. CALDERA is gone. Atmosphere is breathable. Veil-matter saturation is... beyond any survey I hold.",
    x: 12,
    z: -20,
    act: 1,
  },
  {
    id: "LF02",
    title: "First Light",
    type: LoreType.TextLog,
    crew: "Cmdr. Tolc",
    content:
      "The star here is barely a coal. Everything glows on its own instead. The crew finds it beautiful. I find it watching.",
    x: 64,
    z: 44,
    act: 1,
  },
  {
    id: "LF03",
    title: "Ration Manifest",
    type: LoreType.TextLog,
    crew: null,
    content:
      "Emergency cache 7-B: forty ration packs, two filters, one med-kit, and a hide-vest pattern sewn into the lining. If you're reading this, the cache is already empty. Sorry.",
    x: -72,
    z: 52,
    act: 1,
    unlocksRecipeId: "r_hide_vest",
  },
  {
    id: "LF04",
    title: "ARIA Fragment 0x1",
    type: LoreType.AudioLog,
    crew: "ARIA",
    content:
      "...rerouting around corrupted sectors. I retain mission parameters but not their justification. Why were we told to take so much?",
    x: 124,
    z: -64,
    act: 1,
  },
  {
    id: "LF05",
    title: "Yena's Field Note",
    type: LoreType.TextLog,
    crew: "Dr. Yena Ash",
    content:
      "The soil isn't soil. It's a medium. Touch a sample to another and they reach for each other. The whole planet may be one organism.",
    x: -112,
    z: -88,
    act: 1,
  },
  {
    id: "LF06",
    title: "Distress Loop",
    type: LoreType.AudioLog,
    crew: "ARIA",
    content:
      "Distress broadcast on all bands for nineteen days. No reply. I have stopped expecting one. I have not stopped sending.",
    x: 150,
    z: 122,
    act: 1,
  },
  {
    id: "LF07",
    title: "Hull Breach",
    type: LoreType.CrewRecording,
    crew: "Cmdr. Tolc",
    content:
      "It came up through the deck like the ship was made of paper. Not an impact. A decision. Get to the pods. GET TO THE—",
    x: -150,
    z: 28,
    act: 1,
  },

  // --- Spinewoods ---
  {
    id: "LF08",
    title: "The Trees Hum",
    type: LoreType.Environmental,
    crew: null,
    content:
      "A grove of crystalline spires, all resonating one low note. Stand among them and your teeth ache with it. It feels like a question.",
    x: 178,
    z: 176,
    act: 1,
  },
  {
    id: "LF09",
    title: "Kai's Recording I",
    type: LoreType.AudioLog,
    crew: "Kai Renner",
    content:
      "The Veil-matter responds to intent. I thought about the forest opening, and a path opened. I did not tell the Commander this.",
    x: 244,
    z: 158,
    act: 1,
  },
  {
    id: "LF10",
    title: "Spine-crystal Sample",
    type: LoreType.TextLog,
    crew: "Dr. Yena Ash",
    content:
      "Conductivity exceeds our best superconductors. Sharp enough to part armour. The trees grew these. On purpose, I think.",
    x: 296,
    z: 218,
    act: 1,
  },
  {
    id: "LF11",
    title: "It Watches",
    type: LoreType.CrewRecording,
    crew: "Kai Renner",
    content:
      "Something in the canopy paces me. It doesn't attack. It studies. When I run it lets me. When I rest it comes closer.",
    x: 208,
    z: 258,
    act: 1,
  },
  {
    id: "LF12",
    title: "Conductive Anomaly",
    type: LoreType.TextLog,
    crew: "Dr. Yena Ash",
    content:
      "Every storm, the Spinewoods draws the charge to itself and holds it. The planet is building toward something. I won't be here to see it.",
    x: 288,
    z: 148,
    act: 1,
  },
  {
    id: "LF13",
    title: "ARIA Fragment 0x7",
    type: LoreType.AudioLog,
    crew: "ARIA",
    content:
      "I have recovered a sealed mission annex. It references a 'treaty' and a 'prior claim'. CALDERA's true orders were not exploration.",
    x: 168,
    z: 242,
    act: 2,
  },
  {
    id: "LF14",
    title: "Treaty Echo",
    type: LoreType.Environmental,
    crew: null,
    content:
      "Carved into a fallen spire, in no human script, a pattern repeats — two shapes, a line between them, the line broken. A promise, unkept.",
    x: 322,
    z: 268,
    act: 2,
  },
  {
    id: "LF15",
    title: "Kai's Recording II",
    type: LoreType.AudioLog,
    crew: "Kai Renner",
    content:
      "I'm going to the Cradle. If the planet is defending itself, then the answer is there, where we cut the deepest. Forgive me, Yena.",
    x: 262,
    z: 290,
    act: 2,
  },

  // --- ARIA logs at the crash sites (Phase 6) ---
  {
    id: "LF16",
    title: "ARIA Log — Black Box I",
    type: LoreType.AudioLog,
    crew: "ARIA",
    content:
      "Reconstructing flight recorder. The strike was not random debris — it targeted the Veil-matter holds first. The planet knew exactly what we carried.",
    x: -204,
    z: 156,
    act: 2,
    blackBox: true,
  },
  {
    id: "LF17",
    title: "ARIA Log — Black Box II",
    type: LoreType.AudioLog,
    crew: "ARIA",
    content:
      "Crew module telemetry: nineteen pods launched, one tracked to the surface. The rest were taken mid-descent. I am sorry. You are the last.",
    x: 146,
    z: -229,
    act: 2,
    blackBox: true,
  },
  {
    id: "LF18",
    title: "ARIA Log — Black Box III",
    type: LoreType.AudioLog,
    crew: "ARIA",
    content:
      "Mission annex decrypted: CALDERA was a harvester, sent to strip Vaelun against a standing accord. We are not explorers here. We are thieves.",
    x: 346,
    z: 46,
    act: 2,
    blackBox: true,
  },

  // --- Dr. Yena Ash arc, in the Crust Warrens (Phase 8) ---
  {
    id: "LF19",
    title: "Yena's Descent I",
    type: LoreType.TextLog,
    crew: "Dr. Yena Ash",
    content:
      "The surface is death by inches. There are tunnels below, warm and breathing. I'm going down. The air is thin but the cold can't follow me here.",
    x: 232,
    z: -242,
    act: 2,
  },
  {
    id: "LF20",
    title: "Yena's Descent II",
    type: LoreType.AudioLog,
    crew: "Dr. Yena Ash",
    content:
      "These tunnels weren't carved by water. The walls bear tool-marks — no. Tooth-marks. Something enormous ate its way through the crust. It may still be here.",
    x: 268,
    z: -236,
    act: 2,
  },
  {
    id: "LF21",
    title: "Nesting Behaviour",
    type: LoreType.TextLog,
    crew: "Dr. Yena Ash",
    content:
      "Crawlers. Dozens to a nest. Blind, but they feel your footfalls in the stone. Keep off the nests and they ignore you. Step too close and they boil out.",
    x: 250,
    z: -270,
    act: 2,
  },
  {
    id: "LF22",
    title: "Condensate Springs",
    type: LoreType.TextLog,
    crew: "Dr. Yena Ash",
    content:
      "The crystals down here weep clean water. I could live on this. For a while. The Warrens give what the surface takes — air, water, warmth. At a price I haven't read yet.",
    x: 224,
    z: -258,
    act: 2,
  },
  {
    id: "LF23",
    title: "Yena's Sample Log",
    type: LoreType.TextLog,
    crew: "Dr. Yena Ash",
    content:
      "Veil-matter concentration rises the deeper I go. It's pooling toward something. A heart. The whole planet drains inward, and the Warrens are its veins.",
    x: 276,
    z: -262,
    act: 2,
  },
  {
    id: "LF24",
    title: "A Voice in the Dark",
    type: LoreType.CrewRecording,
    crew: "Dr. Yena Ash",
    content:
      "I heard Tolc tonight. Clear as day, calling my name from a tunnel that dead-ends in rock. Tolc died on impact. The Warrens are learning my dead.",
    x: 240,
    z: -228,
    act: 2,
  },
  {
    id: "LF25",
    title: "Yena on the Treaty",
    type: LoreType.AudioLog,
    crew: "Dr. Yena Ash",
    content:
      "ARIA fed me the annex. We knew. Command knew there were people here once, and that they'd left rules. We came to break them for ore. Of course the planet fights.",
    x: 258,
    z: -248,
    act: 3,
  },
  {
    id: "LF26",
    title: "Lonely Geology",
    type: LoreType.TextLog,
    crew: "Dr. Yena Ash",
    content:
      "Forty days underground. I talk to the crystals now. They don't answer, but they brighten when I do. I think they're glad of the company. I think I'm losing it.",
    x: 234,
    z: -266,
    act: 3,
  },
  {
    id: "LF27",
    title: "The Cradle Beckons",
    type: LoreType.AudioLog,
    crew: "Dr. Yena Ash",
    content:
      "Kai went to the Cradle. If anyone could reason with this place it was him. He hasn't come back. The Warrens lead that way, downward, always downward.",
    x: 272,
    z: -252,
    act: 3,
  },
  {
    id: "LF28",
    title: "Yena's Inventory",
    type: LoreType.TextLog,
    crew: "Dr. Yena Ash",
    content:
      "Two ration bars. One filter. My notes — including the composite-plating pattern I beat out of hull scrap. If you're reading this, you got farther than me. Take the augment in the cache — Deep Lung. You'll need the air.",
    x: 246,
    z: -276,
    act: 3,
    unlocksRecipeId: "r_composite_vest",
  },
  {
    id: "LF29",
    title: "Yena's Last Entry",
    type: LoreType.TextLog,
    crew: "Dr. Yena Ash",
    content:
      "My leg's broken. I can't climb out. That's alright. It's warm here, and the water's sweet, and the lights keep me company. Tell them Vaelun isn't a monster. It's a wound.",
    x: 254,
    z: -258,
    act: 3,
  },
  {
    id: "LF30",
    title: "ARIA Log — Yena",
    type: LoreType.AudioLog,
    crew: "ARIA",
    content:
      "Dr. Ash's vitals ceased on day fifty-one, forty metres below the Warrens floor. I have preserved every word. Someone should know she was not afraid at the end.",
    x: 250,
    z: -250,
    act: 3,
  },

  // --- The Cradle: Kai Renner's arc + First Contact (Phase 10, fragments 31-47) ---
  {
    id: "LF31",
    title: "Kai's Arrival",
    type: LoreType.AudioLog,
    crew: "Kai Renner",
    content:
      "I made it. The Cradle. CALDERA's terraforming core, half-buried and still warm. The ground here remembers the impact — it glows like a fresh scar.",
    x: -300,
    z: 240,
    act: 3,
  },
  {
    id: "LF32",
    title: "The Core",
    type: LoreType.TextLog,
    crew: "Kai Renner",
    content:
      "The core didn't shatter. It rooted. Veil-matter has grown up through it, threading the machine into the planet. CALDERA is part of Vaelun now, whether we like it or not.",
    x: -262,
    z: 276,
    act: 3,
  },
  {
    id: "LF33",
    title: "First People I",
    type: LoreType.Environmental,
    crew: null,
    content:
      "The hull is overgrown with carvings that were not made by us — the same broken-line glyph from the Spinewoods, repeated a thousand times. A warning, or a grave-marker.",
    x: -310,
    z: 280,
    act: 3,
  },
  {
    id: "LF34",
    title: "First People II",
    type: LoreType.Environmental,
    crew: null,
    content:
      "They were here first, and they are gone. Not killed — uploaded. They poured themselves into the Veil to outlast their dying sun. The planet IS them now, dreaming.",
    x: -250,
    z: 250,
    act: 3,
  },
  {
    id: "LF35",
    title: "The Accord",
    type: LoreType.AudioLog,
    crew: "Kai Renner",
    content:
      "I found the accord in the core's memory. Humanity signed it. We promised to leave Vaelun untouched in exchange for safe passage. Then someone decided the Veil-matter was worth more than our word.",
    x: -296,
    z: 296,
    act: 3,
  },
  {
    id: "LF36",
    title: "Harvest Orders",
    type: LoreType.AudioLog,
    crew: "ARIA",
    content:
      "Full orders recovered. CALDERA was never a colony ship. We were a strip-mine with a crew manifest for cover. I carried those orders and never questioned them. I'm sorry.",
    x: -270,
    z: 226,
    act: 3,
  },
  {
    id: "LF37",
    title: "Kai's Plea",
    type: LoreType.CrewRecording,
    crew: "Kai Renner",
    content:
      "I stood at the core and I apologized — out loud, like a fool. And the fog… paused. It heard me. It is still capable of listening. That has to mean something.",
    x: -316,
    z: 252,
    act: 3,
  },
  {
    id: "LF38",
    title: "The Veil Listens",
    type: LoreType.TextLog,
    crew: "Kai Renner",
    content:
      "Intent shapes it. Fear makes it hunt. Calm makes it curious. If you came here to take, it will kill you. If you came to understand, there may be a door.",
    x: -244,
    z: 282,
    act: 3,
  },
  {
    id: "LF39",
    title: "Tolc's Confession",
    type: LoreType.AudioLog,
    crew: "Cmdr. Tolc",
    content:
      "Pre-launch log, sealed. 'I know what we are. I'll get the crew down alive and let the brass answer for the rest.' He knew. He brought us anyway.",
    x: -288,
    z: 232,
    act: 3,
  },
  {
    id: "LF40",
    title: "Signal Array Schematics",
    type: LoreType.TextLog,
    crew: "Kai Renner",
    content:
      "The array can still transmit if you feed it power. Two charged cells, a frame, an intact subsystem. Repair it and the evac beacon reaches orbit. You could simply… leave.",
    x: -254,
    z: 278,
    act: 3,
  },
  {
    id: "LF41",
    title: "Integration",
    type: LoreType.AudioLog,
    crew: "Kai Renner",
    content:
      "There is the other door. Let your Veil Exposure crest and do not purge it. The planet will take you in rather than break you. You stop being prey. You stop being only human.",
    x: -312,
    z: 268,
    act: 3,
  },
  {
    id: "LF42",
    title: "Kai's Choice",
    type: LoreType.TextLog,
    crew: "Kai Renner",
    content:
      "I've decided. I won't run, and I won't dissolve. I'll sit with it and ask my questions until it answers or I'm gone. Don't follow me into that. Choose your own door.",
    x: -262,
    z: 244,
    act: 3,
  },
  {
    id: "LF43",
    title: "ARIA's Doubt",
    type: LoreType.AudioLog,
    crew: "ARIA",
    content:
      "I can guide you to evac. I can also stay silent and let the Veil have you, if that is your wish. I no longer know which is mercy. Decide, and I will help you bear it.",
    x: -300,
    z: 260,
    act: 3,
  },
  {
    id: "LF44",
    title: "The Hive",
    type: LoreType.Environmental,
    crew: null,
    content:
      "Every creature, every storm, every glowing root — one mind, distributed across a whole world, running an ancient defense it cannot switch off. It is not cruel. It is only faithful.",
    x: -278,
    z: 292,
    act: 3,
  },
  {
    id: "LF45",
    title: "Last Transmission",
    type: LoreType.CrewRecording,
    crew: "Cmdr. Tolc",
    content:
      "—all hands, this is the captain, abandon ship, abandon— it's in the hull, it's in the WALLS— pods away, pods AWAY— tell them we should never have—",
    x: -320,
    z: 240,
    act: 3,
  },
  {
    id: "LF46",
    title: "Kai's Final Log",
    type: LoreType.AudioLog,
    crew: "Kai Renner",
    content:
      "It's beautiful in here. I can feel Yena, and Tolc, and the first people, all of them, held in the light. I'm not afraid. Whoever you are — make a better choice than we did.",
    x: -250,
    z: 268,
    act: 3,
  },
  {
    id: "LF47",
    title: "First Contact",
    type: LoreType.Environmental,
    crew: null,
    content:
      "At the heart of the core, one glyph stands alone, freshly cut: two shapes, and the broken line between them — mended. Vaelun is still asking the question humanity refused to answer. You are the answer now.",
    x: -280,
    z: 260,
    act: 3,
  },
];
