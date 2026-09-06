import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  AskInsightBody,
  CompleteReminderParams,
  CreateHealthRecordBody,
  CreateHealthRecordParams,
  CreateMedicationBody,
  CreateMedicationParams,
  CreatePetBody,
  CreateReminderBody,
  CreateReminderParams,
  DeletePetParams,
  GetDashboardSummaryQueryParams,
  GetPetParams,
  ListHealthRecordsParams,
  ListInsightsQueryParams,
  ListMedicationsParams,
  ListRemindersParams,
  UpdatePetBody,
  UpdatePetParams,
} from "@workspace/api-zod";
import {
  db,
  healthRecords,
  insights,
  medications,
  pets,
  reminders,
} from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();
const DISCLAIMER =
  "AI guidance is educational and is not a diagnosis. Contact a licensed veterinarian for medical advice, and seek urgent care for severe or rapidly worsening symptoms.";

const asDateString = (value: Date | string | null | undefined) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value ?? null;

const asPet = (pet: typeof pets.$inferSelect) => ({
  ...pet,
  weight: pet.weight === null ? null : Number(pet.weight),
});

const asMedication = (medication: typeof medications.$inferSelect) => ({
  ...medication,
  nextDoseAt: medication.nextDoseAt?.toISOString() ?? null,
});

const asInsight = (insight: typeof insights.$inferSelect) => ({
  ...insight,
  createdAt: insight.createdAt.toISOString(),
});

let seedPromise: Promise<void> | null = null;

async function seedDataIfEmpty() {
  const existing = await db.select().from(pets).limit(1);
  if (existing.length) return;

  const [pet] = await db
    .insert(pets)
    .values({
      name: "Milo",
      species: "dog",
      breed: "Golden Retriever",
      sex: "male",
      birthDate: "2021-04-18",
      weight: "64.2",
      weightUnit: "lb",
      photoUrl: null,
      notes: "Friendly, food-motivated, and nervous during thunderstorms.",
    })
    .returning();
  if (!pet) return;

  await Promise.all([
    db.insert(healthRecords).values([
      {
        petId: pet.id,
        type: "visit",
        title: "Annual wellness exam",
        date: "2026-08-22",
        clinic: "Harbor Veterinary Clinic",
        summary: "Healthy overall. Continue current diet and daily exercise.",
      },
      {
        petId: pet.id,
        type: "vaccine",
        title: "Bordetella booster",
        date: "2026-08-22",
        clinic: "Harbor Veterinary Clinic",
        summary: "One-year booster administered.",
      },
      {
        petId: pet.id,
        type: "lab",
        title: "Routine blood panel",
        date: "2026-03-12",
        clinic: "Harbor Veterinary Clinic",
        summary: "Results were within the expected range.",
      },
    ]),
    db.insert(medications).values({
      petId: pet.id,
      name: "Heartgard Plus",
      dose: "1 chewable",
      frequency: "Every 30 days",
      nextDoseAt: new Date("2026-09-15T13:00:00.000Z"),
      active: true,
      instructions: "Give with food.",
    }),
    db.insert(reminders).values([
      {
        petId: pet.id,
        title: "Heartworm prevention",
        dueDate: "2026-09-15",
        category: "medication",
        note: "Give one chewable with breakfast.",
      },
      {
        petId: pet.id,
        title: "Dental cleaning consultation",
        dueDate: "2026-10-06",
        category: "appointment",
        note: "Ask about mild tartar noted at the wellness visit.",
      },
    ]),
    db.insert(insights).values({
      petId: pet.id,
      title: "A steady care routine",
      content:
        "Milo's preventive care is current. His next useful steps are the heartworm dose on September 15 and scheduling the dental consultation.",
      tone: "helpful",
      source: "record",
      disclaimer: DISCLAIMER,
    }),
  ]);
}

async function ensureSeedData() {
  seedPromise ??= seedDataIfEmpty().catch((error) => {
    seedPromise = null;
    throw error;
  });
  await seedPromise;
}

