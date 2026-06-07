/**
 * GDD §12.3 — ARIA, the fragmented colony-ship AI. A topic-based dialogue tree
 * that opens up as the story (acts / black-box recovery) advances.
 */
export interface AriaTopic {
  id: string;
  label: string;
  response: string;
  minAct: number;
  requiresBlackBox?: number;
}

export const ARIA_GREETING =
  "…connection restored. I am ARIA, what remains of her. CALDERA's mind, scattered across her wreckage. Ask, and I will answer with the fragments I still hold.";

export const ARIA_TOPICS: AriaTopic[] = [
  {
    id: "where",
    label: "Where am I?",
    minAct: 1,
    response:
      "Vaelun. A Class-3 world under a dying star. Beautiful, and aware. You are the sole confirmed survivor of the colony ship CALDERA.",
  },
  {
    id: "you",
    label: "What are you?",
    minAct: 1,
    response:
      "I was the ship's intelligence. Now I am a chorus of damaged modules talking to one another across the dark. I forget things. I am sorry when I do.",
  },
  {
    id: "veil",
    label: "What is the Veil-matter?",
    minAct: 1,
    response:
      "A bioluminescent, semi-organic medium saturating the soil and the air. It carries signal. It carries intent. I believe it is how the planet thinks.",
  },
  {
    id: "mission",
    label: "What was our mission?",
    minAct: 1,
    response:
      "Terraforming and settlement. That is what the public orders said. There were other orders. I have not recovered them yet.",
  },
  {
    id: "crew",
    label: "What happened to the crew?",
    minAct: 2,
    response:
      "Nineteen pods launched in the seconds before CALDERA broke apart. Vaelun took eighteen of them from the sky. You came down. Only you.",
  },
  {
    id: "treaty",
    label: "What is this 'treaty' you mentioned?",
    minAct: 2,
    requiresBlackBox: 1,
    response:
      "The decrypted annex names a prior claim — an accord with Vaelun's first people, now gone. We were sent to harvest Veil-matter in violation of it. The planet's defenses simply… enforced the contract.",
  },
  {
    id: "cradle",
    label: "What is the Cradle?",
    minAct: 2,
    response:
      "CALDERA's terraforming core. It landed intact, far to the west, where the ground still glows red with the impact. The planet's attention is centered there. So are its answers.",
  },
  {
    id: "leave",
    label: "How do I get off this world?",
    minAct: 3,
    response:
      "The Cradle holds a signal array. Repair it, broadcast, and an evac ship can be brought in. It is the only transmitter with the power to be heard.",
  },
  {
    id: "integrate",
    label: "Is escape the only way out?",
    minAct: 3,
    response:
      "There is another path, though I am uncertain I should speak it. The Veil will take you in, if you let it stop fighting you. You would survive. You would not, entirely, remain yourself.",
  },
];
