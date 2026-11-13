import type { CallRecord } from "../beeline-api.js"

export const record = (id: number, overrides: Partial<CallRecord> = {}): CallRecord => ({
  id: String(id),
  externalId: `ext-${id}`,
  phone: "9000000000",
  direction: "OUTBOUND",
  date: Date.UTC(2026, 9, 20, 10) + id * 60_000,
  duration: 50_140,
  fileSize: 201_024,
  abonent: { userId: "70000000001@example.test", phone: "70000000001", firstName: "Test", lastName: "Manager" },
  ...overrides,
})
