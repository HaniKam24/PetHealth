import { z } from "zod";
import { CreateReminderBody } from "@workspace/api-zod";
import { ProfileUpdateBody } from "./care-mutations";

// One tool per mutation the app already exposes — Pawlie never gets a
// write path of its own. Claude proposes a call; the server re-validates
// its input against these same schemas (both when storing the proposal
// and again at confirm time) before ever touching the database.
export const LogSymptomActionBody = z.object({ description: z.string().min(1) });
export const CompleteReminderActionBody = z.object({ reminderId: z.number().int().positive() });

export const AI_ACTION_SCHEMAS = {
  create_reminder: CreateReminderBody,
  complete_reminder: CompleteReminderActionBody,
  update_pet_profile: ProfileUpdateBody,
  log_symptom: LogSymptomActionBody,
} as const;

export type PawlieActionType = keyof typeof AI_ACTION_SCHEMAS;

export function isPawlieActionType(value: string): value is PawlieActionType {
  return value in AI_ACTION_SCHEMAS;
}

// Anthropic's tool-use JSON Schema, not a Zod schema — kept hand-in-hand
// with AI_ACTION_SCHEMAS above (same fields, same names) but expressed in
// the shape the model actually needs to see.
export const PAWLIE_TOOLS = [
  {
    name: "create_reminder",
    description:
      "Propose creating a new reminder for this pet. Use when the owner asks to be reminded of something (e.g. 'remind me to trim his nails by the end of the month'). Compute dueDate as an absolute YYYY-MM-DD date using the 'today' value supplied in context plus the owner's relative phrasing — never leave it relative.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Short reminder title." },
        dueDate: { type: "string", description: "Absolute due date, YYYY-MM-DD." },
        category: { type: "string", enum: ["appointment", "vaccine", "medication", "wellness", "other"] },
        note: { type: "string", description: "Optional extra detail." },
      },
      required: ["title", "dueDate", "category"],
    },
  },
  {
    name: "complete_reminder",
    description:
      "Propose marking an existing reminder as done. Only use this for a reminder that actually appears in the supplied reminders list — match it by title/category and use its real id from that list, never a guessed one.",
    input_schema: {
      type: "object" as const,
      properties: {
        reminderId: { type: "integer", description: "The id of the existing reminder to complete, taken from the supplied reminders list." },
      },
      required: ["reminderId"],
    },
  },
  {
    name: "update_pet_profile",
    description:
      "Propose updating one or more fields on the pet's own profile: vet contact info, breed, weight, or sex. Include only the fields the owner actually asked to change.",
    input_schema: {
      type: "object" as const,
      properties: {
        vetName: { type: "string" },
        vetClinic: { type: "string" },
        vetPhone: { type: "string" },
        vetAddress: { type: "string" },
        breed: { type: "string" },
        weight: { type: "number" },
        weightUnit: { type: "string", enum: ["lb", "kg"] },
        sex: { type: "string", enum: ["female", "male"] },
      },
    },
  },
  {
    name: "log_symptom",
    description:
      "Propose saving a description of an observed symptom to this pet's symptom log. Use when the owner describes something worth recording for later reference — not for every message.",
    input_schema: {
      type: "object" as const,
      properties: {
        description: { type: "string", description: "Plain description of the observed symptom, in the owner's own words." },
      },
      required: ["description"],
    },
  },
];
