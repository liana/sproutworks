// Canned model output for SPROUT_FAKE_AI=1: lets the UI be tried without an API key. Quotes match the fixture job descriptions.
import type { AiTaskName } from "@/config/models";

export function fakeOutput(task: AiTaskName, wantsStandard: boolean): unknown {
  if (task === "FIT_CHECK") {
    return {
      fit: "STRONG",
      matches: [
        { requirement: "Data systems into product infrastructure", quote: "turn complex data systems into product infrastructure" },
        { requirement: "Platform architecture with engineering", quote: "partner with engineering on platform architecture" },
      ],
      gaps: ["Clinical workflow experience isn't explicit on your profile"],
    };
  }
  return wantsStandard
    ? {
        evidence: [
          { employer: "Harborline Systems", clause: "lead technical product strategy for an operations platform" },
          { employer: "Bluebird Care", clause: "directed enterprise initiatives for a conversational AI service" },
        ],
        earlier: { stem: "EARLIER_IN_MY_CAREER", employers: ["Kestrel", "Kestrel"], clause: "built identity and platform systems at Kestrel" },
        capabilities: ["platform architecture", "technical specifications", "shipping enterprise software"],
        strengths: "engineering foundation",
        hook: { text: "the Care Platform roadmap", quote: "shape the Care Platform roadmap" },
        closeStem: "WELCOME",
      }
    : {
        opening: "I have followed remote care for years and want to build products that clinicians trust.",
        middle: "At Bluebird Care, I directed enterprise initiatives for a conversational AI service, balancing safety with the user experience.",
        close: "I am drawn to your work in remote monitoring for chronic care. I'd love to chat more about how my experience can help.",
        hookQuote: "remote monitoring for chronic care",
      };
}
