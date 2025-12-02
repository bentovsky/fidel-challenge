import { generateId, timestamp, hasItem } from "./utils";

describe("utils", () => {
  describe("generateId", () => {
    it("should return a valid UUID v4 format", () => {
      const id = generateId();
      const uuidV4Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(id).toMatch(uuidV4Regex);
    });

    it("should generate unique IDs on each call", () => {
      const id1 = generateId();
      const id2 = generateId();
      const id3 = generateId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it("should return a string", () => {
      const id = generateId();

      expect(typeof id).toBe("string");
    });

    it("should return a 36 character string", () => {
      const id = generateId();

      expect(id).toHaveLength(36);
    });
  });

  describe("timestamp", () => {
    it("should return a valid ISO 8601 timestamp", () => {
      const ts = timestamp();
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

      expect(ts).toMatch(isoRegex);
    });

    it("should return a string", () => {
      const ts = timestamp();

      expect(typeof ts).toBe("string");
    });

    it("should return current time", () => {
      const before = new Date().getTime();
      const ts = timestamp();
      const after = new Date().getTime();

      const tsTime = new Date(ts).getTime();

      expect(tsTime).toBeGreaterThanOrEqual(before);
      expect(tsTime).toBeLessThanOrEqual(after);
    });

    it("should be parseable as a Date", () => {
      const ts = timestamp();
      const date = new Date(ts);

      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).not.toBeNaN();
    });

    it("should end with Z indicating UTC timezone", () => {
      const ts = timestamp();

      expect(ts.endsWith("Z")).toBe(true);
    });
  });

  describe("hasItem", () => {
    describe("with Set", () => {
      it("should return true if item exists in Set", () => {
        const set = new Set(["a", "b", "c"]);

        expect(hasItem(set, "b")).toBe(true);
      });

      it("should return false if item does not exist in Set", () => {
        const set = new Set(["a", "b", "c"]);

        expect(hasItem(set, "d")).toBe(false);
      });

      it("should work with numeric Sets", () => {
        const set = new Set([1, 2, 3]);

        expect(hasItem(set, 2)).toBe(true);
        expect(hasItem(set, 4)).toBe(false);
      });
    });

    describe("with Array", () => {
      it("should return true if item exists in Array", () => {
        const arr = ["a", "b", "c"];

        expect(hasItem(arr, "b")).toBe(true);
      });

      it("should return false if item does not exist in Array", () => {
        const arr = ["a", "b", "c"];

        expect(hasItem(arr, "d")).toBe(false);
      });

      it("should work with numeric Arrays", () => {
        const arr = [1, 2, 3];

        expect(hasItem(arr, 2)).toBe(true);
        expect(hasItem(arr, 4)).toBe(false);
      });
    });

    describe("with undefined", () => {
      it("should return false for undefined collection", () => {
        expect(hasItem(undefined, "a")).toBe(false);
      });
    });

    describe("with empty collections", () => {
      it("should return false for empty Set", () => {
        expect(hasItem(new Set(), "a")).toBe(false);
      });

      it("should return false for empty Array", () => {
        expect(hasItem([], "a")).toBe(false);
      });
    });
  });
});
