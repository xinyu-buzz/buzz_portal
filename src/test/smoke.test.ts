describe("Test Framework", () => {
  it("should work", () => {
    expect(1 + 1).toBe(2);
  });

  it("should support async tests", async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});
