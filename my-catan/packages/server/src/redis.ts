import { Redis } from "ioredis";

const ROOM_TTL_SECONDS = 60 * 60 * 24; // 24 hours

let _client: Redis | null = null;

function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!_client) {
    _client = new Redis(url, { enableOfflineQueue: false, maxRetriesPerRequest: 1 });
    _client.on("error", (err: Error) => {
      console.error("[redis] error:", err.message);
    });
  }
  return _client;
}

export async function saveRoom(roomId: string, data: object): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(`room:${roomId}`, JSON.stringify(data), "EX", ROOM_TTL_SECONDS);
  } catch (err) {
    console.error("[redis] saveRoom failed:", err);
  }
}

export async function loadRoom(roomId: string): Promise<object | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(`room:${roomId}`);
    return raw ? (JSON.parse(raw) as object) : null;
  } catch (err) {
    console.error("[redis] loadRoom failed:", err);
    return null;
  }
}
