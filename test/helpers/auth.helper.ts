/**
 * Shared test user injected by createTestApp middleware.
 */
export const TEST_USER = {
  id: "test-user-id",
  name: "Test User",
  email: "test@example.com",
  emailVerified: false,
  image: null as string | null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};
