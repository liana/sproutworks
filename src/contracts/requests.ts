// Request bodies the API accepts. Anything else is rejected with 400.
import { z } from "zod";

export const SetBoardRequest = z.union([
  z.object({ action: z.literal("CONFIRM") }),
  z.object({
    action: z.literal("SET"),
    provider: z.enum(["GREENHOUSE", "LEVER", "ASHBY"]),
    code: z.string().min(1).max(100),
  }),
  z.object({ action: z.literal("MARK_CANT_CHECK"), careersUrl: z.string().url().optional() }),
]);

export const AddPostingRequest = z.object({
  companyName: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  url: z.string().url().optional(),
  description: z.string().max(50_000).optional(),
  foundVia: z.string().max(100),
});

export const CoverLetterRequest = z.object({
  openingType: z.enum(["STANDARD", "MISSION_DRIVEN"]),
  referrerPersonId: z.string().optional(),
  note: z.string().max(500).optional(),
});

export const SaveCoverLetterRequest = z.object({ body: z.string().max(5_000) });

export const AddSourceRequest = z.object({
  list: z.enum(["NEWS", "LEADS"]),
  url: z.string().url(),
  category: z.enum(["AI", "DIGITAL_HEALTH", "PULSE"]).optional(),
  termsConfirmed: z.boolean(),
});

export const AppEventRequest = z.object({
  type: z.enum(["TODAY_OPENED", "ALL_CAUGHT_UP", "APPLY_CLICKED"]),
  postingId: z.string().optional(),
});