router.get("/pets", async (_req, res, next) => {
  try {
    await ensureSeedData();
    const rows = await db.select().from(pets).orderBy(asc(pets.id));
    res.json(rows.map(asPet));
  } catch (error) {
    next(error);
  }
});

router.post("/pets", async (req, res, next) => {
  try {
    const body = CreatePetBody.parse(req.body);
    const [created] = await db
      .insert(pets)
      .values({
        ...body,
        birthDate: asDateString(body.birthDate),
        weight: body.weight?.toString() ?? null,
      })
      .returning();
    res.status(201).json(asPet(created!));
  } catch (error) {
    next(error);
  }
});

router.get("/pets/:petId", async (req, res, next) => {
  try {
    const { petId } = GetPetParams.parse(req.params);
    const [pet] = await db.select().from(pets).where(eq(pets.id, petId));
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    res.json(asPet(pet));
  } catch (error) {
    next(error);
  }
});

router.patch("/pets/:petId", async (req, res, next) => {
  try {
    const { petId } = UpdatePetParams.parse(req.params);
    const body = UpdatePetBody.parse(req.body);
    const [updated] = await db
      .update(pets)
      .set({
        ...body,
        birthDate: asDateString(body.birthDate),
        weight: body.weight?.toString() ?? null,
      })
      .where(eq(pets.id, petId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    res.json(asPet(updated));
  } catch (error) {
    next(error);
  }
});

router.delete("/pets/:petId", async (req, res, next) => {
  try {
    const { petId } = DeletePetParams.parse(req.params);
    await db.delete(pets).where(eq(pets.id, petId));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/pets/:petId/records", async (req, res, next) => {
  try {
    const { petId } = ListHealthRecordsParams.parse(req.params);
    res.json(
      await db
        .select()
        .from(healthRecords)
        .where(eq(healthRecords.petId, petId))
        .orderBy(desc(healthRecords.date)),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/pets/:petId/records", async (req, res, next) => {
  try {
    const { petId } = CreateHealthRecordParams.parse(req.params);
    const body = CreateHealthRecordBody.parse(req.body);
    const [created] = await db
      .insert(healthRecords)
      .values({ petId, ...body, date: asDateString(body.date)! })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.get("/pets/:petId/medications", async (req, res, next) => {
  try {
    const { petId } = ListMedicationsParams.parse(req.params);
    const rows = await db
      .select()
      .from(medications)
      .where(eq(medications.petId, petId))
      .orderBy(asc(medications.nextDoseAt));
    res.json(rows.map(asMedication));
  } catch (error) {
    next(error);
  }
});

router.post("/pets/:petId/medications", async (req, res, next) => {
  try {
    const { petId } = CreateMedicationParams.parse(req.params);
    const body = CreateMedicationBody.parse(req.body);
    const [created] = await db
      .insert(medications)
      .values({
        petId,
        ...body,
        nextDoseAt: body.nextDoseAt ? new Date(body.nextDoseAt) : null,
      })
      .returning();
    res.status(201).json(asMedication(created!));
  } catch (error) {
    next(error);
  }
});

router.get("/pets/:petId/reminders", async (req, res, next) => {
  try {
    const { petId } = ListRemindersParams.parse(req.params);
    res.json(
      await db
        .select()
        .from(reminders)
        .where(eq(reminders.petId, petId))
        .orderBy(asc(reminders.dueDate)),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/pets/:petId/reminders", async (req, res, next) => {
  try {
    const { petId } = CreateReminderParams.parse(req.params);
    const body = CreateReminderBody.parse(req.body);
    const [created] = await db
      .insert(reminders)
      .values({
        petId,
        ...body,
        dueDate: asDateString(body.dueDate)!,
        completed: false,
      })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.post("/reminders/:reminderId/complete", async (req, res, next) => {
  try {
    const { reminderId } = CompleteReminderParams.parse(req.params);
    const [updated] = await db
      .update(reminders)
      .set({ completed: true })
      .where(eq(reminders.id, reminderId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Reminder not found" });
      return;
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get("/insights", async (req, res, next) => {
  try {
    await ensureSeedData();
    const { petId } = ListInsightsQueryParams.parse(req.query);
    const conditions = petId ? eq(insights.petId, petId) : undefined;
    const rows = await db
      .select()
      .from(insights)
      .where(conditions)
      .orderBy(desc(insights.createdAt))
      .limit(12);
    res.json(rows.map(asInsight));
  } catch (error) {
    next(error);
  }
});

router.post("/insights", async (req, res, next) => {
  try {
    const { petId, question } = AskInsightBody.parse(req.body);
    const [pet] = await db.select().from(pets).where(eq(pets.id, petId));
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    const records = await db
      .select()
      .from(healthRecords)
      .where(eq(healthRecords.petId, petId))
      .orderBy(desc(healthRecords.date))
      .limit(8);
    const meds = await db
      .select()
      .from(medications)
      .where(and(eq(medications.petId, petId), eq(medications.active, true)));

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content:
            "You are a cautious pet care education assistant for pet owners. Give concise, practical, plain-language guidance grounded only in the supplied profile and records. Never diagnose, prescribe, change medication, or claim certainty. If the question mentions trouble breathing, collapse, seizures, uncontrolled bleeding, poisoning, inability to urinate, a swollen abdomen, severe pain, or rapidly worsening symptoms, lead with seeking emergency veterinary care now. Otherwise explain what to observe, low-risk supportive steps, and when to contact a veterinarian. Keep the answer under 170 words.",
        },
        {
          role: "user",
          content: JSON.stringify({
            pet: asPet(pet),
            recentRecords: records,
            activeMedications: meds.map(asMedication),
            ownerQuestion: question,
          }),
        },
      ],
    });

    const content =
      completion.choices[0]?.message?.content?.trim() ||
      "I could not prepare guidance right now. If you are concerned about a new or worsening symptom, contact your veterinarian.";
    const urgentPattern =
      /trouble breathing|collapse|seizure|uncontrolled bleeding|poison|cannot urinate|swollen abdomen|severe pain|emergency/i;
    const tone = urgentPattern.test(question) ? "urgent" : "helpful";
    const [created] = await db
      .insert(insights)
      .values({
        petId,
        title: tone === "urgent" ? "Please seek urgent veterinary care" : "Guidance for your question",
        content,
        tone,
        source: "ai",
        disclaimer: DISCLAIMER,
      })
      .returning();
    res.json(asInsight(created!));
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard/summary", async (req, res, next) => {
  try {
    await ensureSeedData();
    const { petId } = GetDashboardSummaryQueryParams.parse(req.query);
    const [pet] = petId
      ? await db.select().from(pets).where(eq(pets.id, petId))
      : await db.select().from(pets).orderBy(asc(pets.id)).limit(1);
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    const [records, meds, todos, recentInsights] = await Promise.all([
      db.select().from(healthRecords).where(eq(healthRecords.petId, pet.id)).orderBy(desc(healthRecords.date)),
      db.select().from(medications).where(and(eq(medications.petId, pet.id), eq(medications.active, true))).orderBy(asc(medications.nextDoseAt)),
      db.select().from(reminders).where(and(eq(reminders.petId, pet.id), eq(reminders.completed, false))).orderBy(asc(reminders.dueDate)),
      db.select().from(insights).where(eq(insights.petId, pet.id)).orderBy(desc(insights.createdAt)).limit(4),
    ]);

    res.json({
      pet: asPet(pet),
      upcomingReminders: todos.slice(0, 5),
      activeMedications: meds.map(asMedication),
      recentRecords: records.slice(0, 5),
      recentInsights: recentInsights.map(asInsight),
      stats: {
        recordCount: records.length,
        activeMedicationCount: meds.length,
        upcomingReminderCount: todos.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;