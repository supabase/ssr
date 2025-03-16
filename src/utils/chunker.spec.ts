import { describe, expect, it } from "vitest";
import { combineChunks, createChunks } from "./chunker";

const len = (str: string) => {
  return Buffer.from(str).length;
};

const CHUNK_STRING =
  "zDq8KDAdv4PwF3UOp3mnEyx1xY71CaY4ZJdPTG8HpLHy3bCYs1x3vwPXdUqY75d0LYHL8KhxgrKqBEK531igiQNk1KqUKmMsabNlwcaF5E2gXA79vpwlxvi1wecwmKGVig4mJ0dzEEXKNsLgyQCsjKOpI7Nw2gnGAKKFdHle1SJeuFj9PyAHx9stMvQFpRQhoLRt3iI0uFA.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.lww9VHv5CCETYEFj9Q1emgiZI2nXZuvHbyJmIbYgMF9w533oG8ZEsdiKo81LAflQeUHYbbxOXTtroR2bdax0VYgjZ2qg5YeOnekqbgyDXwvmsOMktvg4x7JBJiHjzKK2kSPX0cCAhcU17ydRx19xq1gOUBup1j4kqEBbvKFKt67cfqZhT4kiERgbOt6mIyurSzUPgAhBNiqUJPM3872jVtweoum6mAfSgnG4H1qs2oNZjrbGi6Xv1H5WPALAdNzDwca0evrbbufUCKDX0XO27UTAFh9k4UFf0Dk1pPgKhomuWsfsJAJDvo2ZimmkXrlUo8OfihbpGCLMbEDRpxyIcIGTUQ30WeCyaHo2ds2hs2sh";

const DOUBLE_CHUNK_STRING = `${CHUNK_STRING}${CHUNK_STRING}`;

describe("chunker", () => {
  it("should not chunk and return one item", () => {
    const chunked = createChunks("my-chunks", "hello-world");
    expect(chunked.length).toBe(1);
  });

  it("should chunk and return two chunks", async () => {
    const chunked = createChunks("my-chunks", CHUNK_STRING, 2000);
    const combined = await combineChunks("my-chunks", (name) => {
      let chunk = chunked.find((chunk) => {
        return chunk.name === name;
      });
      return chunk?.value;
    });
    expect(len(`my-chunks=${CHUNK_STRING}`)).toBe(3621);
    expect(chunked.length).toBe(2);
    expect(combined).toBe(CHUNK_STRING);
  });

  it("should chunk and return twelve chunks", async () => {
    const chunked = createChunks("my-chunks", CHUNK_STRING, 320);
    const combined = await combineChunks("my-chunks", (name) => {
      let chunk = chunked.find((chunk) => {
        return chunk.name === name;
      });
      return chunk?.value;
    });
    expect(chunked.length).toBe(12);
    expect(combined).toBe(CHUNK_STRING);
  });

  it("should chunk and return one hundred and one chunks", async () => {
    const chunked = createChunks("my-chunks", CHUNK_STRING, 36);
    const combined = await combineChunks("my-chunks", (name) => {
      let chunk = chunked.find((chunk) => {
        return chunk.name === name;
      });
      return chunk?.value;
    });
    expect(chunked.length).toBe(101);
    expect(combined).toBe(CHUNK_STRING);
  });

  it("should chunk and return correct size chunks", async () => {
    const key = "sb-xdbaubpgcisziicojymj-auth-token";
    const chunked = createChunks(key, DOUBLE_CHUNK_STRING);
    const combined = await combineChunks(key, (name) => {
      let chunk = chunked.find((chunk) => {
        return chunk.name === name;
      });
      return chunk?.value;
    });

    chunked.forEach((chunk, i) => {
      expect(chunk.name).toBe(`${key}.${i}`);
      expect([3217, 3217, 899]).toContain(len(`${chunk.name}=${chunk.value}`));
    });

    expect(chunked.length).toBe(3);
    expect(len(`${key}=${DOUBLE_CHUNK_STRING}`)).toBe(7257);
    expect(combined).toBe(DOUBLE_CHUNK_STRING);
  });

  it("should correctly break between unicode boundaries in escaped characters", () => {
    const test = "   ";
    const chunks = createChunks("key", test, 4);
    expect(chunks).toEqual([
      {
        name: "key.0",
        value: " ",
      },
      {
        name: "key.1",
        value: " ",
      },
      {
        name: "key.2",
        value: " ",
      },
    ]);

    expect(chunks.map((char) => char.value).join("")).toEqual(test);
  });

  describe("should correctly break between unicode boundaries in long unicode", () => {
    it("should correctly break between unicode boundaries in long unicode (4 bytes)", () => {
      const test = "🤦🏻‍♂️";
      const chunksAtStartBorder = createChunks("key", test, 12);
      const chunksAtEndBorder = createChunks("key", test, 17);
      expect(chunksAtStartBorder).toEqual(chunksAtEndBorder);
      expect(chunksAtStartBorder).toEqual([
        {
          name: "key.0",
          value: "🤦",
        },
        {
          name: "key.1",
          value: "🏻",
        },
        {
          name: "key.2",
          value: "‍",
        },
        {
          name: "key.3",
          value: "♂",
        },
        {
          name: "key.4",
          value: "️",
        },
      ]);
      expect(chunksAtStartBorder.map((char) => char.value).join("")).toEqual(
        test,
      );
    });

    it("should correctly break between unicode boundaries in long unicode (5 bytes)", () => {
      const test = "🤦🏻‍♂️";
      const chunksAtStartBorder = createChunks("key", test, 18);
      const chunksAtEndBorder = createChunks("key", test, 20);
      expect(chunksAtStartBorder).toEqual(chunksAtEndBorder);
      expect(chunksAtStartBorder).toEqual([
        {
          name: "key.0",
          value: "🤦",
        },
        {
          name: "key.1",
          value: "🏻",
        },
        {
          name: "key.2",
          value: "‍♂",
        },
        {
          name: "key.3",
          value: "️",
        },
      ]);
      expect(chunksAtStartBorder.map((char) => char.value).join("")).toEqual(
        test,
      );
    });
  });
});
