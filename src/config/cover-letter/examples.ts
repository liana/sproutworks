// The user's own cover letters, used as style examples. Every organization, product, person, and URL is XXX.
// Real names only ever come from the local database at runtime.

export const POSITIONING_STATEMENT =
  "I am a software engineer turned product manager. My focus is on turning complex data and system architecture into scalable product infrastructure while building hands-on alongside engineering teams.";

export const REFERRAL_SENTENCE = (name: string) => `${name} recommended I reach out regarding this role, and I was eager to connect.`;

export const STANDARD_EXAMPLES = [
  `Dear XXX,

I am a software engineer turned product manager. My focus is on turning complex data and system architecture into scalable product infrastructure while building hands-on alongside engineering teams.

At XXX, I directed enterprise product initiatives for our conversational AI platform, balancing clinical safety, privacy controls, and the core user experience. At XXX, I lead technical product strategy across complex software environments, consolidating fragmented legacy systems and judiciously introducing AI tools into our logistics software. Earlier in my career, I architected core identity and platform systems at XXX and XXX, translating multi-layered backends into reliable user workflows.

I build with AI tools daily, and I bring deep experience in system-level architecture and delivering production enterprise software. I would welcome the chance to discuss how my engineering experience and healthcare background can support the XXX strategy.

Best,
XXX`,
  `Dear XXX,

I am a software engineer turned product manager. My focus is on turning complex data and system architecture into scalable product infrastructure while building hands-on alongside engineering teams. XXX recommended I reach out regarding this role, and I was eager to connect.

At XXX, I focus on technical product strategy, delivering a generative AI portfolio for maintenance operations and framing a three-year roadmap to consolidate legacy tools across three engineering teams under one unified operations console. At XXX, I managed enterprise product initiatives on our conversational AI platform, pairing hands-on execution with clinical safety and privacy controls. Previously, I architected core identity and platform systems at XXX and XXX to translate complex backend environments into seamless, secure user workflows.

I build with AI tools daily, and I bring deep experience in prototyping, writing technical specifications, and shipping complex enterprise software. I look forward to discussing how my hands-on technical foundation and platform experience can support XXX's product strategy.

Best,
XXX`,
];

export const MISSION_DRIVEN_EXAMPLE = `Dear XXX team!

Early in my career, I served as an engineer with the XXX, and I would value the opportunity to return to the University. While I am currently at XXX architecting an AI strategy for software tooling, I've found that I prefer a mission-driven focus. Having spent the last decade in startups, I am eager to return to a fast-paced, individual contributor role where I can build AI products for the greater good.

Most recently at XXX, I led the product strategy for "XXX," a generative AI mental health application. I balanced clinical rigor with market demands by prototyping engagement features and validating them through rapid user testing. I have written extensively about these technical AI implementations and my philosophies on human-centered design at XXX.

I am particularly drawn to the XXX mission of reinventing how organizations compete through rigorous research and cutting-edge practice. My background includes scaling advanced analytics platforms, orchestrating agentic workflows, and translating a complex vision into technical solutions within collaborative environments. I'd love to chat more about how my experience can help build the next generation of AI-driven tools for XXX.

Best,
XXX`;

// Word caps per paragraph, from the longest example of each type. Code counts; letters never run longer.
export const CAPS = {
  STANDARD: { opening: 43, middle: 81, close: 40, body: 164 },
  MISSION_DRIVEN: { opening: 79, middle: 53, close: 64, body: 196 },
} as const;
